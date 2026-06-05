"use strict";

const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);

// ---- DOM refs ----
const loginView = document.getElementById("login-view");
const loginEmail = document.getElementById("login-email");
const loginBtn = document.getElementById("login-btn");
const loginStatus = document.getElementById("login-status");

const appShell = document.getElementById("app-shell");
const userEmailEl = document.getElementById("user-email");
const signoutBtn = document.getElementById("signout-btn");
const viewTitle = document.getElementById("view-title");
const tabs = Array.from(document.querySelectorAll(".tab"));
const dashboardView = document.getElementById("dashboard-view");
const auditView = document.getElementById("audit-view");

const kpisEl = document.getElementById("kpis");
const attentionEl = document.getElementById("attention");
const attentionCount = document.getElementById("attention-count");
const activityEl = document.getElementById("activity");
const refreshBtn = document.getElementById("refresh-btn");
const dashFilterNote = document.getElementById("dash-filter-note");

const actionsView = document.getElementById("actions-view");
const actionsList = document.getElementById("actions-list");
const actionsCount = document.getElementById("actions-count");
const actionsRefresh = document.getElementById("actions-refresh");
const actionsTabBadge = document.getElementById("actions-tab-badge");

const insightsView = document.getElementById("insights-view");
const insightsRefresh = document.getElementById("insights-refresh");
const insightsKpis = document.getElementById("insights-kpis");

const accountSelect = document.getElementById("account-select");
const tankSelect = document.getElementById("tank-select");
const tankSearch = document.getElementById("tank-search");
const tankFilterNote = document.getElementById("tank-filter-note");
const visitView = document.getElementById("visit-view");
const entryForm = document.getElementById("entry-form");
const newVisitBtn = document.getElementById("new-visit-btn");
const cancelVisitBtn = document.getElementById("cancel-visit-btn");
const tankSummary = document.getElementById("tank-summary");
const auditorDisplay = document.getElementById("auditor-display");
const tankFields = document.getElementById("tank-fields");
const wellsEl = document.getElementById("wells");
const wellsCount = document.getElementById("wells-count");
const generalNotes = document.getElementById("general-notes");
const saveBtn = document.getElementById("save-btn");
const formStatus = document.getElementById("form-status");
const historyEl = document.getElementById("history");
const historyCount = document.getElementById("history-count");
const toastEl = document.getElementById("toast");

const filterBtn = document.getElementById("filter-btn");
const filterBadge = document.getElementById("filter-badge");
const filterDrawer = document.getElementById("filter-drawer");
const filterClear = document.getElementById("filter-clear");
const filterGroups = document.getElementById("filter-groups");
const filterCount = document.getElementById("filter-count");

const syncBtn = document.getElementById("sync-btn");
const syncBadge = document.getElementById("sync-badge");
const syncDrawer = document.getElementById("sync-drawer");
const syncStatus = document.getElementById("sync-status");
const syncNow = document.getElementById("sync-now");
const syncList = document.getElementById("sync-list");
const offlineBanner = document.getElementById("offline-banner");

// ---- State ----
let currentUser = null;
let currentTank = null;
let currentWellsById = {};
let wired = false;
const STORAGE_KEY = "audit_user_email";
const TOGGLE_VALUES = ["pass", "fail", "na"];
const TOGGLE_LABELS = { pass: "Pass", fail: "Fail", na: "N/A" };
const WELL_ITEM_COUNT = window.WELL_SECTIONS.reduce((n, s) => n + s.items.length, 0);

// Catalog cache (loaded once on login)
let accountsList = [], allTanks = [], allWells = [];
let tankById = {}, wellsByTank = {}, assetTypesByTank = {};
let filterOptions = { state: [], location: [], product: [], asset_type: [] };
let selectOptions = {}; // dropdown options for select-type questions, e.g. product list
const filters = { state: new Set(), location: new Set(), product: new Set(), asset_type: new Set() };
let tankSearchVal = "";
const FILTER_GROUPS = [
  { key: "state", title: "State" },
  { key: "location", title: "Area" },
  { key: "product", title: "Product" },
  { key: "asset_type", title: "Asset type" },
];

// ---------------------------------------------------------------------------
// Gate + theme + tabs + listeners
// ---------------------------------------------------------------------------
loginBtn.addEventListener("click", enterApp);
loginEmail.addEventListener("keydown", (e) => { if (e.key === "Enter") enterApp(); });
signoutBtn.addEventListener("click", signOut);
refreshBtn.addEventListener("click", loadDashboard);
actionsRefresh.addEventListener("click", loadActions);
insightsRefresh.addEventListener("click", loadInsights);
tabs.forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));

accountSelect.addEventListener("change", onAccountChange);
tankSelect.addEventListener("change", () => selectTank(tankSelect.value));
tankSearch.addEventListener("input", () => { tankSearchVal = tankSearch.value.trim().toLowerCase(); populateTankSelect(); });
saveBtn.addEventListener("click", saveVisit);
newVisitBtn.addEventListener("click", showEntryForm);
cancelVisitBtn.addEventListener("click", showDetails);
visitView.addEventListener("click", onVisitClick);
visitView.addEventListener("input", onVisitInput);

filterBtn.addEventListener("click", () => { filterDrawer.hidden = false; updateFilterCount(); });
filterDrawer.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) filterDrawer.hidden = true; });
filterClear.addEventListener("click", clearFilters);
filterGroups.addEventListener("click", onFilterChip);

syncBtn.addEventListener("click", () => { syncDrawer.hidden = false; renderSyncList(); });
syncDrawer.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) syncDrawer.hidden = true; });
syncNow.addEventListener("click", flushQueue);
window.addEventListener("online", () => { toast("Back online — syncing…"); refreshSync(); flushQueue(); });
window.addEventListener("offline", () => { toast("You're offline — saves stay on this device"); refreshSync(); });
// Self-healing retry: while anything is queued, keep trying in the background so
// the user never has to sync manually — even on flaky/low signal.
setInterval(async () => {
  if (!navigator.onLine) return;
  let n = 0; try { n = await window.AuditDB.count(); } catch (e) {}
  if (n > 0) flushQueue();
}, 30000);

const themeBtn = document.getElementById("theme-btn");
const SUN_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem("audit_theme", theme); } catch (e) {}
  themeBtn.innerHTML = theme === "dark" ? SUN_ICON : MOON_ICON;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#0f141a" : "#f1f4f8");
}
applyTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
themeBtn.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light"));

restoreSession();

async function restoreSession() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return showLoggedOut();
  // Offline (or a flaky check): trust the previously-validated email so the
  // auditor can keep working in the field. It was only stored after a prior
  // successful online check.
  if (!navigator.onLine) return showLoggedIn(saved);
  try {
    const { data: allowed, error } = await sb.rpc("is_email_allowed", { check_email: saved });
    if (error) return showLoggedIn(saved);
    if (allowed) return showLoggedIn(saved);
    localStorage.removeItem(STORAGE_KEY);
    showLoggedOut();
  } catch (e) {
    showLoggedIn(saved);
  }
}

