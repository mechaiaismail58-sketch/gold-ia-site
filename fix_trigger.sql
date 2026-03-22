-- Run in Supabase Dashboard → SQL Editor → New query

-- 1. Add has_paid column if missing
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS has_paid boolean DEFAULT false;

-- 2. Auto-create users row on every auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, has_paid, hashed_access_code)
  VALUES (new.id, new.email, false, 'none')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Verify
SELECT id, email, has_paid FROM public.users ORDER BY created_at DESC LIMIT 10;
