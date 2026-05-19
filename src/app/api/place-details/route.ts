import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get("placeId");
  if (!placeId) {
    return NextResponse.json({ error: "placeId required" }, { status: 400 });
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Google Maps API key not configured" }, { status: 500 });
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("fields", "name,formatted_address");
  url.searchParams.set("language", "en");

  const res = await fetch(url.toString(), {
    headers: { Referer: "https://makeitspain-app.vercel.app/" },
  });
  const data = await res.json() as {
    status: string;
    result?: { name?: string; formatted_address?: string };
  };

  if (data.status !== "OK") {
    return NextResponse.json({ error: data.status }, { status: 500 });
  }

  return NextResponse.json({
    name:    data.result?.name ?? "",
    address: data.result?.formatted_address ?? "",
  });
}