async function enterApp() {
  const email = loginEmail.value.trim();
  if (!email) { loginStatus.textContent = "Enter your email."; return; }
  if (!navigator.onLine) { loginStatus.textContent = "You're offline. Connect to the internet once to sign in the first time."; return; }
  loginBtn.disabled = true;
  loginStatus.textContent = "Checking…";
  let allowed, error;
  try { ({ data: allowed, error } = await sb.rpc("is_email_allowed", { check_email: email })); }
  catch (e) { error = e; }
  loginBtn.disabled = false;
  if (error) { loginStatus.textContent = ""; return fail("Could not verify email", error); }
  if (!allowed) { loginStatus.textContent = "That email isn't on the authorized list."; return; }
  localStorage.setItem(STORAGE_KEY, email);
  loginStatus.textContent = "";
  showLoggedIn(email);
}

function signOut() {
  localStorage.removeItem(STORAGE_KEY);
  loginEmail.value = "";
  loginStatus.textContent = "";
  showLoggedOut();
}

async function showLoggedIn(email) {
  currentUser = { email };
  loginView.hidden = true;
  appShell.hidden = false;
  userEmailEl.textContent = email;
  auditorDisplay.textContent = email;
  if (!wired) { wired = true; await loadCatalog(); }
  refreshSync();
  flushQueue();
  switchTab("dashboard");
}

function showLoggedOut() {
  currentUser = null;
  appShell.hidden = true;
  loginView.hidden = false;
}

function switchTab(name) {
  tabs.forEach((t) => t.setAttribute("aria-current", t.dataset.tab === name ? "true" : "false"));
  dashboardView.hidden = name !== "dashboard";
  auditView.hidden = name !== "audit";
  actionsView.hidden = name !== "actions";
  insightsView.hidden = name !== "insights";
  viewTitle.textContent = name === "dashboard" ? "Dashboard" : name === "audit" ? "Audit" : name === "actions" ? "Action Items" : "Insights";
  window.scrollTo({ top: 0 });
  if (name === "dashboard") loadDashboard();
  else if (name === "actions") loadActions();
  else if (name === "insights") loadInsights();
}

// ---------------------------------------------------------------------------
// Catalog + filters
// ---------------------------------------------------------------------------
async function loadCatalog() {
  // Cache-first: apply the saved tank list instantly so the app works offline
  // and never blocks on the network. Then refresh in the background if online.
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem("catalog_cache") || "null"); } catch (e) {}
  if (cached) {
    applyCatalog(cached);
    if (navigator.onLine) refreshCatalog();
    return;
  }
  if (navigator.onLine) {
    const fresh = await fetchCatalog();
    if (fresh) { cacheCatalog(fresh); applyCatalog(fresh); return; }
  }
  fail("Couldn't load the tank list. Connect to the internet once to download it.");
}

async function fetchCatalog() {
  try {
    const [accRes, tankRes, wellRes] = await Promise.all([
      sb.from("accounts").select("id,name").order("name"),
      sb.from("tanks").select("id,account_id,label,state,location,product").order("label"),
      sb.from("wells").select("id,tank_id,name,asset_type"),
    ]);
    if (accRes.error || tankRes.error || wellRes.error) return null;
    return { accounts: accRes.data, tanks: tankRes.data, wells: wellRes.data };
  } catch (e) { return null; }
}
function cacheCatalog(data) { try { localStorage.setItem("catalog_cache", JSON.stringify(data)); } catch (e) {} }
async function refreshCatalog() { const fresh = await fetchCatalog(); if (fresh) { cacheCatalog(fresh); applyCatalog(fresh); } }

function applyCatalog(data) {
  accountsList = data.accounts; allTanks = data.tanks; allWells = data.wells;
  tankById = Object.fromEntries(allTanks.map((t) => [t.id, t]));
  wellsByTank = {}; assetTypesByTank = {};
  for (const w of allWells) {
    (wellsByTank[w.tank_id] = wellsByTank[w.tank_id] || []).push(w);
    (assetTypesByTank[w.tank_id] = assetTypesByTank[w.tank_id] || new Set()).add(w.asset_type);
  }
  for (const id in wellsByTank) wellsByTank[id].sort((a, b) => a.name.localeCompare(b.name));

  const distinct = (arr) => [...new Set(arr.filter(Boolean))].sort();
  filterOptions = {
    state: distinct(allTanks.map((t) => t.state)),
    location: distinct(allTanks.map((t) => t.location)),
    product: distinct(allTanks.map((t) => t.product)),
    asset_type: distinct(allWells.map((w) => w.asset_type)),
  };
  selectOptions = { chemical_product_name: filterOptions.product };

  const prevAcct = accountSelect.value;
  accountSelect.innerHTML = '<option value="">Select an account…</option>' + accountsList.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join("");
  if (prevAcct && accountsList.some((a) => a.id === prevAcct)) accountSelect.value = prevAcct;
  else if (accountsList.length === 1) accountSelect.value = accountsList[0].id;
  renderFilterGroups();
  populateTankSelect();
}

function renderFilterGroups() {
  filterGroups.innerHTML = FILTER_GROUPS.map((g) => {
    const chips = filterOptions[g.key].map((v) =>
      `<button type="button" class="fchip" data-group="${g.key}" data-value="${esc(v)}" aria-pressed="${filters[g.key].has(v) ? "true" : "false"}">${esc(v)}</button>`
    ).join("");
    return `<div class="filter-group"><h4>${g.title}</h4><div class="filter-chips">${chips}</div></div>`;
  }).join("");
}

function onFilterChip(e) {
  const chip = e.target.closest(".fchip");
  if (!chip) return;
  const set = filters[chip.dataset.group];
  const v = chip.dataset.value;
  if (set.has(v)) set.delete(v); else set.add(v);
  chip.setAttribute("aria-pressed", set.has(v) ? "true" : "false");
  onFiltersChanged();
}

function clearFilters() {
  for (const k in filters) filters[k].clear();
  filterGroups.querySelectorAll(".fchip").forEach((c) => c.setAttribute("aria-pressed", "false"));
  onFiltersChanged();
}

function onFiltersChanged() {
  updateFilterBadge();
  updateFilterCount();
  populateTankSelect();
  if (!dashboardView.hidden) loadDashboard();
  if (!actionsView.hidden) loadActions();
}

function activeFilterCount() {
  return Object.values(filters).reduce((n, s) => n + s.size, 0);
}
function updateFilterBadge() {
  filterBadge.hidden = activeFilterCount() === 0;
}
function updateFilterCount() {
  const n = allTanks.filter(tankPasses).length;
  filterCount.textContent = activeFilterCount() ? `${n} of ${allTanks.length} tanks match` : `${allTanks.length} tanks`;
}

function tankPasses(t) {
  if (filters.state.size && !filters.state.has(t.state)) return false;
  if (filters.location.size && !filters.location.has(t.location)) return false;
  if (filters.product.size && !filters.product.has(t.product)) return false;
  if (filters.asset_type.size) {
    const types = assetTypesByTank[t.id];
    if (!types || ![...filters.asset_type].some((x) => types.has(x))) return false;
  }
  return true;
}

