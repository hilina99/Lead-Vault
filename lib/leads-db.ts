
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { numberOperators, textOperators, type Field, type Filter } from "./lead-types";
type Holder = typeof globalThis & { __leadVaultDatabase?: DatabaseSync };
export function getDatabase() {
  const holder = globalThis as Holder;
  return holder.__leadVaultDatabase ??= new DatabaseSync(join(process.cwd(), "data/leads.db"), { readOnly: true });
}
export function getFields(): Field[] { return getDatabase().prepare("SELECT key, label, type FROM fields ORDER BY position").all() as Field[]; }
export const leadColumns = "*";
export class FilterError extends Error {}
export function createLeadQuery(params: URLSearchParams) {
  const fields = getFields();
  const conditions: string[] = [];
  const parameters: Array<string | number> = [];
  const q = (params.get("q") ?? "").trim().slice(0, 200);
  const terms = q.match(/[\p{L}\p{N}]+/gu)?.slice(0, 12) ?? [];
  if (terms.length) {
    conditions.push("id IN (SELECT rowid FROM leads_fts WHERE leads_fts MATCH ?)");
    parameters.push(terms.map(t => `"${t}"*`).join(" AND "));
  }
  let filters: Filter[];
  try { filters = JSON.parse(params.get("filters") ?? "[]"); } catch { throw new FilterError("Invalid filters"); }
  if (!Array.isArray(filters) || filters.length > 20) throw new FilterError("Use at most 20 filters");
  const clauses: string[] = [];
  for (const filter of filters) {
    if (!filter || typeof filter !== "object") throw new FilterError("Invalid filter");
    const f = fields.find(f => f.key === filter.field);
    if (!f || !(f.type === "number" ? numberOperators : textOperators).includes(filter.operator)) throw new FilterError("Invalid field or condition");
    const col = f.key; // Trusted database metadata, never a user-supplied SQL identifier.
    if (filter.operator === "is_empty") { clauses.push(`trim(${col}) = ''`); continue; }
    if (filter.operator === "is_not_empty") { clauses.push(`trim(${col}) <> ''`); continue; }
    if (typeof filter.value !== "string" || !filter.value.trim() || filter.value.length > 500) throw new FilterError("Enter a filter value");
    const value = filter.value.trim();
    if (f.type === "number") {
      const n = Number(value);
      if (!Number.isFinite(n)) throw new FilterError("Enter a valid number");
      const expression = `CAST(REPLACE(${col}, ',', '') AS REAL)`;
      if (filter.operator === "between") {
        const end = Number(filter.valueTo);
        if (typeof filter.valueTo !== "string" || !filter.valueTo.trim() || !Number.isFinite(end) || end < n) throw new FilterError("Enter a valid range");
        clauses.push(`(trim(${col}) <> '' AND ${expression} BETWEEN ? AND ?)`); parameters.push(n, end);
      } else {
        clauses.push(`(trim(${col}) <> '' AND ${expression} ${{ equals: "=", gt: ">", lt: "<" }[filter.operator]} ?)`); parameters.push(n);
      }
    } else if (["contains", "starts_with"].includes(filter.operator)) {
      clauses.push(`${col} LIKE ? ESCAPE '\\' COLLATE NOCASE`);
      const escaped = value.replace(/[\\%_]/g, "\\$&");
      parameters.push((filter.operator === "contains" ? "%" : "") + escaped + "%");
    } else { clauses.push(`${col} ${filter.operator === "equals" ? "=" : "<>"} ? COLLATE NOCASE`); parameters.push(value); }
  }
  if (clauses.length) conditions.push(`(${clauses.join(params.get("match") === "any" ? " OR " : " AND ")})`);
  return { where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "", parameters };
}

// import { DatabaseSync } from "node:sqlite";
// import { join } from "node:path";

// type DatabaseHolder = typeof globalThis & { __leadVaultDatabase?: DatabaseSync };

// export function getDatabase() {
//   const holder = globalThis as DatabaseHolder;
//   if (!holder.__leadVaultDatabase) {
//     holder.__leadVaultDatabase = new DatabaseSync(join(process.cwd(), "data", "leads.db"), {
//       readOnly: true,
//     });
//     holder.__leadVaultDatabase.exec("PRAGMA query_only = ON; PRAGMA temp_store = MEMORY;");
//   }
//   return holder.__leadVaultDatabase;
// }

// export function createLeadQuery(searchParams: URLSearchParams) {
//   const query = (searchParams.get("q") ?? "").trim().slice(0, 120);
//   const company = (searchParams.get("company") ?? "").trim().slice(0, 120);
//   const industry = (searchParams.get("industry") ?? "").trim().slice(0, 160);
//   const experience = (searchParams.get("experience") ?? "").trim().slice(0, 20);
//   const conditions: string[] = [];
//   const parameters: Array<string | number> = [];

//   if (query) {
//     const terms = query.match(/[\p{L}\p{N}]+/gu)?.slice(0, 8) ?? [];
//     if (terms.length) {
//       conditions.push("leads.id IN (SELECT rowid FROM leads_fts WHERE leads_fts MATCH ?)");
//       parameters.push(terms.map((term) => `\"${term.replaceAll('"', '""')}\"*`).join(" AND "));
//     }
//   }

//   if (company) {
//     conditions.push("leads.company LIKE ? ESCAPE '\\' COLLATE NOCASE");
//     parameters.push(`${company.replace(/[\\%_]/g, "\\$&")}%`);
//   }

//   if (industry) {
//     conditions.push("leads.industry = ? COLLATE NOCASE");
//     parameters.push(industry);
//   }

//   if (experience) {
//     conditions.push("leads.experience_band = ?");
//     parameters.push(experience);
//   }

//   return {
//     where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
//     parameters,
//   };
// }

// export const leadColumns = `
//   id,
//   first_name AS firstName,
//   last_name AS lastName,
//   job_title AS jobTitle,
//   company,
//   email,
//   email_status AS emailStatus,
//   phone,
//   website,
//   linkedin_url AS linkedinUrl,
//   industry,
//   location,
//   experience,
//   experience_band AS experienceBand,
//   source
// `;

