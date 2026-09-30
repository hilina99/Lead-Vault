import { NextRequest, NextResponse } from "next/server";
import { getDatabase, getFields } from "@/lib/leads-db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: NextRequest) {
  const db = getDatabase(); const fields = getFields();
  const key = request.nextUrl.searchParams.get("field");
  if (key) {
    const field = fields.find(f => f.key === key);
    if (!field) return NextResponse.json({ error: "Unknown field" }, { status: 400 });
    const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 120).replace(/[\\%_]/g, "\\$&");
    const options = db.prepare(`SELECT DISTINCT ${field.key} AS value FROM leads WHERE trim(${field.key}) <> '' AND ${field.key} LIKE ? ESCAPE '\\' ORDER BY ${field.key} COLLATE NOCASE LIMIT 50`).all(`%${q}%`);
    return NextResponse.json({ options });
  }
  const stats = Object.fromEntries((db.prepare("SELECT key, value FROM stats").all() as Array<{key:string;value:number}>).map(x => [x.key, Number(x.value)]));
  return NextResponse.json({ fields, stats });
}

// import { NextResponse } from "next/server";
// import { getDatabase } from "@/lib/leads-db";

// export const runtime = "nodejs";
// export const dynamic = "force-dynamic";

// export function GET() {
//   const database = getDatabase();
//   const stats = Object.fromEntries(
//     (database.prepare("SELECT key, value FROM stats").all() as Array<{ key: string; value: number }>).map(
//       ({ key, value }) => [key, Number(value)],
//     ),
//   );
//   const industries = database.prepare(
//     "SELECT industry, lead_count AS leadCount FROM industries ORDER BY industry COLLATE NOCASE",
//   ).all();
//   const experienceBands = database.prepare(`
//     SELECT experience_band AS experienceBand, lead_count AS leadCount
//     FROM experience_bands
//     ORDER BY CASE experience_band
//       WHEN '0–2' THEN 1 WHEN '3–5' THEN 2 WHEN '6–10' THEN 3
//       WHEN '10+' THEN 4 ELSE 5 END
//   `).all();

//   return NextResponse.json(
//     { stats, industries, experienceBands },
//     { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } },
//   );
// }
