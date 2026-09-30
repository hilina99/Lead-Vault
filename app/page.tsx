"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, Check, ChevronLeft, ChevronRight, Columns3, Database, Plus, Search, SlidersHorizontal, Users, X } from "lucide-react";
import { numberOperators, operatorLabels, textOperators, type Field, type Filter, type Lead } from "@/lib/lead-types";

type Results = { leads: Lead[]; total: number; page: number; pageCount: number };
type Metadata = { fields: Field[]; stats: { total: number; withEmail: number; companies: number } };
const emptyResults: Results = { leads: [], total: 0, page: 1, pageCount: 1 };

function safeUrl(value: string) {
  try { const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`); return ["http:", "https:"].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
}
function Cell({ field, value }: { field: Field; value: string }) {
  if (!value) return <span className="muted">—</span>;
  if (field.label === "Email") return <a href={`mailto:${encodeURIComponent(value)}`}>{value}</a>;
  if (/linkedin|website|domain|url/i.test(field.label)) {
    const url = safeUrl(value);
    if (url) return <a href={url} target="_blank" rel="noreferrer">{value}</a>;
  }
  if (["Email Status", "Seniority Level (AI Field)", "Buying Role (AI Field)"].includes(field.label)) return <span className={`badge ${value === "Valid" ? "valid" : ""}`}>{value}</span>;
  return <>{value}</>;
}

export default function Home() {
  const [meta, setMeta] = useState<Metadata | null>(null);
  const [metaError, setMetaError] = useState("");
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filters, setFilters] = useState<Filter[]>([]);
  const [match, setMatch] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [results, setResults] = useState<Results>(emptyResults);
  const [loadedUrl, setLoadedUrl] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [hidden, setHidden] = useState<string[]>([]);
  const [modal, setModal] = useState<"filter" | "columns" | null>(null);
  const [draft, setDraft] = useState<Filter>({ field: "", operator: "contains", value: "" });
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [draftError, setDraftError] = useState("");
  const [columnSearch, setColumnSearch] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const fields = meta?.fields ?? [];
  const visibleFields = fields.filter(f => !hidden.includes(f.key));
  const draftField = fields.find(f => f.key === draft.field);
  const noValue = ["is_empty", "is_not_empty"].includes(draft.operator);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/leads/meta", { signal: controller.signal }).then(async r => { if (!r.ok) throw new Error("Could not load field information."); return r.json(); }).then(data => { setMeta(data); setMetaError(""); }).catch(e => { if (e.name !== "AbortError") setMetaError(e.message); });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => { const timer = setTimeout(() => { setDebouncedQuery(query); setPage(1); }, 300); return () => clearTimeout(timer); }, [query]);
  const filterParams = useMemo(() => {
    const params = new URLSearchParams({ filters: JSON.stringify(filters), match });
    if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
    return params.toString();
  }, [filters, match, debouncedQuery]);
  const url = `/api/leads?${filterParams}&page=${page}&pageSize=${pageSize}`;
  const loading = loadedUrl !== url || query !== debouncedQuery;
  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { signal: controller.signal }).then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error || "Could not load leads."); return data; }).then(data => { setResults(data); setError(""); setLoadedUrl(url); }).catch(e => { if (e.name !== "AbortError") { setError(e.message); setLoadedUrl(url); } });
    return () => controller.abort();
  }, [url, retry]);
  useEffect(() => {
    if (modal) dialog.current?.showModal(); else dialog.current?.close();
  }, [modal]);
  useEffect(() => {
    if (modal !== "filter" || !draft.field || draftField?.type !== "text" || noValue) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/leads/meta?${new URLSearchParams({ field: draft.field, q: draft.value })}`, { signal: controller.signal }).then(r => r.ok ? r.json() : { options: [] }).then(data => setOptions(data.options.map((o: { value: string }) => o.value))).catch(() => {});
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [modal, draft.field, draft.value, draftField?.type, noValue]);

  function resetResults() { setPage(1); setSelected(new Set()); }
  function openFilter(index: number | null = null) {
    setEditIndex(index); setOptions([]); setDraftError("");
    setDraft(index === null ? { field: fields[0]?.key ?? "", operator: "contains", value: "" } : { ...filters[index] });
    setModal("filter");
  }
  function saveFilter() {
    if (!draftField) return;
    if (!noValue && !draft.value.trim()) { setDraftError("Enter a value for this condition."); return; }
    if (!noValue && draftField.type === "number" && !Number.isFinite(Number(draft.value))) { setDraftError("Enter a valid number."); return; }
    if (draft.operator === "between" && (!draft.valueTo?.trim() || !Number.isFinite(Number(draft.valueTo)) || Number(draft.valueTo) < Number(draft.value))) { setDraftError("Enter an end value greater than or equal to the start."); return; }
    setFilters(current => editIndex === null ? [...current, draft] : current.map((f, i) => i === editIndex ? draft : f));
    resetResults(); setModal(null);
  }
  function toggle(id: number) {
    setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else if (next.size < 500) next.add(id); return next; });
  }
  const allSelected = results.leads.length > 0 && results.leads.every(l => selected.has(l.id));
  function togglePage() {
    setSelected(current => { const next = new Set(current); results.leads.forEach(l => { if (allSelected) next.delete(l.id); else if (next.size < 500) next.add(l.id); }); return next; });
  }
  function clearFilters() { setQuery(""); setDebouncedQuery(""); setFilters([]); setMatch("all"); resetResults(); }

  return <main className="app-shell">
    <header className="app-header"><Link className="brand" href="/" aria-label="Lead Vault home"><span className="brand-icon"><Database size={22}/></span><span>Lead<span className="brand-light">Vault</span><small>YOUR CONTACT WORKSPACE</small></span></Link><span className="header-note"><span className="status-dot"/> CSV directory</span></header>
    <section className="page-heading"><div><p className="eyebrow">DIRECTORY</p><h1>Your next connection starts here.</h1><p>Explore every detail. Find the people and companies that matter.</p></div><a className={`button primary ${loading || error ? "disabled" : ""}`} aria-disabled={loading || !!error} href={`/api/leads/export?${filterParams}`} onClick={e => { if (loading || error) e.preventDefault(); }}><ArrowDownToLine size={17}/> Export results</a></section>
    <section className="stats" aria-label="Directory statistics">{[["Total contacts", meta?.stats.total, Users], ["Companies", meta?.stats.companies, Database], ["With email", meta?.stats.withEmail, Check], ["Matching results", loading ? undefined : results.total, SlidersHorizontal]].map(([label, count, Icon]) => { const StatIcon = Icon as typeof Users; return <div className="stat" key={String(label)}><span>{String(label)}<StatIcon size={17}/></span><strong>{typeof count === "number" ? count.toLocaleString() : "—"}</strong></div>; })}</section>
    <section className="directory-panel">
      <div className="panel-heading"><div><h2>All contacts <span className="count-pill">{meta?.stats.total.toLocaleString() ?? "…"}</span></h2><p>All {fields.length || "CSV"} fields, one searchable workspace.</p></div><button className="button" disabled={!meta} onClick={() => { setColumnSearch(""); setModal("columns"); }}><Columns3 size={16}/> Columns <span className="small-count">{visibleFields.length}/{fields.length}</span></button></div>
      <div className="toolbar"><label className="search-box"><Search size={18}/><input aria-label="Search all CSV fields" placeholder="Search across all fields…" value={query} maxLength={200} onChange={e => { setQuery(e.target.value); setSelected(new Set()); }}/>{query && <button aria-label="Clear search" onClick={() => setQuery("")}><X size={15}/></button>}</label><button className="button" disabled={!meta || filters.length >= 20} onClick={() => openFilter()}><Plus size={17}/> Add filter</button>{(filters.length > 0 || query) && <button className="text-button" onClick={clearFilters}>Clear all</button>}<span className="toolbar-hint">Choose any field to narrow your search</span></div>
      {filters.length > 0 && <div className="active-filters"><label className="match-label">Match <select aria-label="Filter matching mode" value={match} onChange={e => { setMatch(e.target.value); resetResults(); }}><option value="all">all conditions</option><option value="any">any condition</option></select></label>{filters.map((f, i) => <span className="filter-chip" key={i}><button onClick={() => openFilter(i)}>{fields.find(field => field.key === f.field)?.label} <span>{operatorLabels[f.operator]}</span> {!["is_empty", "is_not_empty"].includes(f.operator) && `${f.value}${f.operator === "between" ? ` – ${f.valueTo}` : ""}`}</button><button aria-label={`Remove ${fields.find(field => field.key === f.field)?.label} filter`} onClick={() => { setFilters(current => current.filter((_, index) => index !== i)); resetResults(); }}><X size={13}/></button></span>)}</div>}
      {selected.size > 0 && <div className="selection-bar"><strong>{selected.size} selected</strong><span>Up to 500 across pages</span><a href={`/api/leads/export?ids=${Array.from(selected).join(",")}`}><ArrowDownToLine size={15}/> Export selected</a><button onClick={() => setSelected(new Set())}>Deselect all</button></div>}
      {(error || metaError) && <div className="error-box" role="alert">{error || metaError}<button onClick={() => setRetry(r => r + 1)}>Retry</button></div>}
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Contacts table; scroll horizontally to see all fields" aria-busy={loading}>
        <table><thead><tr><th className="check-cell"><input aria-label="Select this page" type="checkbox" disabled={loading || !!error} checked={allSelected} onChange={togglePage}/></th>{visibleFields.map(f => <th key={f.key}>{f.label}</th>)}</tr></thead><tbody>
          {loading ? Array.from({length: 8}, (_, i) => <tr key={i} className="skeleton-row"><td/><td colSpan={Math.max(1, visibleFields.length)}><span/></td></tr>) : !error && results.leads.map(lead => <tr key={lead.id} className={selected.has(lead.id) ? "selected-row" : ""}><td className="check-cell"><input type="checkbox" aria-label={`Select contact ${lead.id}`} checked={selected.has(lead.id)} disabled={!selected.has(lead.id) && selected.size >= 500} onChange={() => toggle(lead.id)}/></td>{visibleFields.map(f => <td key={f.key} title={String(lead[f.key] ?? "")}><Cell field={f} value={String(lead[f.key] ?? "")}/></td>)}</tr>)}
        </tbody></table>
      </div>
      {!loading && !error && results.total === 0 && <div className="empty-state"><Search size={30}/><h3>No contacts found</h3><p>Try a different condition or a broader search.</p><button className="button" onClick={clearFilters}>Clear filters</button></div>}
      <footer className="table-footer"><span>{loading ? "Loading contacts…" : `${results.total ? (results.page - 1) * pageSize + 1 : 0}–${Math.min(results.page * pageSize, results.total)} of ${results.total.toLocaleString()} contacts`}<small>Scroll sideways to explore every column</small></span><div className="pagination"><label>Rows <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}><option>25</option><option>50</option><option>100</option></select></label><button className="icon-button" aria-label="Previous page" disabled={loading || results.page <= 1} onClick={() => setPage(results.page - 1)}><ChevronLeft size={18}/></button><span>{results.page} / {results.pageCount}</span><button className="icon-button" aria-label="Next page" disabled={loading || results.page >= results.pageCount} onClick={() => setPage(results.page + 1)}><ChevronRight size={18}/></button></div></footer>
    </section>
    <p className="bottom-note">Original CSV values retained. Exports include every column.</p>
    <dialog ref={dialog} onCancel={() => setModal(null)} onClick={e => { if (e.target === dialog.current) setModal(null); }} aria-labelledby="dialog-title">
      <div className="dialog-content"><header className="dialog-header"><div><p className="eyebrow">PERSONALIZE YOUR VIEW</p><h2 id="dialog-title">{modal === "columns" ? "Choose your columns" : editIndex === null ? "Add a filter" : "Edit filter"}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={() => setModal(null)}><X size={20}/></button></header>
      {modal === "columns" ? <><p className="dialog-description">All fields are shown by default. Hide columns to focus your view.</p><input className="full-input" placeholder="Find a column…" aria-label="Find a column" value={columnSearch} onChange={e => setColumnSearch(e.target.value)}/><div className="column-actions"><span>{visibleFields.length} of {fields.length} visible</span><button className="text-button" onClick={() => setHidden([])}>Show all</button></div><div className="column-list">{fields.filter(f => f.label.toLowerCase().includes(columnSearch.toLowerCase())).map(f => <label key={f.key}><input type="checkbox" checked={!hidden.includes(f.key)} disabled={!hidden.includes(f.key) && visibleFields.length === 1} onChange={() => setHidden(current => current.includes(f.key) ? current.filter(key => key !== f.key) : [...current, f.key])}/><span>{f.label}</span><small>{f.type === "number" ? "123" : "Aa"}</small></label>)}</div><div className="dialog-footer"><button className="button primary" onClick={() => setModal(null)}>Done</button></div></> : <form onSubmit={e => { e.preventDefault(); saveFilter(); }}><p className="dialog-description">Choose a CSV field and tell us what to match.</p><label className="form-label">Field<select autoFocus value={draft.field} onChange={e => { const field = fields.find(f => f.key === e.target.value); setDraft({ field: e.target.value, operator: field?.type === "number" ? "equals" : "contains", value: "" }); setOptions([]); setDraftError(""); }}>{fields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</select></label><label className="form-label">Condition<select value={draft.operator} onChange={e => { setDraft({...draft, operator:e.target.value}); setDraftError(""); }}>{(draftField?.type === "number" ? numberOperators : textOperators).map(op => <option key={op} value={op}>{operatorLabels[op]}</option>)}</select></label>{!noValue && <div className="value-row"><label className="form-label">{draft.operator === "between" ? "From" : "Value"}<input required maxLength={500} type={draftField?.type === "number" ? "number" : "text"} step="any" list={draftField?.type === "text" ? "field-values" : undefined} placeholder={draftField?.type === "number" ? "Enter a number" : "Type or choose a value…"} value={draft.value} onChange={e => setDraft({...draft, value:e.target.value})}/></label>{draft.operator === "between" && <label className="form-label">To<input required type="number" step="any" value={draft.valueTo ?? ""} onChange={e => setDraft({...draft, valueTo:e.target.value})}/></label>}</div>}<datalist id="field-values">{options.map(value => <option key={value} value={value}/>)}</datalist>{draftError && <p className="form-error" role="alert">{draftError}</p>}<div className="dialog-footer"><button className="button" type="button" onClick={() => setModal(null)}>Cancel</button><button className="button primary" type="submit">{editIndex === null ? "Add filter" : "Save filter"}</button></div></form>}
      </div>
    </dialog>
  </main>;
}

