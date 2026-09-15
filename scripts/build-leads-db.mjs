import { createReadStream, existsSync, mkdirSync, statSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const root = process.cwd();
const csvPath = join(root, "data", "leads.csv");
const databasePath = join(root, "data", "leads.db");
const schemaVersion = 2;

if (!existsSync(csvPath)) {
  throw new Error(`Missing ${csvPath}. Add the combined lead file as data/leads.csv.`);
}

if (existsSync(databasePath) && statSync(databasePath).mtimeMs >= statSync(csvPath).mtimeMs) {
  try {
    const existingDatabase = new DatabaseSync(databasePath, { readOnly: true });
    const version = existingDatabase.prepare(
      "SELECT value FROM stats WHERE key = 'schemaVersion'",
    ).get()?.value;
    existingDatabase.close();
    if (Number(version) === schemaVersion) {
      console.log("Lead database is already up to date.");
      process.exit(0);
    }
  } catch {
    // An older database is rebuilt below.
  }
}

mkdirSync(dirname(databasePath), { recursive: true });
if (existsSync(databasePath)) unlinkSync(databasePath);

async function* readCsvRows(filePath) {
  const stream = createReadStream(filePath, { encoding: "utf8" });
  let row = [];
  let field = "";
  let quoted = false;
  let quotePending = false;
  let skipLineFeed = false;
  let firstCharacter = true;

  for await (const chunk of stream) {
    for (const originalCharacter of chunk) {
      let character = originalCharacter;

      if (firstCharacter) {
        firstCharacter = false;
        if (character === "\ufeff") continue;
      }

      if (skipLineFeed) {
        skipLineFeed = false;
        if (character === "\n") continue;
      }

      if (quotePending) {
        quotePending = false;
        if (character === '"') {
          field += '"';
          continue;
        }
        quoted = false;
      }

      if (quoted) {
        if (character === '"') quotePending = true;
        else field += character;
        continue;
      }

      if (character === '"' && field.length === 0) {
        quoted = true;
      } else if (character === ",") {
        row.push(field);
        field = "";
      } else if (character === "\n" || character === "\r") {
        row.push(field);
        field = "";
        if (row.some((cell) => cell.trim())) yield row;
        row = [];
        if (character === "\r") skipLineFeed = true;
      } else {
        field += character;
      }
    }
  }

  if (quotePending) quoted = false;
  if (quoted) throw new Error("The CSV ended inside a quoted field.");
  if (field.length || row.length) {
    row.push(field);
    if (row.some((cell) => cell.trim())) yield row;
  }
}

const aliases = {
  firstName: ["first name", "firstname", "first_name", "given name"],
  lastName: ["last name", "lastname", "last_name", "surname", "family name"],
  jobTitle: ["title", "job title", "job_title", "position", "occupation"],
  company: ["company", "company name", "organization", "organisation"],
  email: ["email", "email address", "work email", "professional email"],
  emailStatus: ["email status", "email_status", "status", "verification status"],
  phone: ["phone", "phone number", "mobile", "telephone", "company phone"],
  website: ["website", "company website", "domain", "company domain"],
  linkedinUrl: ["linkedin", "linkedin url", "linkedin_url", "linkedin profile"],
  industry: ["industry", "company industry"],
  location: ["location", "city", "country", "address", "company location"],
  experienceYears: ["years of experience", "experience years", "years experience", "total experience"],
  seniority: ["seniority level (ai field)", "seniority level", "seniority"],
  source: ["source"],
};

function experienceFromData(experienceYears, seniority) {
  if (experienceYears) {
    const number = Number.parseFloat(experienceYears.match(/\d+(?:\.\d+)?/)?.[0] ?? "");
    const band = Number.isFinite(number)
      ? number <= 2 ? "0–2" : number <= 5 ? "3–5" : number <= 10 ? "6–10" : "10+"
      : "Not listed";
    return {
      experience: /year|yr/i.test(experienceYears) ? experienceYears : `${experienceYears} yrs`,
      experienceBand: band,
    };
  }

  const bands = {
    "In Training": "0–2",
    "Entry Level": "0–2",
    "Entry Level Manager": "3–5",
    Senior: "6–10",
    Manager: "6–10",
    "Experienced Manager": "10+",
    "Director / Head of": "10+",
    "Vice President": "10+",
    CXO: "10+",
    Owner: "10+",
    Partner: "10+",
  };
  const band = bands[seniority] ?? "Not listed";
  return {
    experience: band === "Not listed" ? "Not listed" : `Est. ${band} yrs`,
    experienceBand: band,
  };
}

const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA temp_store = MEMORY;
  CREATE TABLE leads (
    id INTEGER PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    job_title TEXT NOT NULL,
    company TEXT NOT NULL,
    email TEXT NOT NULL,
    email_status TEXT NOT NULL,
    phone TEXT NOT NULL,
    website TEXT NOT NULL,
    linkedin_url TEXT NOT NULL,
    industry TEXT NOT NULL,
    location TEXT NOT NULL,
    experience TEXT NOT NULL,
    experience_band TEXT NOT NULL,
    source TEXT NOT NULL
  );
  CREATE VIRTUAL TABLE leads_fts USING fts5(
    name, job_title, company, email, phone, location, industry, experience,
    content='', tokenize='unicode61 remove_diacritics 2'
  );
`);

const insertLead = database.prepare(`
  INSERT INTO leads (
    id, first_name, last_name, job_title, company, email, email_status,
    phone, website, linkedin_url, industry, location, experience, experience_band, source
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertSearch = database.prepare(`
  INSERT INTO leads_fts (
    rowid, name, job_title, company, email, phone, location, industry, experience
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let headers;
let indexes;
let leadCount = 0;
let withEmail = 0;

database.exec("BEGIN");
try {
  for await (const cells of readCsvRows(csvPath)) {
    if (!headers) {
      headers = cells.map((header) => header.trim().toLowerCase().replace(/\s+/g, " "));
      indexes = Object.fromEntries(
        Object.entries(aliases).map(([key, options]) => [
          key,
          headers.findIndex((header) => options.includes(header)),
        ]),
      );
      continue;
    }

    const value = (key) => {
      const index = indexes[key];
      return index >= 0 ? (cells[index] ?? "").trim() : "";
    };

    const experienceData = experienceFromData(value("experienceYears"), value("seniority"));
    const lead = {
      firstName: value("firstName"),
      lastName: value("lastName"),
      jobTitle: value("jobTitle"),
      company: value("company"),
      email: value("email"),
      emailStatus: value("emailStatus"),
      phone: value("phone"),
      website: value("website"),
      linkedinUrl: value("linkedinUrl"),
      industry: value("industry"),
      location: value("location"),
      experience: experienceData.experience,
      experienceBand: experienceData.experienceBand,
      source: value("source") || "Skrapp CSV",
    };

    if (!lead.email && !lead.phone && !lead.company && !lead.firstName && !lead.lastName) continue;

    leadCount += 1;
    if (lead.email) withEmail += 1;
    insertLead.run(
      leadCount, lead.firstName, lead.lastName, lead.jobTitle, lead.company,
      lead.email, lead.emailStatus, lead.phone, lead.website, lead.linkedinUrl,
      lead.industry, lead.location, lead.experience, lead.experienceBand, lead.source,
    );
    insertSearch.run(
      leadCount, `${lead.firstName} ${lead.lastName}`.trim(), lead.jobTitle,
      lead.company, lead.email, lead.phone, lead.location, lead.industry, lead.experience,
    );
  }
  database.exec("COMMIT");
} catch (error) {
  database.exec("ROLLBACK");
  database.close();
  throw error;
}

database.exec(`
  CREATE INDEX leads_company_index ON leads(company COLLATE NOCASE);
  CREATE INDEX leads_industry_index ON leads(industry COLLATE NOCASE);
  CREATE INDEX leads_experience_index ON leads(experience_band);
  CREATE TABLE industries AS
    SELECT industry, COUNT(*) AS lead_count
    FROM leads WHERE industry <> ''
    GROUP BY industry ORDER BY industry COLLATE NOCASE;
  CREATE TABLE stats (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
  CREATE TABLE experience_bands AS
    SELECT experience_band, COUNT(*) AS lead_count
    FROM leads
    GROUP BY experience_band;
`);

const companyCount = database.prepare(
  "SELECT COUNT(DISTINCT company) AS count FROM leads WHERE company <> ''",
).get().count;
const insertStat = database.prepare("INSERT INTO stats (key, value) VALUES (?, ?)");
insertStat.run("total", leadCount);
insertStat.run("withEmail", withEmail);
insertStat.run("companies", companyCount);
insertStat.run("schemaVersion", schemaVersion);
database.exec("PRAGMA optimize; PRAGMA journal_mode = DELETE;");
database.close();

console.log(`Built indexed lead database with ${leadCount.toLocaleString()} leads.`);
