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

const accountSelect = document.getElementById("account-select");
const tankSelect = document.getElementById("tank-select");
const tankSearch = document.getElementById("tank-search");
const tankFilterNote = document.getElementById("tank-filter-note");
const visitView = document.getElementById("visit-view");
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
tabs.forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));

accountSelect.addEventListener("change", onAccountChange);
tankSelect.addEventListener("change", () => selectTank(tankSelect.value));
tankSearch.addEventListener("input", () => { tankSearchVal = tankSearch.value.trim().toLowerCase(); populateTankSelect(); });
saveBtn.addEventListener("click", saveVisit);
visitView.addEventListener("click", onVisitClick);
visitView.addEventListener("input", onVisitInput);

filterBtn.addEventListener("click", () => { filterDrawer.hidden = false; updateFilterCount(); });
filterDrawer.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) filterDrawer.hidden = true; });
filterClear.addEventListener("click", clearFilters);
filterGroups.addEventListener("click", onFilterChip);

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
  const { data: allowed, error } = await sb.rpc("is_email_allowed", { check_email: saved });
  if (error) return showLoggedOut();
  if (allowed) return showLoggedIn(saved);
  localStorage.removeItem(STORAGE_KEY);
  showLoggedOut();
}

async function enterApp() {
  const email = loginEmail.value.trim();
  if (!email) { loginStatus.textContent = "Enter your email."; return; }
  loginBtn.disabled = true;
  loginStatus.textContent = "Checking…";
  const { data: allowed, error } = await sb.rpc("is_email_allowed", { check_email: email });
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
  viewTitle.textContent = name === "dashboard" ? "Dashboard" : "Audit";
  window.scrollTo({ top: 0 });
  if (name === "dashboard") loadDashboard();
}

// ---------------------------------------------------------------------------
// Catalog + filters
// ---------------------------------------------------------------------------
async function loadCatalog() {
  const [accRes, tankRes, wellRes] = await Promise.all([
    sb.from("accounts").select("id,name").order("name"),
    sb.from("tanks").select("id,account_id,label,state,location,product").order("label"),
    sb.from("wells").select("id,tank_id,name,asset_type"),
  ]);
  if (accRes.error || tankRes.error || wellRes.error) return fail("Could not load catalog", accRes.error || tankRes.error || wellRes.error);

  accountsList = accRes.data; allTanks = tankRes.data; allWells = wellRes.data;
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

  accountSelect.innerHTML = '<option value="">Select an account…</option>' + accountsList.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join("");
  if (accountsList.length === 1) accountSelect.value = accountsList[0].id;
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
  loadHistory();
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
    const visitRes = await sb.from("visits")
      .select("id,tank_id,auditor,audited_at,tank_answers,well_checks(well_id,answers)")
      .order("audited_at", { ascending: false });
    if (visitRes.error) return fail("Could not load dashboard", visitRes.error);

    const fTanks = allTanks.filter(tankPasses);
    const passIds = new Set(fTanks.map((t) => t.id));
    const visits = visitRes.data.filter((v) => passIds.has(v.tank_id));
    const acctById = Object.fromEntries(accountsList.map((a) => [a.id, a.name]));
    const wellName = Object.fromEntries(allWells.map((w) => [w.id, w.name]));
    const visitFails = (v) => countFails(v.tank_answers) + (v.well_checks || []).reduce((n, wc) => n + countFails(wc.answers), 0);

    const latestByTank = {};
    for (const v of visits) if (!latestByTank[v.tank_id]) latestByTank[v.tank_id] = v;
    const attention = Object.values(latestByTank).map((v) => ({ v, fails: visitFails(v) })).filter((x) => x.fails > 0).sort((a, b) => b.fails - a.fails);

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
  try { localStorage.setItem(draftKey(), JSON.stringify(draft)); } catch (e) {}
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
    if (Object.keys(ans).length) wellRows.push({ well_id: c.dataset.well, answers: ans });
  });
  if (Object.keys(tankAnswers).length === 0 && wellRows.length === 0) {
    formStatus.textContent = "Answer at least one item before saving.";
    return;
  }
  saveBtn.disabled = true;
  formStatus.textContent = "Saving…";
  const { data: visit, error } = await sb.from("visits")
    .insert({ tank_id: currentTank.id, auditor: currentUser ? currentUser.email : null, tank_answers: tankAnswers, notes: generalNotes.value.trim() || null })
    .select("id").single();
  if (error) { saveBtn.disabled = false; formStatus.textContent = ""; return fail("Could not save visit", error); }
  if (wellRows.length) {
    const rows = wellRows.map((r) => ({ visit_id: visit.id, well_id: r.well_id, answers: r.answers }));
    const { error: e2 } = await sb.from("well_checks").insert(rows);
    if (e2) { saveBtn.disabled = false; formStatus.textContent = ""; return fail("Saved tank but not wells", e2); }
  }
  saveBtn.disabled = false;
  clearDraft();
  resetVisitForm();
  toast("Visit saved");
  await loadHistory();
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
  const { data, error } = await sb.from("visits")
    .select("id,auditor,audited_at,tank_answers,notes,well_checks(well_id,answers)")
    .eq("tank_id", currentTank.id).order("audited_at", { ascending: false });
  if (error) return fail("Could not load history", error);
  historyCount.textContent = data.length ? `${data.length} visit${data.length === 1 ? "" : "s"}` : "";
  if (!data.length) { historyEl.innerHTML = '<p class="empty">No visits recorded yet for this tank.</p>'; return; }
  historyEl.innerHTML = data.map(renderVisitEntry).join("");
  historyEl.querySelectorAll(".del-visit").forEach((b) => b.addEventListener("click", () => deleteVisit(b.dataset.id)));
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
      <div class="audit-detail">${tankBlock}${wellBlocks}${notes}<button type="button" class="del-visit" data-id="${v.id}">Delete this visit</button></div>
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
  if (!confirm("Delete this visit permanently?")) return;
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