// "use client";

// import { useEffect, useMemo, useState } from "react";
// import {
//   ArrowDownToLine, Building2, Check, ChevronDown, ChevronLeft, ChevronRight,
//   Clipboard, ExternalLink, FileText, Mail, Phone, Search, SlidersHorizontal,
//   Users, X,
// } from "lucide-react";

// type Lead = {
//   id: number;
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
//   experienceBand: string;
//   source: string;
// };

// type LeadResponse = {
//   leads: Lead[];
//   total: number;
//   page: number;
//   pageSize: number;
//   pageCount: number;
// };

// type MetaResponse = {
//   stats: { total: number; withEmail: number; companies: number };
//   industries: Array<{ industry: string; leadCount: number }>;
//   experienceBands: Array<{ experienceBand: string; leadCount: number }>;
// };

// function buildFilterParams(query: string, company: string, industry: string, experience: string) {
//   const params = new URLSearchParams();
//   if (query.trim()) params.set("q", query.trim());
//   if (company.trim()) params.set("company", company.trim());
//   if (industry) params.set("industry", industry);
//   if (experience) params.set("experience", experience);
//   return params;
// }

// export default function Home() {
//   const [leads, setLeads] = useState<Lead[]>([]);
//   const [stats, setStats] = useState({ total: 0, withEmail: 0, companies: 0 });
//   const [industries, setIndustries] = useState<MetaResponse["industries"]>([]);
//   const [experienceBands, setExperienceBands] = useState<MetaResponse["experienceBands"]>([]);
//   const [loadedRequest, setLoadedRequest] = useState("");
//   const [error, setError] = useState("");
//   const [query, setQuery] = useState("");
//   const [debouncedQuery, setDebouncedQuery] = useState("");
//   const [company, setCompany] = useState("");
//   const [debouncedCompany, setDebouncedCompany] = useState("");
//   const [industry, setIndustry] = useState("");
//   const [experience, setExperience] = useState("");
//   const [page, setPage] = useState(1);
//   const [pageCount, setPageCount] = useState(1);
//   const [resultCount, setResultCount] = useState(0);
//   const [selected, setSelected] = useState<Set<number>>(new Set());
//   const [copied, setCopied] = useState("");
//   const [notice, setNotice] = useState("");

