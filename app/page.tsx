"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine, Building2, Check, ChevronDown, Clipboard,
  ExternalLink, FileText, Mail, Phone, Search, SlidersHorizontal, Users, X,
} from "lucide-react";

type Lead = {
  id: number;
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

const aliases: Record<Exclude<keyof Lead, "id">, string[]> = {
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
  source: ["source"],
};

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') {
      field += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function mapCsv(text: string): Lead[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => header.trim().toLowerCase().replace(/\s+/g, " "));
  const findIndex = (key: Exclude<keyof Lead, "id">) =>
    headers.findIndex((header) => aliases[key].includes(header));
  const value = (cells: string[], key: Exclude<keyof Lead, "id">) => {
    const index = findIndex(key);
    return index >= 0 ? (cells[index] ?? "").trim() : "";
  };

  return rows.slice(1).map((cells, index) => ({
    id: index + 1,
    firstName: value(cells, "firstName"),
    lastName: value(cells, "lastName"),
    jobTitle: value(cells, "jobTitle"),
    company: value(cells, "company"),
    email: value(cells, "email"),
    emailStatus: value(cells, "emailStatus"),
    phone: value(cells, "phone"),
    website: value(cells, "website"),
    linkedinUrl: value(cells, "linkedinUrl"),
    industry: value(cells, "industry"),
    location: value(cells, "location"),
    source: value(cells, "source") || "Skrapp CSV",
  })).filter((lead) =>
    lead.email || lead.phone || lead.company || lead.firstName || lead.lastName
  );
}

