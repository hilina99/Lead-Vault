import { NextRequest } from "next/server";
import { createLeadQuery, getDatabase, leadColumns } from "@/lib/leads-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const csvHeaders = [
  "First Name", "Last Name", "Job Title", "Company", "Email", "Email Status",
  "Phone", "Website", "LinkedIn", "Industry", "Location", "Source",
];

type ExportLead = {
  firstName: string;
  lastName: string;
  jobTitle: string;
  company: string;
  email: string;
  emailStatus: string;
  phone: string;
  website: string;
  linkedinUrl: string;
  industry: string;
  location: string;
  source: string;
};

function escapeCsv(value: string) {
  const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safeValue) ? `"${safeValue.replaceAll('"', '""')}"` : safeValue;
}

export function GET(request: NextRequest) {
  const database = getDatabase();
  const selectedIds = (request.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isSafeInteger(value) && value > 0)
    .slice(0, 500);

  let where: string;
  let parameters: Array<string | number>;
  if (selectedIds.length) {
    where = `WHERE id IN (${selectedIds.map(() => "?").join(",")})`;
    parameters = selectedIds;
  } else {
    ({ where, parameters } = createLeadQuery(request.nextUrl.searchParams));
  }

  const statement = database.prepare(`SELECT ${leadColumns} FROM leads ${where} ORDER BY id`);
  const encoder = new TextEncoder();
  const iterator = statement.iterate(...parameters) as IterableIterator<ExportLead>;
  let started = false;

  const body = new ReadableStream({
    pull(controller) {
      if (!started) {
        controller.enqueue(encoder.encode(`\ufeff${csvHeaders.join(",")}\n`));
        started = true;
      }

      let chunk = "";
      while (chunk.length < 64 * 1024) {
        const next = iterator.next();
        if (next.done) {
          if (chunk) controller.enqueue(encoder.encode(chunk));
          controller.close();
          return;
        }
        const lead = next.value;
        chunk += [
          lead.firstName, lead.lastName, lead.jobTitle, lead.company, lead.email,
          lead.emailStatus, lead.phone, lead.website, lead.linkedinUrl,
          lead.industry, lead.location, lead.source,
        ].map((value) => escapeCsv(value ?? "")).join(",") + "\n";
      }
      controller.enqueue(encoder.encode(chunk));
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