function populateTankSelect() {
  const accountId = accountSelect.value;
  if (!accountId) {
    tankSelect.disabled = true;
    tankSelect.innerHTML = '<option value="">Select an account first</option>';
    tankFilterNote.textContent = "";
    return;
  }
  const forAccount = allTanks.filter((t) => t.account_id === accountId);
  const list = forAccount.filter((t) => tankPasses(t) && (!tankSearchVal || t.label.toLowerCase().includes(tankSearchVal)));
  tankSelect.disabled = list.length === 0;
  tankSelect.innerHTML =
    `<option value="">${list.length ? "Select a tank…" : "No tanks match"}</option>` +
    list.map((t) => `<option value="${t.id}">${esc(t.label)}</option>`).join("");
  if (currentTank && list.some((t) => t.id === currentTank.id)) tankSelect.value = currentTank.id;
  const filtered = list.length !== forAccount.length;
  tankFilterNote.textContent = `Showing ${list.length} of ${forAccount.length} tanks${filtered ? " (filtered)" : ""}`;
}

function onAccountChange() {
  currentTank = null;
  visitView.hidden = true;
  populateTankSelect();
}

// ---------------------------------------------------------------------------
// Tank selection -> visit form
// ---------------------------------------------------------------------------
function selectTank(tankId) {
  if (!tankId) { currentTank = null; visitView.hidden = true; return; }
  const tank = tankById[tankId];
  if (!tank) return;
  currentTank = { id: tank.id, label: tank.label };
  if (![...tankSelect.options].some((o) => o.value === tankId)) {
    const opt = document.createElement("option");
    opt.value = tankId; opt.textContent = tank.label;
    tankSelect.appendChild(opt);
  }
  tankSelect.value = tankId;
  tankSummary.textContent = tank.label;

  const wells = wellsByTank[tankId] || [];
  currentWellsById = Object.fromEntries(wells.map((w) => [w.id, w.name]));
  tankFields.innerHTML = window.TANK_SECTIONS.map((s) => renderSection(s, "tank")).join("");
  setProductDefault();
  renderWells(wells);
  wellsCount.textContent = wells.length ? `${wells.length} well${wells.length === 1 ? "" : "s"}` : "no wells";
  generalNotes.value = "";
  formStatus.textContent = "";
  restoreDraft();
  visitView.hidden = false;
  showDetails();
  loadHistory();
}