//   useEffect(() => {
//     fetch("/api/leads/meta")
//       .then((response) => {
//         if (!response.ok) throw new Error("Lead totals could not be loaded.");
//         return response.json() as Promise<MetaResponse>;
//       })
//       .then((data) => {
//         setStats(data.stats);
//         setIndustries(data.industries);
//         setExperienceBands(data.experienceBands);
//       })
//       .catch((reason: Error) => setError(reason.message));
//   }, []);

//   useEffect(() => {
//     const timer = setTimeout(() => setDebouncedQuery(query), 300);
//     return () => clearTimeout(timer);
//   }, [query]);

//   useEffect(() => {
//     const timer = setTimeout(() => setDebouncedCompany(company), 300);
//     return () => clearTimeout(timer);
//   }, [company]);

//   const requestUrl = useMemo(() => {
//     const params = buildFilterParams(debouncedQuery, debouncedCompany, industry, experience);
//     params.set("page", String(page));
//     params.set("pageSize", "50");
//     return `/api/leads?${params}`;
//   }, [debouncedQuery, debouncedCompany, industry, experience, page]);
//   const loading = loadedRequest !== requestUrl;

//   useEffect(() => {
//     const controller = new AbortController();

//     fetch(requestUrl, { signal: controller.signal })
//       .then((response) => {
//         if (!response.ok) throw new Error("The lead directory could not be loaded.");
//         return response.json() as Promise<LeadResponse>;
//       })
//       .then((data) => {
//         setLeads(data.leads);
//         setResultCount(data.total);
//         setPage(data.page);
//         setPageCount(data.pageCount);
//         setError("");
//         setLoadedRequest(requestUrl);
//       })
//       .catch((reason: Error) => {
//         if (reason.name !== "AbortError") {
//           setError(reason.message);
//           setLoadedRequest(requestUrl);
//         }
//       });

