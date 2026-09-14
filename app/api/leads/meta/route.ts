import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/leads-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const database = getDatabase();
  const stats = Object.fromEntries(
    (database.prepare("SELECT key, value FROM stats").all() as Array<{ key: string; value: number }>).map(
      ({ key, value }) => [key, Number(value)],
    ),
  );
  const industries = database.prepare(
    "SELECT industry, lead_count AS leadCount FROM industries ORDER BY industry COLLATE NOCASE",
  ).all();

  return NextResponse.json(
    { stats, industries },
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } },
  );
}
