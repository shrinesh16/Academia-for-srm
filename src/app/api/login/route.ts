import { NextResponse } from "next/server";

// Extend the route timeout — scraping can take up to 60s
export const maxDuration = 60;

const SCRAPER_URL = "http://localhost:3001/scrape";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.netId || !body.password) {
      return NextResponse.json(
        { error: "NetID and password are required." },
        { status: 400 }
      );
    }

    // Use AbortController with 55s timeout (longer than default)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    try {
      const res = await fetch(SCRAPER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const data = await res.json();

      if (!res.ok) {
        return NextResponse.json(
          { error: data.error || "Scraping failed" },
          { status: res.status }
        );
      }

      return NextResponse.json(data);
    } catch (fetchErr: unknown) {
      clearTimeout(timeout);
      throw fetchErr;
    }
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Failed to connect to scraper.";
    console.error("[Proxy] Error:", msg);

    if (
      msg.includes("ECONNREFUSED") ||
      msg.includes("fetch failed") ||
      msg.includes("connect")
    ) {
      return NextResponse.json(
        {
          error:
            "Scraper server is not running. Start it with: node scraper-server.js",
        },
        { status: 503 }
      );
    }

    if (msg.includes("abort")) {
      return NextResponse.json(
        { error: "Scraping timed out. Please try again." },
        { status: 504 }
      );
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
