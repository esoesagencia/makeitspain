import { NextRequest, NextResponse } from "next/server";

export interface PlaceSuggestion {
  placeId:     string;
  description: string; // full address string shown to the user
  mainText:    string; // e.g. "Hotel Arts Barcelona"
  secondaryText: string; // e.g. "Carrer de la Marina, Barcelona, Spain"
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q || q.trim().length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Google Maps API key not configured" }, { status: 500 });
  }

  const type = req.nextUrl.searchParams.get("type"); // "establishment" | "address" | null

  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
  url.searchParams.set("input", q);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("language", "en");
  url.searchParams.set("types", type === "establishment" ? "establishment" : "address");
  url.searchParams.set("components", "country:es");

  const res = await fetch(url.toString(), {
    headers: { Referer: "https://makeitspain-app.vercel.app/" },
  });
  const data = await res.json() as {
    status: string;
    predictions: {
      place_id: string;
      description: string;
      structured_formatting: {
        main_text: string;
        secondary_text: string;
      };
    }[];
  };

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    return NextResponse.json({ error: data.status }, { status: 500 });
  }

  const suggestions: PlaceSuggestion[] = (data.predictions ?? []).map((p) => ({
    placeId:       p.place_id,
    description:   p.description,
    mainText:      p.structured_formatting.main_text,
    secondaryText: p.structured_formatting.secondary_text,
  }));

  return NextResponse.json({ suggestions });
}