// Details-first: a selected tank shows its history; the entry form opens on demand.
function hasDraft() {
  try { return !!(currentTank && localStorage.getItem("draft_" + currentTank.id)); } catch (e) { return false; }
}
function showDetails() {
  entryForm.hidden = true;
  newVisitBtn.hidden = false;
  newVisitBtn.textContent = hasDraft() ? "Resume draft" : "+ New visit";
  newVisitBtn.classList.toggle("resume", hasDraft());
}
function showEntryForm() {
  entryForm.hidden = false;
  newVisitBtn.hidden = true;
  formStatus.textContent = hasDraft() ? "Draft restored" : "";
  entryForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderWells(wells) {
  const first = wells[0];
  wellsEl.innerHTML = wells.map((w, i) => renderWellCard(w, i === 0, wells.length, first)).join("");
  wellsEl.querySelectorAll(".well-card").forEach(updateWellStatus);
}

function renderWellCard(w, open, total, first) {
  let copy = "";
  if (total > 1) {
    copy = open
      ? `<div class="wc-copy"><button type="button" class="copy-btn" data-action="copy-all">Copy checks to all wells ↓</button></div>`
      : `<div class="wc-copy"><button type="button" class="copy-btn" data-action="copy-from-first">Same checks as ${esc(first.name)}</button></div>`;
  }
  return `<details class="well-card" data-well="${w.id}"${open ? " open" : ""}>
      <summary class="wc-summary"><span class="wc-name">${esc(w.name)}</span><span class="wc-status">Not started</span></summary>
      <div class="wc-body">${copy}${window.WELL_SECTIONS.map((s) => renderSection(s, w.id)).join("")}</div>
    </details>`;
}

// ---------------------------------------------------------------------------
// Dashboard (filtered by the active filters)
// ---------------------------------------------------------------------------
let dashboardLoading = false;
async function loadDashboard() {
  if (dashboardLoading || !allTanks.length) { if (!allTanks.length) return; }
  dashboardLoading = true;
  try {
    if (!navigator.onLine) {
      let pending = 0;
      try { pending = await window.AuditDB.count(); } catch (e) {}
      kpisEl.innerHTML = "";
      attentionCount.textContent = "";
      dashFilterNote.hidden = true;
      attentionEl.innerHTML = '<p class="empty">Dashboard needs a connection. You can still record audits offline from the Audit tab.</p>';
      activityEl.innerHTML = `<p class="empty">${pending} visit${pending === 1 ? "" : "s"} saved on this device, waiting to sync.</p>`;
      return;
    }
    let allVisits;
    try {
      const visitRes = await withTimeout(sb.from("visits")
        .select("id,tank_id,auditor,audited_at,tank_answers,well_checks(well_id,answers)")
        .order("audited_at", { ascending: false }), 12000);
      if (visitRes.error) throw visitRes.error;
      allVisits = visitRes.data;
    } catch (e) {
      // Weak signal / server unreachable — stay usable, don't error out.
      let pending = 0; try { pending = await window.AuditDB.count(); } catch (_) {}
      kpisEl.innerHTML = "";
      attentionCount.textContent = "";
      dashFilterNote.hidden = true;
      attentionEl.innerHTML = '<p class="empty">Couldn\'t reach the server (weak signal). Tap Refresh when you have a better connection.</p>';
      activityEl.innerHTML = `<p class="empty">${pending} visit${pending === 1 ? "" : "s"} saved on this device, waiting to sync.</p>`;
      return;
    }

    const fTanks = allTanks.filter(tankPasses);
    const passIds = new Set(fTanks.map((t) => t.id));
    const visits = allVisits.filter((v) => passIds.has(v.tank_id));
    const acctById = Object.fromEntries(accountsList.map((a) => [a.id, a.name]));
    const wellName = Object.fromEntries(allWells.map((w) => [w.id, w.name]));
    const visitFails = (v) => countFails(v.tank_answers) + (v.well_checks || []).reduce((n, wc) => n + countFails(wc.answers), 0);

    const latestByTank = {};
    for (const v of visits) if (!latestByTank[v.tank_id]) latestByTank[v.tank_id] = v;
    const attention = Object.values(latestByTank).map((v) => ({ v, fails: visitFails(v) })).filter((x) => x.fails > 0).sort((a, b) => b.fails - a.fails);
    setActionsBadge(attention.reduce((n, x) => n + x.fails, 0));

    renderKpis({ tanks: fTanks.length, audited: Object.keys(latestByTank).length, visits: visits.length, attention: attention.length });
    renderAttention(attention, acctById, wellName);
    renderActivity(visits.slice(0, 8), visitFails);

    if (activeFilterCount()) {
      dashFilterNote.hidden = false;
      dashFilterNote.innerHTML = `<span>Filtered to ${fTanks.length} of ${allTanks.length} tanks</span><button type="button" id="dash-clear">Clear filters</button>`;
      const dc = document.getElementById("dash-clear");
      if (dc) dc.addEventListener("click", clearFilters);
    } else dashFilterNote.hidden = true;
  } finally {
    dashboardLoading = false;
  }
}

function renderKpis(k) {
  const cards = [
    { num: k.attention, lbl: "Need attention", cls: k.attention > 0 ? "alert" : "good" },
    { num: `${k.audited}/${k.tanks}`, lbl: "Tanks audited", cls: "" },
    { num: k.visits, lbl: "Total visits", cls: "" },
    { num: k.tanks - k.audited, lbl: "Not yet audited", cls: "" },
  ];
  kpisEl.innerHTML = cards.map((c) => `<div class="kpi ${c.cls}"><div class="num">${c.num}</div><div class="lbl">${c.lbl}</div></div>`).join("");
}

function renderAttention(list, acctById, wellName) {
  attentionCount.textContent = list.length ? `${list.length}` : "";
  if (!list.length) { attentionEl.innerHTML = '<p class="empty">All clear — no failed checks on the latest visits. ✅</p>'; return; }
  attentionEl.innerHTML = list.map(({ v, fails }) => {
    const t = tankById[v.tank_id];
    const label = t ? t.label : "Unknown tank";
    const acct = t ? acctById[t.account_id] || "" : "";
    const tankFails = Object.entries(v.tank_answers || {}).filter(([, x]) => x === "fail").map(([k]) => labelFor(k));
    const wellFails = (v.well_checks || []).flatMap((wc) => Object.entries(wc.answers || {}).filter(([, x]) => x === "fail").map(([k]) => `${wellName[wc.well_id] || "Well"}: ${labelFor(k)}`));
    const chips = [...tankFails, ...wellFails].map((x) => `<span class="chip-fail">${esc(x)}</span>`).join("");
    return `<button type="button" class="row-card" data-acct="${t ? t.account_id : ""}" data-tank="${v.tank_id}">
        <div class="rc-main"><div class="rc-title">${esc(label)}</div><div class="rc-sub">${esc(acct)} · ${fmtDate(v.audited_at)}</div><div class="chips">${chips}</div></div>
        <span class="badge fail">${fails} fail${fails === 1 ? "" : "s"}</span>
      </button>`;
  }).join("");
  attentionEl.querySelectorAll(".row-card").forEach((b) => b.addEventListener("click", () => gotoTank(b.dataset.acct, b.dataset.tank)));
}

function renderActivity(list, visitFails) {
  if (!list.length) { activityEl.innerHTML = '<p class="empty">No visits recorded yet. Head to the Audit tab to add the first one.</p>'; return; }
  activityEl.innerHTML = list.map((v) => {
    const t = tankById[v.tank_id];
    const label = t ? t.label : "Unknown tank";
    const fails = visitFails(v);
    const badge = fails > 0 ? `<span class="badge fail">${fails} fail${fails === 1 ? "" : "s"}</span>` : `<span class="badge pass">OK</span>`;
    return `<button type="button" class="row-card" data-acct="${t ? t.account_id : ""}" data-tank="${v.tank_id}">
        <div class="rc-main"><div class="rc-title">${esc(label)}</div><div class="rc-sub">${fmtDate(v.audited_at)}${v.auditor ? " · " + esc(v.auditor) : ""}</div></div>${badge}
      </button>`;
  }).join("");
  activityEl.querySelectorAll(".row-card").forEach((b) => b.addEventListener("click", () => gotoTank(b.dataset.acct, b.dataset.tank)));
}

function gotoTank(accountId, tankId) {
  if (!tankId) return;
  switchTab("audit");
  if (accountId) accountSelect.value = accountId;
  tankSearchVal = ""; tankSearch.value = "";
  populateTankSelect();
  selectTank(tankId);
}

// ---------------------------------------------------------------------------
// Action Items — auto punch-list of open fails from each tank's latest visit
// ---------------------------------------------------------------------------
function computeOpenItems(allVisits) {
  const passIds = new Set(allTanks.filter(tankPasses).map((t) => t.id));
  const wellName = Object.fromEntries(allWells.map((w) => [w.id, w.name]));
  const latestByTank = {};
  for (const v of allVisits) if (passIds.has(v.tank_id) && !latestByTank[v.tank_id]) latestByTank[v.tank_id] = v;
  const items = [];
  for (const v of Object.values(latestByTank)) {
    const t = tankById[v.tank_id];
    if (!t) continue;
    for (const [k, val] of Object.entries(v.tank_answers || {})) if (val === "fail") items.push({ tank: t, well: null, key: k, when: v.audited_at, auditor: v.auditor });
    for (const wc of v.well_checks || []) for (const [k, val] of Object.entries(wc.answers || {})) if (val === "fail") items.push({ tank: t, well: wellName[wc.well_id] || "Well", key: k, when: v.audited_at, auditor: v.auditor });
  }
  items.sort((a, b) => a.tank.label.localeCompare(b.tank.label) || (a.well || "").localeCompare(b.well || "") || a.key.localeCompare(b.key));
  return items;
}

function setActionsBadge(n) { actionsTabBadge.hidden = !n; actionsTabBadge.textContent = String(n); }

let actionsLoading = false;
async function loadActions() {
  if (actionsLoading || !allTanks.length) { if (!allTanks.length) return; }
  actionsLoading = true;
  try {
    if (!navigator.onLine) {
      actionsCount.textContent = "";
      actionsList.innerHTML = '<p class="empty">Action items need a connection. Your saved audits sync first, then this list refreshes.</p>';
      return;
    }
    let allVisits;
    try {
      const r = await withTimeout(sb.from("visits")
        .select("id,tank_id,auditor,audited_at,tank_answers,well_checks(well_id,answers)")
        .order("audited_at", { ascending: false }), 12000);
      if (r.error) throw r.error;
      allVisits = r.data;
    } catch (e) {
      actionsCount.textContent = "";
      actionsList.innerHTML = '<p class="empty">Couldn\'t reach the server (weak signal). Tap Refresh when you have a better connection.</p>';
      return;
    }
    const items = computeOpenItems(allVisits);
    setActionsBadge(items.length);
    renderActions(items);
  } finally {
    actionsLoading = false;
  }
}

function renderActions(items) {
  const acctById = Object.fromEntries(accountsList.map((a) => [a.id, a.name]));
  actionsCount.textContent = items.length ? `${items.length} open${activeFilterCount() ? " (filtered)" : ""}` : "";
  if (!items.length) { actionsList.innerHTML = '<p class="empty">No open action items — everything\'s passing. ✅</p>'; return; }
  actionsList.innerHTML = items.map((it) => {
    const acct = acctById[it.tank.account_id] || "";
    const where = it.well ? `${esc(it.tank.label)} · ${esc(it.well)}` : `${esc(it.tank.label)} · Tank / skid`;
    return `<button type="button" class="row-card" data-acct="${it.tank.account_id}" data-tank="${it.tank.id}">
        <div class="rc-main">
          <div class="rc-title">${esc(labelFor(it.key))}</div>
          <div class="rc-sub">${where}</div>
          <div class="rc-sub">${esc(acct)} · ${fmtDate(it.when)}${it.auditor ? " · " + esc(it.auditor) : ""}</div>
        </div>
        <span class="badge fail">Fail</span>
      </button>`;
  }).join("");
  actionsList.querySelectorAll(".row-card").forEach((b) => b.addEventListener("click", () => gotoTank(b.dataset.acct, b.dataset.tank)));
}

// ---------------------------------------------------------------------------
// Insights — customer-facing program summary
// ---------------------------------------------------------------------------
let insightsLoading = false;
async function loadInsights() {
  if (insightsLoading || !allTanks.length) { if (!allTanks.length) return; }
  insightsLoading = true;
  try {
    if (!navigator.onLine) {
      insightsKpis.innerHTML = "";
      document.getElementById("ins-trend").innerHTML = '<p class="empty">Insights need a connection. Saved audits sync first, then refresh here.</p>';
      ["ins-bycat", "ins-topchecks", "ins-byarea", "ins-byproduct", "ins-ops"].forEach((id) => (document.getElementById(id).innerHTML = ""));
      return;
    }
    let allVisits;
    try {
      const r = await withTimeout(sb.from("visits")
        .select("id,tank_id,auditor,audited_at,tank_answers,well_checks(well_id,answers)")
        .order("audited_at", { ascending: false }), 12000);
      if (r.error) throw r.error;
      allVisits = r.data;
    } catch (e) {
      insightsKpis.innerHTML = "";
      document.getElementById("ins-trend").innerHTML = '<p class="empty">Couldn\'t reach the server (weak signal). Tap Refresh when you have a better connection.</p>';
      return;
    }
    renderInsights(computeInsights(allVisits));
  } finally {
    insightsLoading = false;
  }
}

function computeInsights(allVisits) {
  const fTankIds = new Set(allTanks.filter(tankPasses).map((t) => t.id));
  const fTanks = allTanks.filter((t) => fTankIds.has(t.id));
  const visits = allVisits.filter((v) => fTankIds.has(v.tank_id));
  const latestByTank = {};
  for (const v of visits) if (!latestByTank[v.tank_id]) latestByTank[v.tank_id] = v;
  const latest = Object.values(latestByTank);

  // Current health (pass rate) from each tank's latest visit
  let passC = 0, failC = 0;
  const tally = (ans) => { for (const x of Object.values(ans || {})) { if (x === "pass") passC++; else if (x === "fail") failC++; } };
  for (const v of latest) { tally(v.tank_answers); (v.well_checks || []).forEach((wc) => tally(wc.answers)); }
  const healthRate = passC + failC ? Math.round((100 * passC) / (passC + failC)) : null;

  // Open items (reuse) + breakdowns
  const items = computeOpenItems(visits);
  const group = (keyFn) => {
    const m = {};
    for (const it of items) { const k = keyFn(it) || "—"; m[k] = (m[k] || 0) + 1; }
    return Object.entries(m).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  };
  const byCat = group((it) => (window.ITEM_BY_KEY[it.key] || {}).section);
  const byArea = group((it) => it.tank.location);
  const byProduct = group((it) => it.tank.product);

  // Closure rate: of everything that ever failed, how much now passes
  const everFail = new Set(), curVal = {};
  for (const v of visits) {
    for (const [k, val] of Object.entries(v.tank_answers || {})) if (val === "fail") everFail.add("t|" + v.tank_id + "|" + k);
    for (const wc of v.well_checks || []) for (const [k, val] of Object.entries(wc.answers || {})) if (val === "fail") everFail.add("w|" + wc.well_id + "|" + k);
  }
  for (const v of latest) {
    for (const [k, val] of Object.entries(v.tank_answers || {})) curVal["t|" + v.tank_id + "|" + k] = val;
    for (const wc of v.well_checks || []) for (const [k, val] of Object.entries(wc.answers || {})) curVal["w|" + wc.well_id + "|" + k] = val;
  }
  let resolved = 0, openIssues = 0;
  for (const id of everFail) { const c = curVal[id]; if (c === "fail") openIssues++; else if (c === "pass" || c === "na") resolved++; }
  const closureRate = resolved + openIssues ? Math.round((100 * resolved) / (resolved + openIssues)) : null;

  // Compliance trend by month
  const monthMap = {};
  for (const v of visits) {
    const ym = (v.audited_at || "").slice(0, 7);
    const m = (monthMap[ym] = monthMap[ym] || { pass: 0, fail: 0 });
    const t2 = (ans) => { for (const x of Object.values(ans || {})) { if (x === "pass") m.pass++; else if (x === "fail") m.fail++; } };
    t2(v.tank_answers); (v.well_checks || []).forEach((wc) => t2(wc.answers));
  }
  const trend = Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ym, m]) => ({ label: monthLabel(ym), value: m.pass + m.fail ? Math.round((100 * m.pass) / (m.pass + m.fail)) : 0 }));

  // Most common failed checks (all visits)
  const checkFail = {};
  for (const v of visits) {
    for (const [k, val] of Object.entries(v.tank_answers || {})) if (val === "fail") checkFail[k] = (checkFail[k] || 0) + 1;
    for (const wc of v.well_checks || []) for (const [k, val] of Object.entries(wc.answers || {})) if (val === "fail") checkFail[k] = (checkFail[k] || 0) + 1;
  }
  const topChecks = Object.entries(checkFail).map(([k, value]) => ({ label: labelFor(k), value })).sort((a, b) => b.value - a.value).slice(0, 6);

  // Operations (from latest visits)
  const wellName = Object.fromEntries(allWells.map((w) => [w.id, w.name]));
  const zeroRate = [], inv = [];
  for (const v of latest) {
    const t = tankById[v.tank_id];
    const ivol = v.tank_answers && v.tank_answers.current_inventory_volume;
    if (ivol !== undefined && ivol !== "" && !isNaN(Number(ivol))) inv.push({ label: t.label, value: Number(ivol) });
    for (const wc of v.well_checks || []) {
      const r = wc.answers && wc.answers.current_injection_rate;
      if (r !== undefined && /^0(\.0+)?(\s|$|qt|gal)/i.test(String(r).trim())) zeroRate.push({ tank: t.label, well: wellName[wc.well_id] || "Well" });
    }
  }
  inv.sort((a, b) => a.value - b.value);

  return {
    tanksTotal: fTanks.length, tanksAudited: latest.length, visitsTotal: visits.length,
    healthRate, open: items.length, closureRate, resolved,
    byCat, byArea, byProduct, trend, topChecks, zeroRate, lowInv: inv.slice(0, 5),
  };
}