//     return () => controller.abort();
//   }, [requestUrl]);

//   useEffect(() => {
//     if (!notice) return;
//     const timer = setTimeout(() => setNotice(""), 3000);
//     return () => clearTimeout(timer);
//   }, [notice]);

//   const hasFilters = Boolean(query || company || industry || experience);
//   const allVisibleSelected = useMemo(
//     () => leads.length > 0 && leads.every((lead) => selected.has(lead.id)),
//     [leads, selected],
//   );

//   function copy(value: string, key: string) {
//     navigator.clipboard.writeText(value);
//     setCopied(key);
//     setTimeout(() => setCopied(""), 1400);
//   }

//   function toggle(id: number) {
//     setSelected((current) => {
//       const next = new Set(current);
//       if (next.has(id)) next.delete(id);
//       else next.add(id);
//       return next;
//     });
//   }

//   function toggleVisible() {
//     setSelected((current) => {
//       const next = new Set(current);
//       leads.forEach((lead) => {
//         if (allVisibleSelected) next.delete(lead.id);
//         else next.add(lead.id);
//       });
//       return next;
//     });
//   }

//   function exportLeads() {
//     const params = selected.size
//       ? new URLSearchParams({ ids: [...selected].join(",") })
//       : buildFilterParams(debouncedQuery, debouncedCompany, industry, experience);
//     const anchor = document.createElement("a");
//     anchor.href = `/api/leads/export?${params}`;
//     anchor.click();
//     setNotice(selected.size
//       ? `Exporting ${selected.size.toLocaleString()} selected leads`
//       : `Exporting ${resultCount.toLocaleString()} matching leads`);
//   }

