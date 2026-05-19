import { NextRequest, NextResponse } from "next/server";

export type TravelMode = "driving" | "walking" | "transit";

export interface TravelTimeResult {
  mode: TravelMode;
  durationMinutes: number;
  durationText: string;
  distanceText: string;
}

export interface TravelTimeResponse {
  results: TravelTimeResult[];
  error?: string;
}

const MODE_MAP: TravelMode[] = ["driving", "walking", "transit"];

export async function POST(req: NextRequest) {
  const { origin, destination } = await req.json() as { origin: string; destination: string };

  if (!origin || !destination) {
    return NextResponse.json({ error: "origin and destination are required" }, { status: 400 });
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Google Maps API key not configured" }, { status: 500 });
  }

  const results: TravelTimeResult[] = [];

  await Promise.all(
    MODE_MAP.map(async (mode) => {
      const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
      url.searchParams.set("origins", origin);
      url.searchParams.set("destinations", destination);
      url.searchParams.set("mode", mode);
      url.searchParams.set("key", apiKey);
      url.searchParams.set("language", "en");

      const res = await fetch(url.toString(), {
        headers: { Referer: "https://makeitspain-app.vercel.app/" },
      });
      const data = await res.json() as {
        status: string;
        rows: { elements: { status: string; duration: { value: number; text: string }; distance: { text: string } }[] }[];
      };

      if (data.status !== "OK") return;
      const el = data.rows?.[0]?.elements?.[0];
      if (!el || el.status !== "OK") return;

      results.push({
        mode,
        durationMinutes: Math.ceil(el.duration.value / 60),
        durationText: el.duration.text,
        distanceText: el.distance.text,
      });
    })
  );

  // Sort: driving first, then transit, then walking
  const order: TravelMode[] = ["driving", "transit", "walking"];
  results.sort((a, b) => order.indexOf(a.mode) - order.indexOf(b.mode));

  return NextResponse.json({ results } satisfies TravelTimeResponse);
}