function monthLabel(ym) {
  if (!ym) return ym;
  const [y, m] = ym.split("-");
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m) - 1] + " " + y;
}

function barRows(data, cls) {
  if (!data || !data.length) return '<p class="empty">No data yet.</p>';
  const max = Math.max.apply(null, data.map((d) => d.value).concat(1));
  return data.map((d) => `<div class="bar-row"><span class="bar-label">${esc(d.label)}</span><span class="bar-track"><span class="bar-fill ${cls || ""}" style="width:${Math.round((100 * d.value) / max)}%"></span></span><span class="bar-val">${d.suffix ? d.value + d.suffix : d.value}</span></div>`).join("");
}

function renderInsights(ins) {
  const cards = [
    { num: ins.healthRate == null ? "—" : ins.healthRate + "%", lbl: "Compliance (pass rate)", cls: ins.healthRate == null ? "" : ins.healthRate >= 90 ? "good" : ins.healthRate < 75 ? "alert" : "" },
    { num: `${ins.tanksAudited}/${ins.tanksTotal}`, lbl: "Tanks audited", cls: "" },
    { num: ins.open, lbl: "Open issues", cls: ins.open > 0 ? "alert" : "good" },
    { num: ins.closureRate == null ? "—" : ins.closureRate + "%", lbl: "Issues resolved", cls: "" },
  ];
  insightsKpis.innerHTML = cards.map((c) => `<div class="kpi ${c.cls}"><div class="num">${c.num}</div><div class="lbl">${c.lbl}</div></div>`).join("");

  document.getElementById("ins-trend").innerHTML = ins.trend.length < 1 ? '<p class="empty">Not enough data yet.</p>' : barRows(ins.trend.map((t) => ({ label: t.label, value: t.value, suffix: "%" })), "pass");
  document.getElementById("ins-bycat").innerHTML = barRows(ins.byCat, "fail");
  document.getElementById("ins-topchecks").innerHTML = barRows(ins.topChecks, "fail");
  document.getElementById("ins-byarea").innerHTML = barRows(ins.byArea, "fail");
  document.getElementById("ins-byproduct").innerHTML = barRows(ins.byProduct, "fail");

  const ops = [];
  ops.push(`<div class="ds"><h4>Wells reporting 0 injection rate (${ins.zeroRate.length})</h4>` +
    (ins.zeroRate.length ? ins.zeroRate.slice(0, 8).map((z) => `<div class="ans-row"><span>${esc(z.tank)} · ${esc(z.well)}</span><span class="v fail">0</span></div>`).join("") : '<p class="empty">None.</p>') + "</div>");
  ops.push(`<div class="ds"><h4>Lowest current inventory</h4>` +
    (ins.lowInv.length ? ins.lowInv.map((i) => `<div class="ans-row"><span>${esc(i.label)}</span><span class="v">${i.value} gal</span></div>`).join("") : '<p class="empty">No inventory recorded yet.</p>') + "</div>");
  ops.push('<p class="hint" style="margin-top:10px">Note: "below target rate" needs target rates loaded (the ActiveTargetRate column wasn\'t imported). Say the word and I\'ll add it.</p>');
  document.getElementById("ins-ops").innerHTML = ops.join("");
}

