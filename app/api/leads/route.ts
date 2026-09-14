import { NextRequest, NextResponse } from "next/server";
import { createLeadQuery, getDatabase, leadColumns } from "@/lib/leads-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const database = getDatabase();
  const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(10, Number.parseInt(request.nextUrl.searchParams.get("pageSize") ?? "50", 10) || 50));
  const { where, parameters } = createLeadQuery(request.nextUrl.searchParams);

  const total = Number(
    (database.prepare(`SELECT COUNT(*) AS count FROM leads ${where}`).get(...parameters) as { count: number }).count,
  );
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const offset = (safePage - 1) * pageSize;
  const leads = database.prepare(`
    SELECT ${leadColumns}
    FROM leads ${where}
    ORDER BY id
    LIMIT ? OFFSET ?
  `).all(...parameters, pageSize, offset);

  return NextResponse.json(
    { leads, total, page: safePage, pageSize, pageCount },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" } },
  );
}
