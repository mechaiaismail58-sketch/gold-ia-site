import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    if (!["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
      return NextResponse.json({ error: "Unsupported format (jpg, png, webp)." }, { status: 400 });
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 2 MB)." }, { status: 400 });
    }

    const path = `${user.id}/avatar.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Avatar upload error:", uploadError);
      return NextResponse.json({ error: "Upload failed." }, { status: 500 });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = `${publicUrl}?t=${Date.now()}`;

    // Save URL in users table
    const admin = createAdminClient();
    const dbClient = admin ?? supabase;
    const { error: updateError } = await (dbClient as typeof supabase)
      .from("users")
      .update({ avatar_url: avatarUrl })
      .eq("id", user.id);

    if (updateError) {
      console.error("Avatar URL update error:", updateError);
      return NextResponse.json({ error: "Upload succeeded but URL save failed." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, avatarUrl });
  } catch (err) {
    console.error("Avatar route error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