//   function clearFilters() {
//     setQuery("");
//     setCompany("");
//     setIndustry("");
//     setExperience("");
//     setPage(1);
//   }

//   return <main className="app-shell">
//     <header className="topbar">
//       <div className="brand">
//         <span className="brand-mark"><Users size={20}/></span>
//         <div><strong>Lead Vault</strong><span>Contact workspace</span></div>
//       </div>
//       <div className="csv-source"><FileText size={16}/> Indexed lead directory</div>
//     </header>

//     <section className="workspace">
//       <div className="page-title">
//         <div><p className="eyebrow">LEAD DIRECTORY</p><h1>Find the right contact, fast.</h1></div>
//         <button className="button export" onClick={exportLeads} disabled={!resultCount}>
//           <ArrowDownToLine size={17}/>
//           {selected.size ? `Export selected (${selected.size})` : "Export results"}
//         </button>
//       </div>

//       <div className="stats">
//         <div><span>Total leads</span><strong>{stats.total.toLocaleString()}</strong></div>
//         <div><span>With email</span><strong>{stats.withEmail.toLocaleString()}</strong></div>
//         <div><span>Companies</span><strong>{stats.companies.toLocaleString()}</strong></div>
//         <div><span>Matching filters</span><strong>{resultCount.toLocaleString()}</strong></div>
//       </div>

