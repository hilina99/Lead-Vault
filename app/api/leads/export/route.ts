import { NextRequest, NextResponse } from "next/server";
import { createLeadQuery, FilterError, getDatabase, getFields } from "@/lib/leads-db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function escapeCsv(value: string) {
  const safe = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
export function GET(request: NextRequest) {
  try {
    const db = getDatabase(); const fields = getFields();
    const ids = (request.nextUrl.searchParams.get("ids") ?? "").split(",").filter(v => /^\d+$/.test(v)).map(Number).filter(v => Number.isSafeInteger(v) && v > 0);
    if (ids.length > 500) return NextResponse.json({error:"Select at most 500 leads"}, {status:400});
    const query = ids.length ? { where: `WHERE id IN (${ids.map(() => "?").join(",")})`, parameters: ids } : createLeadQuery(request.nextUrl.searchParams);
    const iterator = db.prepare(`SELECT * FROM leads ${query.where} ORDER BY id`).iterate(...query.parameters);
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) { controller.enqueue(encoder.encode("\ufeff" + fields.map(f => escapeCsv(f.label)).join(",") + "\r\n")); },
      pull(controller) {
        let chunk = "";
        while (chunk.length < 65536) {
          const next = iterator.next();
          if (next.done) { if (chunk) controller.enqueue(encoder.encode(chunk)); controller.close(); return; }
          chunk += fields.map(f => escapeCsv(String(next.value[f.key] ?? ""))).join(",") + "\r\n";
        }
        controller.enqueue(encoder.encode(chunk));
      },
      cancel() { iterator.return?.(); },
    });
    return new Response(body, { headers: { "Content-Type":"text/csv; charset=utf-8", "Content-Disposition":'attachment; filename="lead-vault-export.csv"', "Cache-Control":"no-store" } });
  } catch(error) { if (error instanceof FilterError) return NextResponse.json({error:error.message}, {status:400}); throw error; }
}

// import { NextRequest } from "next/server";
// import { createLeadQuery, getDatabase, leadColumns } from "@/lib/leads-db";

// export const runtime = "nodejs";
// export const dynamic = "force-dynamic";

// const csvHeaders = [
//   "First Name", "Last Name", "Job Title", "Company", "Email", "Email Status",
//   "Phone", "Website", "LinkedIn", "Industry", "Location", "Experience", "Source",
// ];

// type ExportLead = {
//   firstName: string;
//   lastName: string;
//   jobTitle: string;
//   company: string;
//   email: string;
//   emailStatus: string;
//   phone: string;
//   website: string;
//   linkedinUrl: string;
//   industry: string;
//   location: string;
//   experience: string;
//   source: string;
// };

// function escapeCsv(value: string) {
//   const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
//   return /[",\r\n]/.test(safeValue) ? `"${safeValue.replaceAll('"', '""')}"` : safeValue;
// }

// export function GET(request: NextRequest) {
//   const database = getDatabase();
//   const selectedIds = (request.nextUrl.searchParams.get("ids") ?? "")
//     .split(",")
//     .map((value) => Number.parseInt(value, 10))
//     .filter((value) => Number.isSafeInteger(value) && value > 0)
//     .slice(0, 500);

//   let where: string;
//   let parameters: Array<string | number>;
//   if (selectedIds.length) {
//     where = `WHERE id IN (${selectedIds.map(() => "?").join(",")})`;
//     parameters = selectedIds;
//   } else {
//     ({ where, parameters } = createLeadQuery(request.nextUrl.searchParams));
//   }

//   const statement = database.prepare(`SELECT ${leadColumns} FROM leads ${where} ORDER BY id`);
//   const encoder = new TextEncoder();
//   const iterator = statement.iterate(...parameters) as IterableIterator<ExportLead>;
//   let started = false;

//   const body = new ReadableStream({
//     pull(controller) {
//       if (!started) {
//         controller.enqueue(encoder.encode(`\ufeff${csvHeaders.join(",")}\n`));
//         started = true;
//       }

//       let chunk = "";
//       while (chunk.length < 64 * 1024) {
//         const next = iterator.next();
//         if (next.done) {
//           if (chunk) controller.enqueue(encoder.encode(chunk));
//           controller.close();
//           return;
//         }
//         const lead = next.value;
//         chunk += [
//           lead.firstName, lead.lastName, lead.jobTitle, lead.company, lead.email,
//           lead.emailStatus, lead.phone, lead.website, lead.linkedinUrl,
//           lead.industry, lead.location, lead.experience, lead.source,
//         ].map((value) => escapeCsv(value ?? "")).join(",") + "\n";
//       }
//       controller.enqueue(encoder.encode(chunk));
//     },
//   });

//   return new Response(body, {
//     headers: {
//       "Content-Type": "text/csv; charset=utf-8",
//       "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
//       "Cache-Control": "no-store",
//     },
//   });
// }
