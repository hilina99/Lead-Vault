"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine, Building2, Check, ChevronDown, ChevronLeft, ChevronRight,
  Clipboard, ExternalLink, FileText, Mail, Phone, Search, SlidersHorizontal,
  Users, X,
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
  experience: string;
  experienceBand: string;
  source: string;
};

type LeadResponse = {
  leads: Lead[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

type MetaResponse = {
  stats: { total: number; withEmail: number; companies: number };
  industries: Array<{ industry: string; leadCount: number }>;
  experienceBands: Array<{ experienceBand: string; leadCount: number }>;
};

function buildFilterParams(query: string, company: string, industry: string, experience: string) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (company.trim()) params.set("company", company.trim());
  if (industry) params.set("industry", industry);
  if (experience) params.set("experience", experience);
  return params;
}

export default function Home() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState({ total: 0, withEmail: 0, companies: 0 });
  const [industries, setIndustries] = useState<MetaResponse["industries"]>([]);
  const [experienceBands, setExperienceBands] = useState<MetaResponse["experienceBands"]>([]);
  const [loadedRequest, setLoadedRequest] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [company, setCompany] = useState("");
  const [debouncedCompany, setDebouncedCompany] = useState("");
  const [industry, setIndustry] = useState("");
  const [experience, setExperience] = useState("");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [resultCount, setResultCount] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/leads/meta")
      .then((response) => {
        if (!response.ok) throw new Error("Lead totals could not be loaded.");
        return response.json() as Promise<MetaResponse>;
      })
      .then((data) => {
        setStats(data.stats);
        setIndustries(data.industries);
        setExperienceBands(data.experienceBands);
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedCompany(company), 300);
    return () => clearTimeout(timer);
  }, [company]);

  const requestUrl = useMemo(() => {
    const params = buildFilterParams(debouncedQuery, debouncedCompany, industry, experience);
    params.set("page", String(page));
    params.set("pageSize", "50");
    return `/api/leads?${params}`;
  }, [debouncedQuery, debouncedCompany, industry, experience, page]);
  const loading = loadedRequest !== requestUrl;

  useEffect(() => {
    const controller = new AbortController();

    fetch(requestUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("The lead directory could not be loaded.");
        return response.json() as Promise<LeadResponse>;
      })
      .then((data) => {
        setLeads(data.leads);
        setResultCount(data.total);
        setPage(data.page);
        setPageCount(data.pageCount);
        setError("");
        setLoadedRequest(requestUrl);
      })
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") {
          setError(reason.message);
          setLoadedRequest(requestUrl);
        }
      });

    return () => controller.abort();
  }, [requestUrl]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const hasFilters = Boolean(query || company || industry || experience);
  const allVisibleSelected = useMemo(
    () => leads.length > 0 && leads.every((lead) => selected.has(lead.id)),
    [leads, selected],
  );

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
      leads.forEach((lead) => {
        if (allVisibleSelected) next.delete(lead.id);
        else next.add(lead.id);
      });
      return next;
    });
  }

  function exportLeads() {
    const params = selected.size
      ? new URLSearchParams({ ids: [...selected].join(",") })
      : buildFilterParams(debouncedQuery, debouncedCompany, industry, experience);
    const anchor = document.createElement("a");
    anchor.href = `/api/leads/export?${params}`;
    anchor.click();
    setNotice(selected.size
      ? `Exporting ${selected.size.toLocaleString()} selected leads`
      : `Exporting ${resultCount.toLocaleString()} matching leads`);
  }

  function clearFilters() {
    setQuery("");
    setCompany("");
    setIndustry("");
    setExperience("");
    setPage(1);
  }

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark"><Users size={20}/></span>
        <div><strong>Lead Vault</strong><span>Contact workspace</span></div>
      </div>
      <div className="csv-source"><FileText size={16}/> Indexed lead directory</div>
    </header>

    <section className="workspace">
      <div className="page-title">
        <div><p className="eyebrow">LEAD DIRECTORY</p><h1>Find the right contact, fast.</h1></div>
        <button className="button export" onClick={exportLeads} disabled={!resultCount}>
          <ArrowDownToLine size={17}/>
          {selected.size ? `Export selected (${selected.size})` : "Export results"}
        </button>
      </div>

      <div className="stats">
        <div><span>Total leads</span><strong>{stats.total.toLocaleString()}</strong></div>
        <div><span>With email</span><strong>{stats.withEmail.toLocaleString()}</strong></div>
        <div><span>Companies</span><strong>{stats.companies.toLocaleString()}</strong></div>
        <div><span>Matching filters</span><strong>{resultCount.toLocaleString()}</strong></div>
      </div>

      <section className="lead-panel">
        <div className="toolbar">
          <label className="search">
            <Search size={18}/>
            <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }}
              placeholder="Search name, company, title, email…"/>
          </label>
          <label className="filter-input">
            <Building2 size={16}/>
            <input value={company} onChange={(event) => { setCompany(event.target.value); setPage(1); }}
              placeholder="Company starts with…"/>
          </label>
          <label className="select-wrap">
            <SlidersHorizontal size={16}/>
            <select value={industry} onChange={(event) => { setIndustry(event.target.value); setPage(1); }}>
              <option value="">All industries</option>
              {industries.map((item) => <option key={item.industry} value={item.industry}>
                {item.industry} ({item.leadCount.toLocaleString()})
              </option>)}
            </select>
            <ChevronDown size={15}/>
          </label>
          <label className="select-wrap experience-filter">
            <select value={experience} onChange={(event) => { setExperience(event.target.value); setPage(1); }}
              aria-label="Filter by years of experience">
              <option value="">All experience</option>
              {experienceBands.map((item) => <option key={item.experienceBand} value={item.experienceBand}>
                {item.experienceBand === "Not listed" ? "Not listed" : `${item.experienceBand} years`} ({item.leadCount.toLocaleString()})
              </option>)}
            </select>
            <ChevronDown size={15}/>
          </label>
          {hasFilters && <button className="clear" onClick={clearFilters}><X size={15}/> Clear</button>}
        </div>

        {error && <div className="error-box">{error}</div>}
        <div className="table-wrap" aria-busy={loading}>
          <table>
            <thead><tr>
              <th className="check-cell"><input type="checkbox" checked={allVisibleSelected}
                onChange={toggleVisible} aria-label="Select all leads on this page"/></th>
              <th>Contact</th><th>Company</th><th>Location</th><th>Experience</th>
              <th>Contact details</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, index) =>
                    <tr key={index} className="skeleton-row"><td/><td><span/></td><td><span/></td><td><span/></td><td><span/></td><td><span/></td><td/></tr>)
                : leads.map((lead) => {
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
                    <td><span className={`experience-badge ${lead.experienceBand === "Not listed" ? "unknown" : ""}`}>
                      {lead.experience}
                    </span></td>
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
          {!loading && !leads.length && <div className="empty-state">
            <span><Search size={24}/></span>
            <h3>No leads match these filters</h3>
            <p>Try a broader search or clear the filters.</p>
          </div>}
        </div>
        <footer className="panel-footer">
          <span>{resultCount.toLocaleString()} matching leads · 50 loaded at a time</span>
          <div className="footer-actions">
            {selected.size > 0 && <span className="selection-count">{selected.size} selected</span>}
            <div className="pagination">
              <button onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={loading || page <= 1} aria-label="Previous page"><ChevronLeft size={17}/></button>
              <span>Page {page.toLocaleString()} of {pageCount.toLocaleString()}</span>
              <button onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                disabled={loading || page >= pageCount} aria-label="Next page"><ChevronRight size={17}/></button>
            </div>
          </div>
        </footer>
      </section>
    </section>
    {notice && <div className="toast"><Check size={17}/>{notice}</div>}
  </main>;
}