//       <section className="lead-panel">
//         <div className="toolbar">
//           <label className="search">
//             <Search size={18}/>
//             <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }}
//               placeholder="Search name, company, title, email…"/>
//           </label>
//           <label className="filter-input">
//             <Building2 size={16}/>
//             <input value={company} onChange={(event) => { setCompany(event.target.value); setPage(1); }}
//               placeholder="Company starts with…"/>
//           </label>
//           <label className="select-wrap">
//             <SlidersHorizontal size={16}/>
//             <select value={industry} onChange={(event) => { setIndustry(event.target.value); setPage(1); }}>
//               <option value="">All industries</option>
//               {industries.map((item) => <option key={item.industry} value={item.industry}>
//                 {item.industry} ({item.leadCount.toLocaleString()})
//               </option>)}
//             </select>
//             <ChevronDown size={15}/>
//           </label>
//           <label className="select-wrap experience-filter">
//             <select value={experience} onChange={(event) => { setExperience(event.target.value); setPage(1); }}
//               aria-label="Filter by years of experience">
//               <option value="">All experience</option>
//               {experienceBands.map((item) => <option key={item.experienceBand} value={item.experienceBand}>
//                 {item.experienceBand === "Not listed" ? "Not listed" : `${item.experienceBand} years`} ({item.leadCount.toLocaleString()})
//               </option>)}
//             </select>
//             <ChevronDown size={15}/>
//           </label>
//           {hasFilters && <button className="clear" onClick={clearFilters}><X size={15}/> Clear</button>}
//         </div>

