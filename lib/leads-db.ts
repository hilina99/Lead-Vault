import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

type DatabaseHolder = typeof globalThis & { __leadVaultDatabase?: DatabaseSync };

export function getDatabase() {
  const holder = globalThis as DatabaseHolder;
  if (!holder.__leadVaultDatabase) {
    holder.__leadVaultDatabase = new DatabaseSync(join(process.cwd(), "data", "leads.db"), {
      readOnly: true,
    });
    holder.__leadVaultDatabase.exec("PRAGMA query_only = ON; PRAGMA temp_store = MEMORY;");
  }
  return holder.__leadVaultDatabase;
}

export function createLeadQuery(searchParams: URLSearchParams) {
  const query = (searchParams.get("q") ?? "").trim().slice(0, 120);
  const company = (searchParams.get("company") ?? "").trim().slice(0, 120);
  const industry = (searchParams.get("industry") ?? "").trim().slice(0, 160);
  const experience = (searchParams.get("experience") ?? "").trim().slice(0, 20);
  const conditions: string[] = [];
  const parameters: Array<string | number> = [];

  if (query) {
    const terms = query.match(/[\p{L}\p{N}]+/gu)?.slice(0, 8) ?? [];
    if (terms.length) {
      conditions.push("leads.id IN (SELECT rowid FROM leads_fts WHERE leads_fts MATCH ?)");
      parameters.push(terms.map((term) => `\"${term.replaceAll('"', '""')}\"*`).join(" AND "));
    }
  }

  if (company) {
    conditions.push("leads.company LIKE ? ESCAPE '\\' COLLATE NOCASE");
    parameters.push(`${company.replace(/[\\%_]/g, "\\$&")}%`);
  }

  if (industry) {
    conditions.push("leads.industry = ? COLLATE NOCASE");
    parameters.push(industry);
  }

  if (experience) {
    conditions.push("leads.experience_band = ?");
    parameters.push(experience);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    parameters,
  };
}

export const leadColumns = `
  id,
  first_name AS firstName,
  last_name AS lastName,
  job_title AS jobTitle,
  company,
  email,
  email_status AS emailStatus,
  phone,
  website,
  linkedin_url AS linkedinUrl,
  industry,
  location,
  experience,
  experience_band AS experienceBand,
  source
`;