// ---------------------------------------------------------------------------
// Form rendering / collection
// ---------------------------------------------------------------------------
function renderSection(section, scope) {
  const items = section.items.map((it) => (it.type === "toggle" ? renderToggleItem(it) : renderRecordItem(it, scope)));
  return `<div class="section"><h3>${esc(section.title)}</h3>${items.join("")}</div>`;
}
function renderToggleItem(item) {
  const buttons = TOGGLE_VALUES.map((v) => `<button type="button" data-val="${v}" aria-pressed="false">${TOGGLE_LABELS[v]}</button>`).join("");
  return `<div class="item"><span class="item-label">${esc(item.label)}</span><span class="toggle" data-key="${item.key}" data-value="">${buttons}</span></div>`;
}
function renderRecordItem(item, scope) {
  const id = `f_${scope}_${item.key}`;
  const ph = item.placeholder ? ` placeholder="${esc(item.placeholder)}"` : "";
  let input;
  if (item.type === "number") {
    input = `<div class="input-unit"><input type="number" step="any" inputmode="decimal" id="${id}" data-key="${item.key}"${ph} />${item.unit ? `<span class="unit">${esc(item.unit)}</span>` : ""}</div>`;
  } else if (item.type === "select") {
    const opts = (selectOptions[item.key] || []).map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join("");
    input = `<select id="${id}" data-key="${item.key}"><option value="">${esc(item.placeholder || "Select…")}</option>${opts}</select>`;
  } else {
    input = `<input type="text" id="${id}" data-key="${item.key}"${ph} />`;
  }
  return `<div class="item record"><label class="item-label" for="${id}">${esc(item.label)}</label>${input}</div>`;
}

function collectFrom(container) {
  const answers = {};
  container.querySelectorAll(".toggle").forEach((g) => { if (g.dataset.value) answers[g.dataset.key] = g.dataset.value; });
  container.querySelectorAll("input[data-key]").forEach((i) => {
    const v = i.value.trim();
    if (v !== "") answers[i.dataset.key] = i.type === "number" ? Number(v) : v;
  });
  container.querySelectorAll("select[data-key]").forEach((s) => { if (s.value) answers[s.dataset.key] = s.value; });
  return answers;
}
function applyAnswers(container, answers) {
  container.querySelectorAll(".toggle").forEach((g) => {
    const val = answers[g.dataset.key] || "";
    g.dataset.value = val;
    g.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.val === val ? "true" : "false"));
  });
  container.querySelectorAll("input[data-key]").forEach((i) => { if (answers[i.dataset.key] !== undefined) i.value = answers[i.dataset.key]; });
  container.querySelectorAll("select[data-key]").forEach((s) => { if (answers[s.dataset.key] !== undefined) s.value = answers[s.dataset.key]; });
}
function updateWellStatus(card) {
  const n = Object.keys(collectFrom(card)).length;
  const s = card.querySelector(".wc-status");
  if (!s) return;
  s.textContent = n === 0 ? "Not started" : n >= WELL_ITEM_COUNT ? "Complete" : `${n}/${WELL_ITEM_COUNT}`;
  s.className = "wc-status" + (n === 0 ? "" : n >= WELL_ITEM_COUNT ? " complete" : " started");
}

function onVisitClick(e) {
  const copy = e.target.closest(".copy-btn");
  if (copy) { handleCopy(copy); return; }
  const btn = e.target.closest(".toggle button");
  if (!btn) return;
  const group = btn.parentElement;
  const already = btn.getAttribute("aria-pressed") === "true";
  group.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false"));
  btn.setAttribute("aria-pressed", already ? "false" : "true");
  group.dataset.value = already ? "" : btn.dataset.val;
  const card = btn.closest(".well-card");
  if (card) updateWellStatus(card);
  saveDraft();
}
function onVisitInput(e) {
  const card = e.target.closest(".well-card");
  if (card) updateWellStatus(card);
  saveDraft();
}

// Copy the first well's toggle checks (not injection rates) to other wells.
function toggleAnswers(card) {
  const a = {};
  card.querySelectorAll(".toggle").forEach((g) => { if (g.dataset.value) a[g.dataset.key] = g.dataset.value; });
  return a;
}
function overlayToggles(card, answers) {
  card.querySelectorAll(".toggle").forEach((g) => {
    if (answers[g.dataset.key] === undefined) return;
    const val = answers[g.dataset.key];
    g.dataset.value = val;
    g.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.val === val ? "true" : "false"));
  });
}
function handleCopy(btn) {
  const cards = [...wellsEl.querySelectorAll(".well-card")];
  if (cards.length < 2) return;
  const src = toggleAnswers(cards[0]);
  if (Object.keys(src).length === 0) { toast("Fill in the first well's checks first"); return; }
  if (btn.dataset.action === "copy-all") {
    cards.slice(1).forEach((c) => { overlayToggles(c, src); updateWellStatus(c); });
    toast("Checks copied to all wells");
  } else {
    const target = btn.closest(".well-card");
    overlayToggles(target, src);
    updateWellStatus(target);
    toast("Checks copied");
  }
  saveDraft();
}

