import { NextResponse } from "next/server";

const MAP_ID = "1yvps6zGyD8iFRkF-XjvVAl__6sixAIk";
const KML_URL = `https://www.google.com/maps/d/kml?forcekml=1&mid=${MAP_ID}`;

type Coordinates = [number, number];
type PointFeature = { name: string; coords: Coordinates };

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function parseCoordinates(value: string): Coordinates[] {
  return value
    .trim()
    .split(/\s+/)
    .map((token) => token.split(",").map(Number))
    .filter((parts) => parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1]))
    .map((parts) => [parts[1], parts[0]] as Coordinates);
}

function longestLine(lines: Coordinates[][]) {
  return [...lines].sort((a, b) => b.length - a.length)[0] ?? [];
}

export async function GET() {
  try {
    const response = await fetch(KML_URL, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 SAVTOBUSRASP/1.0" },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Google My Maps вернул HTTP ${response.status}`, line: [], points: [] }, { status: 502 });
    }

    const kml = await response.text();
    if (!kml.includes("<kml") && !kml.includes("<Placemark")) {
      return NextResponse.json({ error: "Google My Maps не вернул KML.", line: [], points: [] }, { status: 502 });
    }

    const lineStrings: Coordinates[][] = [];
    for (const match of kml.matchAll(/<LineString[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/LineString>/gi)) {
      const coords = parseCoordinates(match[1]);
      if (coords.length > 1) lineStrings.push(coords);
    }

    const points: PointFeature[] = [];
    for (const placemark of kml.matchAll(/<Placemark\b[\s\S]*?<\/Placemark>/gi)) {
      const block = placemark[0];
      const nameMatch = block.match(/<name>([\s\S]*?)<\/name>/i);
      const pointMatch = block.match(/<Point[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/Point>/i);
      if (!pointMatch) continue;
      const coords = parseCoordinates(pointMatch[1])[0];
      if (!coords) continue;
      points.push({ name: decodeXml(nameMatch?.[1] ?? ""), coords });
    }

    const line = longestLine(lineStrings);
    return NextResponse.json({
      source: "Google My Maps",
      mapId: MAP_ID,
      line,
      points,
      lineCount: lineStrings.length,
      pointCount: points.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить Google My Maps.";
    return NextResponse.json({ error: message, line: [], points: [] }, { status: 502 });
  }
}
