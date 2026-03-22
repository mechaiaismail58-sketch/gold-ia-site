import { NextResponse } from "next/server";

const NOTION_TOKEN = process.env.NOTION_TOKEN!;
const DATABASE_ID = process.env.NOTION_DATABASE_ID!;

type NotionPage = any;

function getProperty(page: NotionPage, names: string[]) {
  for (const name of names) {
    if (page?.properties?.[name]) return page.properties[name];
  }
  return null;
}

function getTitle(page: NotionPage, names: string[]) {
  const prop = getProperty(page, names);
  if (!prop) return "";

  if (prop.type === "title") {
    return prop.title?.map((item: any) => item.plain_text).join("") || "";
  }

  return "";
}

function getSelect(page: NotionPage, names: string[]) {
  const prop = getProperty(page, names);
  if (!prop) return "";

  if (prop.type === "select") {
    return prop.select?.name || "";
  }

  if (prop.type === "status") {
    return prop.status?.name || "";
  }

  if (prop.type === "rich_text") {
    return prop.rich_text?.map((item: any) => item.plain_text).join("") || "";
  }

  return "";
}

function getDate(page: NotionPage, names: string[]) {
  const prop = getProperty(page, names);
  if (!prop) return "";

  if (prop.type === "date") {
    return prop.date?.start || "";
  }

  return "";
}

function getCheckbox(page: NotionPage, names: string[]) {
  const prop = getProperty(page, names);
  if (!prop) return false;

  if (prop.type === "checkbox") {
    return !!prop.checkbox;
  }

  if (prop.type === "formula" && prop.formula?.type === "boolean") {
    return !!prop.formula.boolean;
  }

  return false;
}

function getNumber(page: NotionPage, names: string[]) {
  const prop = getProperty(page, names);
  if (!prop) return null;

  if (prop.type === "number") {
    return typeof prop.number === "number" ? prop.number : null;
  }

  if (prop.type === "formula" && prop.formula?.type === "number") {
    return typeof prop.formula.number === "number" ? prop.formula.number : null;
  }

  if (prop.type === "rich_text") {
    const text = prop.rich_text?.map((item: any) => item.plain_text).join("") || "";
    const parsed = parseFloat(text.replace(",", ".").replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeResult(raw: string, isWin: boolean, isLoss: boolean) {
  const value = (raw || "").trim().toLowerCase();

  if (value === "win" || isWin) return "Win";
  if (value === "loss" || isLoss) return "Loss";

  return raw || "";
}

export async function GET() {
  try {
    const notionRes = await fetch(
      `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NOTION_TOKEN}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify({
          page_size: 100,
          sorts: [{ property: "Date", direction: "descending" }],
        }),
        cache: "no-store",
      }
    );

    const data = await notionRes.json();

    if (!notionRes.ok) {
      return NextResponse.json(
        { error: "Notion API error", notion: data },
        { status: notionRes.status }
      );
    }

    const trades = (data.results || []).map((page: NotionPage) => {
      const rawResult = getSelect(page, ["Result", "Outcome", "Status"]);
      const isWin = getCheckbox(page, ["Is Win", "Win"]);
      const isLoss = getCheckbox(page, ["Is Loss", "Loss"]);

      const result = normalizeResult(rawResult, isWin, isLoss);

      const rawRR =
        getNumber(page, ["RR", "R", "Profit", "R Multiple", "RR Multiple"]);

      let rr = 0;

      if (result === "Win") {
        rr = rawRR ?? 0;
      } else if (result === "Loss") {
        rr = -1;
      } else {
        rr = 0;
      }

      return {
        id: page.id,
        title: getTitle(page, ["Trade", "Name", "Title"]),
        date: getDate(page, ["Date", "Trade Date"]),
        direction: getSelect(page, ["Direction", "Bias", "Side"]),
        setup: getSelect(page, ["Setup", "Setup Type"]),
        result,
        rr,
        emotion: getSelect(page, ["Emotion"]),
      };
    });

    const totalTrades = trades.length;
    const wins = trades.filter((t: any) => t.result === "Win").length;
    const losses = trades.filter((t: any) => t.result === "Loss").length;
    const totalR = trades.reduce((sum: number, t: any) => sum + (t.rr || 0), 0);
    const avgR = totalTrades > 0 ? totalR / totalTrades : 0;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

    return NextResponse.json({
      stats: {
        totalTrades,
        wins,
        losses,
        winRate,
        totalR,
        avgR,
      },
      trades,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Server error", details: String(error) },
      { status: 500 }
    );
  }
}