function draftKey() { return currentTank ? "draft_" + currentTank.id : null; }
function saveDraft() {
  if (!currentTank) return;
  const draft = { tank: collectFrom(tankFields), wells: {}, notes: generalNotes.value };
  wellsEl.querySelectorAll(".well-card").forEach((c) => { draft.wells[c.dataset.well] = collectFrom(c); });
  const empty = Object.keys(draft.tank).length === 0 && !draft.notes.trim() &&
    Object.values(draft.wells).every((o) => Object.keys(o).length === 0);
  try {
    if (empty) localStorage.removeItem(draftKey());
    else localStorage.setItem(draftKey(), JSON.stringify(draft));
  } catch (e) {}
}
function restoreDraft() {
  let draft;
  try { draft = JSON.parse(localStorage.getItem(draftKey()) || "null"); } catch (e) { draft = null; }
  if (!draft) return;
  applyAnswers(tankFields, draft.tank || {});
  wellsEl.querySelectorAll(".well-card").forEach((c) => { applyAnswers(c, (draft.wells || {})[c.dataset.well] || {}); updateWellStatus(c); });
  generalNotes.value = draft.notes || "";
  formStatus.textContent = "Draft restored";
}
function clearDraft() { const k = draftKey(); if (k) { try { localStorage.removeItem(k); } catch (e) {} } }

// ---------------------------------------------------------------------------
// Save visit
// ---------------------------------------------------------------------------
async function saveVisit() {
  if (!currentTank) return;
  const tankAnswers = collectFrom(tankFields);
  const wellRows = [];
  wellsEl.querySelectorAll(".well-card").forEach((c) => {
    const ans = collectFrom(c);
    if (Object.keys(ans).length) wellRows.push({ id: uuid(), well_id: c.dataset.well, answers: ans });
  });
  if (Object.keys(tankAnswers).length === 0 && wellRows.length === 0) {
    formStatus.textContent = "Answer at least one item before saving.";
    return;
  }
  const payload = {
    id: uuid(),
    tank_id: currentTank.id,
    auditor: currentUser ? currentUser.email : null,
    audited_at: new Date().toISOString(),
    tank_answers: tankAnswers,
    notes: generalNotes.value.trim() || null,
    well_checks: wellRows,
  };
  saveBtn.disabled = true;
  formStatus.textContent = "Saving…";
  // Durable local write FIRST — we only tell the user "saved" once it's safely
  // on the device. Syncing to the server is a separate, retryable step.
  try {
    await window.AuditDB.put({ id: payload.id, payload, status: "pending", created_at: Date.now(), tank_id: currentTank.id, tank_label: currentTank.label });
  } catch (e) {
    saveBtn.disabled = false; formStatus.textContent = "";
    return fail("Couldn't save on this device", e);
  }
  saveBtn.disabled = false;
  clearDraft();
  resetVisitForm();
  showDetails();
  toast(navigator.onLine ? "Visit saved" : "Saved offline — will sync");
  await refreshSync();
  await loadHistory();
  flushQueue();
}

// ---------------------------------------------------------------------------
// Sync engine — flush the local queue to the server, idempotently
// ---------------------------------------------------------------------------
let flushing = false;
async function flushQueue() {
  if (flushing || !navigator.onLine) { refreshSync(); return; }
  flushing = true;
  let changed = false;
  try {
    const items = await window.AuditDB.all();
    for (const item of items) {
      if (item.status === "error") continue; // wait for a manual retry
      let res;
      try { res = await withTimeout(sb.rpc("submit_visit", { payload: item.payload }), 12000); }
      catch (e) { break; } // network failure / timeout — stop, keep everything queued, retry later
      if (res && res.error) {
        if (res.error.code) { await window.AuditDB.put({ ...item, status: "error", error: res.error.message }); changed = true; }
        else break; // transient — stop and retry later
      } else {
        await window.AuditDB.remove(item.id); changed = true; // confirmed on server
      }
    }
  } finally {
    flushing = false;
  }
  await refreshSync();
  if (changed) {
    if (!dashboardView.hidden) loadDashboard();
    if (!actionsView.hidden) loadActions();
    if (currentTank && !visitView.hidden) loadHistory();
  }
}

async function refreshSync() {
  let items = [];
  try { items = await window.AuditDB.all(); } catch (e) {}
  const total = items.length;
  const erroredOnly = total > 0 && items.every((i) => i.status === "error");
  syncBadge.hidden = total === 0;
  syncBadge.textContent = String(total);
  syncBadge.classList.toggle("err", erroredOnly);
  offlineBanner.hidden = navigator.onLine;
  syncBtn.classList.toggle("offline", !navigator.onLine);
  if (!syncDrawer.hidden) renderSyncList(items);
}

async function renderSyncList(items) {
  if (!items) { try { items = await window.AuditDB.all(); } catch (e) { items = []; } }
  const online = navigator.onLine;
  syncStatus.innerHTML =
    `<div class="sync-state ${online ? "on" : "off"}">● ${online ? "Online" : "Offline"}</div>` +
    `<div class="muted">${items.length ? `${items.length} visit${items.length === 1 ? "" : "s"} waiting to sync` : "All visits synced"}</div>`;
  syncNow.disabled = !online || items.length === 0;
  syncNow.textContent = online ? "Sync now" : "Sync now (offline)";
  if (!items.length) { syncList.innerHTML = '<p class="empty">Nothing pending — you\'re all caught up. ✅</p>'; return; }
  syncList.innerHTML = items.map((it) => {
    const p = it.payload;
    const nw = (p.well_checks || []).length;
    const badge = it.status === "error" ? `<span class="badge fail">error</span>` : `<span class="badge pending">pending</span>`;
    const err = it.status === "error" ? `<div class="sync-err">${esc(it.error || "Failed to sync")}</div>` : "";
    return `<div class="sync-item">
        <div class="rc-main"><div class="rc-title">${esc(it.tank_label || "Tank")}</div><div class="rc-sub">${fmtDate(p.audited_at)} · ${nw} well${nw === 1 ? "" : "s"}</div>${err}</div>
        ${badge}
        <button type="button" class="sync-del" data-id="${it.id}" title="Discard">✕</button>
      </div>`;
  }).join("");
  syncList.querySelectorAll(".sync-del").forEach((b) => b.addEventListener("click", () => discardPending(b.dataset.id)));
}

async function discardPending(id) {
  if (!confirm("Discard this unsynced visit? It will be permanently lost.")) return;
  try { await window.AuditDB.remove(id); } catch (e) { return fail("Couldn't discard", e); }
  toast("Discarded");
  await refreshSync();
  await renderSyncList();
  if (currentTank && !visitView.hidden) loadHistory();
}