function escapeCsv(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export default function Home() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [company, setCompany] = useState("All companies");
  const [industry, setIndustry] = useState("All industries");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/leads.csv", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("The leads.csv file could not be loaded.");
        return response.text();
      })
      .then((csv) => setLeads(mapCsv(csv)))
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const companies = useMemo(
    () => [...new Set(leads.map((lead) => lead.company).filter(Boolean))].sort(),
    [leads]
  );
  const industries = useMemo(
    () => [...new Set(leads.map((lead) => lead.industry).filter(Boolean))].sort(),
    [leads]
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return leads.filter((lead) => {
      const searchable = [
        lead.firstName, lead.lastName, lead.jobTitle, lead.company,
        lead.email, lead.phone, lead.location, lead.industry,
      ].join(" ").toLowerCase();
      return (!needle || searchable.includes(needle))
        && (company === "All companies" || lead.company === company)
        && (industry === "All industries" || lead.industry === industry);
    });
  }, [leads, query, company, industry]);

  const hasFilters = query || company !== "All companies" || industry !== "All industries";
  const allVisibleSelected =
    filtered.length > 0 && filtered.every((lead) => selected.has(lead.id));

  function copy(value: string, key: string) {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(""), 1400);
  }

  function toggle(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleVisible() {
    setSelected((current) => {
      const next = new Set(current);
      filtered.forEach((lead) => {
        if (allVisibleSelected) next.delete(lead.id);
        else next.add(lead.id);
      });
      return next;
    });
  }

  function exportLeads() {
    const chosen = selected.size
      ? leads.filter((lead) => selected.has(lead.id))
      : filtered;
    const headers = [
      "First Name", "Last Name", "Job Title", "Company", "Email",
      "Email Status", "Phone", "Website", "LinkedIn", "Industry", "Location", "Source",
    ];
    const rows = chosen.map((lead) => [
      lead.firstName, lead.lastName, lead.jobTitle, lead.company, lead.email,
      lead.emailStatus, lead.phone, lead.website, lead.linkedinUrl,
      lead.industry, lead.location, lead.source,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(`${chosen.length.toLocaleString()} leads exported`);
  }

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark"><Users size={20}/></span>
        <div><strong>Lead Vault</strong><span>Contact workspace</span></div>
      </div>
      <div className="csv-source"><FileText size={16}/> Synced from leads.csv</div>
    </header>

    <section className="workspace">
      <div className="page-title">
        <div><p className="eyebrow">LEAD DIRECTORY</p><h1>Find the right contact, fast.</h1></div>
        <button className="button export" onClick={exportLeads} disabled={!filtered.length}>
          <ArrowDownToLine size={17}/>
          {selected.size ? `Export selected (${selected.size})` : "Export results"}
        </button>
      </div>

      <div className="stats">
        <div><span>Total leads</span><strong>{leads.length.toLocaleString()}</strong></div>
        <div><span>With email</span><strong>{leads.filter((lead) => lead.email).length.toLocaleString()}</strong></div>
        <div><span>Companies</span><strong>{companies.length.toLocaleString()}</strong></div>
        <div><span>Showing now</span><strong>{filtered.length.toLocaleString()}</strong></div>
      </div>

      <section className="lead-panel">
        <div className="toolbar">
          <label className="search">
            <Search size={18}/>
            <input value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, company, title, email…"/>
          </label>
          <label className="select-wrap">
            <Building2 size={16}/>
            <select value={company} onChange={(event) => setCompany(event.target.value)}>
              <option>All companies</option>
              {companies.map((item) => <option key={item}>{item}</option>)}
            </select>
            <ChevronDown size={15}/>
          </label>
          <label className="select-wrap">
            <SlidersHorizontal size={16}/>
            <select value={industry} onChange={(event) => setIndustry(event.target.value)}>
              <option>All industries</option>
              {industries.map((item) => <option key={item}>{item}</option>)}
            </select>
            <ChevronDown size={15}/>
          </label>
          {hasFilters && <button className="clear" onClick={() => {
            setQuery(""); setCompany("All companies"); setIndustry("All industries");
          }}><X size={15}/> Clear</button>}
        </div>

        {error && <div className="error-box">{error}</div>}
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th className="check-cell"><input type="checkbox" checked={allVisibleSelected}
                onChange={toggleVisible} aria-label="Select all visible leads"/></th>
              <th>Contact</th><th>Company</th><th>Location</th>
              <th>Contact details</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, index) =>
                    <tr key={index} className="skeleton-row"><td/><td><span/></td><td><span/></td><td><span/></td><td><span/></td><td/></tr>)
                : filtered.map((lead) => {
                  const name = `${lead.firstName} ${lead.lastName}`.trim() || "Unnamed contact";
                  return <tr key={lead.id} className={selected.has(lead.id) ? "selected-row" : ""}>
                    <td className="check-cell"><input type="checkbox" checked={selected.has(lead.id)}
                      onChange={() => toggle(lead.id)} aria-label={`Select ${name}`}/></td>
                    <td><div className="person">
                      <span className="avatar">{(lead.firstName[0] || lead.lastName[0] || "?").toUpperCase()}</span>
                      <div><strong>{name}</strong><span>{lead.jobTitle || "Title not listed"}</span></div>
                    </div></td>
                    <td><div className="stack"><strong>{lead.company || "—"}</strong><span>{lead.industry || "Industry not listed"}</span></div></td>
                    <td><span className="location">{lead.location || "—"}</span></td>
                    <td><div className="contact-lines">
                      {lead.email
                        ? <button onClick={() => copy(lead.email, `email-${lead.id}`)}>
                            <Mail size={15}/><span>{lead.email}</span>
                            {copied === `email-${lead.id}` ? <Check size={14}/> : <Clipboard size={14}/>}
                          </button>
                        : <span className="muted-line">No email</span>}
                      {lead.phone
                        ? <button onClick={() => copy(lead.phone, `phone-${lead.id}`)}>
                            <Phone size={15}/><span>{lead.phone}</span>
                            {copied === `phone-${lead.id}` ? <Check size={14}/> : <Clipboard size={14}/>}
                          </button>
                        : <span className="muted-line">No phone</span>}
                    </div></td>
                    <td><div className="row-actions">
                      {lead.email && <a href={`mailto:${lead.email}`} aria-label={`Email ${name}`}><Mail size={17}/></a>}
                      {lead.phone && <a href={`tel:${lead.phone}`} aria-label={`Call ${name}`}><Phone size={17}/></a>}
                      {lead.linkedinUrl && <a href={lead.linkedinUrl.startsWith("http") ? lead.linkedinUrl : `https://${lead.linkedinUrl}`}
                        target="_blank" rel="noreferrer" aria-label={`Open ${name} on LinkedIn`}><ExternalLink size={17}/></a>}
                    </div></td>
                  </tr>;
                })}
            </tbody>
          </table>
          {!loading && !filtered.length && <div className="empty-state">
            <span><Search size={24}/></span>
            <h3>{leads.length ? "No leads match these filters" : "No leads found in leads.csv"}</h3>
            <p>{leads.length ? "Try a broader search or clear the filters." : "Replace public/leads.csv with your exported Skrapp file, then redeploy."}</p>
          </div>}
        </div>
        <footer className="panel-footer">
          <span>{filtered.length.toLocaleString()} of {leads.length.toLocaleString()} leads</span>
          {selected.size > 0 && <span className="selection-count">{selected.size} selected</span>}
        </footer>
      </section>
    </section>
    {notice && <div className="toast"><Check size={17}/>{notice}</div>}
  </main>;
}