//         {error && <div className="error-box">{error}</div>}
//         <div className="table-wrap" aria-busy={loading}>
//           <table>
//             <thead><tr>
//               <th className="check-cell"><input type="checkbox" checked={allVisibleSelected}
//                 onChange={toggleVisible} aria-label="Select all leads on this page"/></th>
//               <th>Contact</th><th>Company</th><th>Location</th><th>Experience</th>
//               <th>Contact details</th><th>Actions</th>
//             </tr></thead>
//             <tbody>
//               {loading
//                 ? Array.from({ length: 8 }).map((_, index) =>
//                     <tr key={index} className="skeleton-row"><td/><td><span/></td><td><span/></td><td><span/></td><td><span/></td><td><span/></td><td/></tr>)
//                 : leads.map((lead) => {
//                   const name = `${lead.firstName} ${lead.lastName}`.trim() || "Unnamed contact";
//                   return <tr key={lead.id} className={selected.has(lead.id) ? "selected-row" : ""}>
//                     <td className="check-cell"><input type="checkbox" checked={selected.has(lead.id)}
//                       onChange={() => toggle(lead.id)} aria-label={`Select ${name}`}/></td>
//                     <td><div className="person">
//                       <span className="avatar">{(lead.firstName[0] || lead.lastName[0] || "?").toUpperCase()}</span>
//                       <div><strong>{name}</strong><span>{lead.jobTitle || "Title not listed"}</span></div>
//                     </div></td>
//                     <td><div className="stack"><strong>{lead.company || "—"}</strong><span>{lead.industry || "Industry not listed"}</span></div></td>
//                     <td><span className="location">{lead.location || "—"}</span></td>
//                     <td><span className={`experience-badge ${lead.experienceBand === "Not listed" ? "unknown" : ""}`}>
//                       {lead.experience}
//                     </span></td>
//                     <td><div className="contact-lines">
//                       {lead.email
//                         ? <button onClick={() => copy(lead.email, `email-${lead.id}`)}>
//                             <Mail size={15}/><span>{lead.email}</span>
//                             {copied === `email-${lead.id}` ? <Check size={14}/> : <Clipboard size={14}/>}
//                           </button>
//                         : <span className="muted-line">No email</span>}
//                       {lead.phone
//                         ? <button onClick={() => copy(lead.phone, `phone-${lead.id}`)}>
//                             <Phone size={15}/><span>{lead.phone}</span>
//                             {copied === `phone-${lead.id}` ? <Check size={14}/> : <Clipboard size={14}/>}
//                           </button>
//                         : <span className="muted-line">No phone</span>}
//                     </div></td>
//                     <td><div className="row-actions">
//                       {lead.email && <a href={`mailto:${lead.email}`} aria-label={`Email ${name}`}><Mail size={17}/></a>}
//                       {lead.phone && <a href={`tel:${lead.phone}`} aria-label={`Call ${name}`}><Phone size={17}/></a>}
//                       {lead.linkedinUrl && <a href={lead.linkedinUrl.startsWith("http") ? lead.linkedinUrl : `https://${lead.linkedinUrl}`}
//                         target="_blank" rel="noreferrer" aria-label={`Open ${name} on LinkedIn`}><ExternalLink size={17}/></a>}
//                     </div></td>
//                   </tr>;
//                 })}
//             </tbody>
//           </table>
//           {!loading && !leads.length && <div className="empty-state">
//             <span><Search size={24}/></span>
//             <h3>No leads match these filters</h3>
//             <p>Try a broader search or clear the filters.</p>
//           </div>}
//         </div>
//         <footer className="panel-footer">
//           <span>{resultCount.toLocaleString()} matching leads · 50 loaded at a time</span>
//           <div className="footer-actions">
//             {selected.size > 0 && <span className="selection-count">{selected.size} selected</span>}
//             <div className="pagination">
//               <button onClick={() => setPage((current) => Math.max(1, current - 1))}
//                 disabled={loading || page <= 1} aria-label="Previous page"><ChevronLeft size={17}/></button>
//               <span>Page {page.toLocaleString()} of {pageCount.toLocaleString()}</span>
//               <button onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
//                 disabled={loading || page >= pageCount} aria-label="Next page"><ChevronRight size={17}/></button>
//             </div>
//           </div>
//         </footer>
//       </section>
//     </section>
//     {notice && <div className="toast"><Check size={17}/>{notice}</div>}
//   </main>;
// }