function resetVisitForm() {
  applyAnswers(tankFields, {});
  tankFields.querySelectorAll("input[data-key]").forEach((i) => (i.value = ""));
  tankFields.querySelectorAll("select[data-key]").forEach((s) => (s.value = ""));
  wellsEl.querySelectorAll(".well-card").forEach((c) => {
    applyAnswers(c, {});
    c.querySelectorAll("input[data-key]").forEach((i) => (i.value = ""));
    updateWellStatus(c);
  });
  generalNotes.value = "";
  formStatus.textContent = "";
  setProductDefault();
}

// Pre-fill the Chemical product dropdown from the tank's product (still editable).
function setProductDefault() {
  if (!currentTank) return;
  const t = tankById[currentTank.id];
  const sel = tankFields.querySelector('select[data-key="chemical_product_name"]');
  if (sel && t && t.product) sel.value = t.product;
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------
async function loadHistory() {
  if (!currentTank) return;
  historyEl.innerHTML = '<p class="muted">Loading…</p>';
  // Unsynced visits saved on this device for this tank.
  let pendings = [];
  try { pendings = (await window.AuditDB.all()).filter((p) => p.payload.tank_id === currentTank.id); } catch (e) {}
  // Server visits (only if online).
  let server = [];
  if (navigator.onLine) {
    try {
      const { data, error } = await withTimeout(sb.from("visits")
        .select("id,auditor,audited_at,tank_answers,notes,well_checks(well_id,answers)")
        .eq("tank_id", currentTank.id).order("audited_at", { ascending: false }), 10000);
      if (!error && data) server = data;
    } catch (e) {}
  }
  const total = pendings.length + server.length;
  historyCount.textContent = total ? `${total} visit${total === 1 ? "" : "s"}` : "";
  if (!total) {
    historyEl.innerHTML = `<p class="empty">${navigator.onLine ? "No visits recorded yet for this tank." : "No visits on this device for this tank."}</p>`;
    return;
  }
  historyEl.innerHTML = pendings.map(renderPendingEntry).join("") + server.map(renderVisitEntry).join("");
  const firstEntry = historyEl.querySelector(".audit-entry");
  if (firstEntry) firstEntry.open = true; // show the most recent audit's details by default
  historyEl.querySelectorAll(".del-visit:not(.del-pending)").forEach((b) => b.addEventListener("click", () => deleteVisit(b.dataset.id)));
  historyEl.querySelectorAll(".del-pending").forEach((b) => b.addEventListener("click", () => discardPending(b.dataset.id)));
}

function renderPendingEntry(it) {
  const v = it.payload;
  let pass = 0, failc = 0;
  const tally = (a) => { for (const x of Object.values(a || {})) { if (x === "pass") pass++; else if (x === "fail") failc++; } };
  tally(v.tank_answers);
  (v.well_checks || []).forEach((wc) => tally(wc.answers));
  const badges = (failc ? `<span class="badge fail">${failc} fail</span>` : "") + (pass ? `<span class="badge pass">${pass} pass</span>` : "");
  const status = it.status === "error" ? `<span class="badge fail">sync error</span>` : `<span class="badge pending">pending sync</span>`;
  const tankBlock = sectionsHtml(window.TANK_SECTIONS, v.tank_answers || {}, "Tank / skid");
  const wellBlocks = (v.well_checks || []).map((wc) => sectionsHtml(window.WELL_SECTIONS, wc.answers || {}, currentWellsById[wc.well_id] || "Well")).join("");
  const notes = v.notes ? `<div class="ds"><h4>Notes</h4><div class="ans-row"><span>${esc(v.notes)}</span></div></div>` : "";
  const errLine = it.status === "error" ? `<div class="sync-err">${esc(it.error || "Failed to sync")}</div>` : "";
  return `<details class="audit-entry pending">
      <summary><span><span class="when">${fmtDate(v.audited_at)}</span> ${status}</span><span class="badges">${badges}</span></summary>
      <div class="audit-detail">${errLine}
        <button type="button" class="del-visit del-pending" data-id="${it.id}"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>Discard (not synced)</button>
        ${tankBlock}${wellBlocks}${notes}
      </div>
    </details>`;
}

function renderVisitEntry(v) {
  let pass = 0, failc = 0;
  const tally = (ans) => { for (const x of Object.values(ans || {})) { if (x === "pass") pass++; else if (x === "fail") failc++; } };
  tally(v.tank_answers);
  (v.well_checks || []).forEach((wc) => tally(wc.answers));
  const badges = (failc ? `<span class="badge fail">${failc} fail</span>` : "") + (pass ? `<span class="badge pass">${pass} pass</span>` : "");
  const tankBlock = sectionsHtml(window.TANK_SECTIONS, v.tank_answers || {}, "Tank / skid");
  const wellBlocks = (v.well_checks || []).map((wc) => sectionsHtml(window.WELL_SECTIONS, wc.answers || {}, currentWellsById[wc.well_id] || "Well")).join("");
  const notes = v.notes ? `<div class="ds"><h4>Notes</h4><div class="ans-row"><span>${esc(v.notes)}</span></div></div>` : "";
  return `<details class="audit-entry">
      <summary><span><span class="when">${fmtDate(v.audited_at)}</span>${v.auditor ? `<span class="who"> · ${esc(v.auditor)}</span>` : ""}</span><span class="badges">${badges}</span></summary>
      <div class="audit-detail">
        <button type="button" class="del-visit" data-id="${v.id}"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>Delete visit</button>
        ${tankBlock}${wellBlocks}${notes}
      </div>
    </details>`;
}
function sectionsHtml(sections, answers, groupTitle) {
  const rows = sections.flatMap((s) => s.items).filter((it) => answers[it.key] !== undefined).map((it) => answerRow(it, answers[it.key])).join("");
  return rows ? `<div class="ds"><h4>${esc(groupTitle)}</h4>${rows}</div>` : "";
}
function answerRow(item, value) {
  let display;
  if (item.type === "toggle") {
    const cls = TOGGLE_VALUES.includes(value) ? value : "na";
    display = `<span class="v ${cls}">${TOGGLE_LABELS[value] || esc(String(value))}</span>`;
  } else {
    const unit = item.unit ? ` ${esc(item.unit)}` : "";
    display = `<span class="v">${esc(String(value))}${unit}</span>`;
  }
  return `<div class="ans-row"><span>${esc(item.label)}</span>${display}</div>`;
}
async function deleteVisit(id) {
  if (!confirm("Are you sure? This will permanently delete this visit and its well checks. This can't be undone.")) return;
  const { error } = await sb.from("visits").delete().eq("id", id);
  if (error) return fail("Could not delete visit", error);
  toast("Visit deleted");
  await loadHistory();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function countFails(ans) { return Object.values(ans || {}).filter((v) => v === "fail").length; }
function labelFor(key) { return window.ITEM_BY_KEY[key] ? window.ITEM_BY_KEY[key].label : key; }
function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0, v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
// Fail-fast wrapper so a weak connection can't make a request hang indefinitely.
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms || 12000);
    Promise.resolve(promise).then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function fmtDate(iso) { const d = new Date(iso); return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
let toastTimer;
function toast(msg, isError) {
  toastEl.textContent = msg;
  toastEl.className = "toast" + (isError ? " error" : "");
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.hidden = true), 3000);
}
function fail(msg, error) { console.error(msg, error); toast(msg + (error && error.message ? `: ${error.message}` : ""), true); }
