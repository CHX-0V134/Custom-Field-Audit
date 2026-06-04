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

const accountSelect = document.getElementById("account-select");
const pointSelect = document.getElementById("point-select");
const pointView = document.getElementById("point-view");
const pointSummary = document.getElementById("point-summary");
const auditorDisplay = document.getElementById("auditor-display");
const form = document.getElementById("audit-form");
const generalNotes = document.getElementById("general-notes");
const saveBtn = document.getElementById("save-btn");
const formStatus = document.getElementById("form-status");
const historyEl = document.getElementById("history");
const historyCount = document.getElementById("history-count");
const toastEl = document.getElementById("toast");

// ---- State ----
let currentPointId = null;
let currentUser = null;
let wired = false;
const STORAGE_KEY = "audit_user_email";
const TOGGLE_VALUES = ["pass", "fail", "na"];
const TOGGLE_LABELS = { pass: "Pass", fail: "Fail", na: "N/A" };

// ---------------------------------------------------------------------------
// Access gate
// ---------------------------------------------------------------------------
buildForm();
loginBtn.addEventListener("click", enterApp);
loginEmail.addEventListener("keydown", (e) => { if (e.key === "Enter") enterApp(); });
signoutBtn.addEventListener("click", signOut);
refreshBtn.addEventListener("click", loadDashboard);
tabs.forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));
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

function showLoggedIn(email) {
  currentUser = { email };
  loginView.hidden = true;
  appShell.hidden = false;
  userEmailEl.textContent = email;
  auditorDisplay.textContent = email;
  if (!wired) {
    wired = true;
    loadAccounts();
    accountSelect.addEventListener("change", onAccountChange);
    pointSelect.addEventListener("change", onPointChange);
    saveBtn.addEventListener("click", saveAudit);
  }
  switchTab("dashboard");
}

function showLoggedOut() {
  currentUser = null;
  appShell.hidden = true;
  loginView.hidden = false;
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
function switchTab(name) {
  tabs.forEach((t) => t.setAttribute("aria-current", t.dataset.tab === name ? "true" : "false"));
  dashboardView.hidden = name !== "dashboard";
  auditView.hidden = name !== "audit";
  viewTitle.textContent = name === "dashboard" ? "Dashboard" : "Audit";
  window.scrollTo({ top: 0 });
  if (name === "dashboard") loadDashboard();
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
let dashboardLoading = false;
async function loadDashboard() {
  if (dashboardLoading) return;
  dashboardLoading = true;
  try {
    const [acctRes, ptRes, audRes] = await Promise.all([
      sb.from("accounts").select("id,name"),
      sb.from("injection_points").select("id,account_id,tank,well"),
      sb.from("audits").select("id,injection_point_id,auditor,audited_at,answers").order("audited_at", { ascending: false }),
    ]);
    if (acctRes.error || ptRes.error || audRes.error)
      return fail("Could not load dashboard", acctRes.error || ptRes.error || audRes.error);

    const accounts = acctRes.data, points = ptRes.data, audits = audRes.data;
    const acctById = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
    const ptById = Object.fromEntries(points.map((p) => [p.id, p]));
    const labelFor = (pid) => {
      const p = ptById[pid];
      return p ? { title: `${p.tank} → ${p.well}`, sub: acctById[p.account_id] || "", account_id: p.account_id } : { title: "Unknown point", sub: "", account_id: null };
    };
    const countFails = (ans) => Object.values(ans || {}).filter((v) => v === "fail").length;

    // Latest audit per point (audits are already newest-first).
    const latestByPoint = {};
    for (const a of audits) if (!latestByPoint[a.injection_point_id]) latestByPoint[a.injection_point_id] = a;

    const attention = Object.values(latestByPoint)
      .map((a) => ({ a, fails: countFails(a.answers) }))
      .filter((x) => x.fails > 0)
      .sort((x, y) => y.fails - x.fails);

    renderKpis({
      audits: audits.length,
      points: points.length,
      audited: Object.keys(latestByPoint).length,
      attention: attention.length,
    });
    renderAttention(attention, labelFor);
    renderActivity(audits.slice(0, 8), labelFor, countFails);
  } finally {
    dashboardLoading = false;
  }
}

function renderKpis(k) {
  const cards = [
    { num: k.attention, lbl: "Need attention", cls: k.attention > 0 ? "alert" : "good" },
    { num: `${k.audited}/${k.points}`, lbl: "Points audited", cls: "" },
    { num: k.audits, lbl: "Total audits", cls: "" },
    { num: k.points - k.audited, lbl: "Not yet audited", cls: "" },
  ];
  kpisEl.innerHTML = cards
    .map((c) => `<div class="kpi ${c.cls}"><div class="num">${c.num}</div><div class="lbl">${c.lbl}</div></div>`)
    .join("");
}

function renderAttention(list, labelFor) {
  attentionCount.textContent = list.length ? `${list.length}` : "";
  if (!list.length) {
    attentionEl.innerHTML = '<p class="empty">All clear — no failed checks on the latest audits. ✅</p>';
    return;
  }
  attentionEl.innerHTML = list
    .map(({ a, fails }) => {
      const l = labelFor(a.injection_point_id);
      const failedLabels = Object.entries(a.answers || {})
        .filter(([, v]) => v === "fail")
        .map(([k]) => (window.ITEM_BY_KEY[k] ? window.ITEM_BY_KEY[k].label : k));
      const chips = failedLabels.map((t) => `<span class="chip-fail">${esc(t)}</span>`).join("");
      return `<button type="button" class="row-card" data-acct="${l.account_id}" data-pt="${a.injection_point_id}">
          <div class="rc-main">
            <div class="rc-title">${esc(l.title)}</div>
            <div class="rc-sub">${esc(l.sub)} · ${fmtDate(a.audited_at)}</div>
            <div class="chips">${chips}</div>
          </div>
          <span class="badge fail">${fails} fail${fails === 1 ? "" : "s"}</span>
        </button>`;
    })
    .join("");
  attentionEl.querySelectorAll(".row-card").forEach((b) =>
    b.addEventListener("click", () => gotoPoint(b.dataset.acct, b.dataset.pt))
  );
}

function renderActivity(list, labelFor, countFails) {
  if (!list.length) {
    activityEl.innerHTML = '<p class="empty">No audits recorded yet. Head to the Audit tab to add the first one.</p>';
    return;
  }
  activityEl.innerHTML = list
    .map((a) => {
      const l = labelFor(a.injection_point_id);
      const fails = countFails(a.answers);
      const badge = fails > 0 ? `<span class="badge fail">${fails} fail${fails === 1 ? "" : "s"}</span>` : `<span class="badge pass">OK</span>`;
      return `<button type="button" class="row-card" data-acct="${l.account_id}" data-pt="${a.injection_point_id}">
          <div class="rc-main">
            <div class="rc-title">${esc(l.title)}</div>
            <div class="rc-sub">${fmtDate(a.audited_at)}${a.auditor ? " · " + esc(a.auditor) : ""}</div>
          </div>
          ${badge}
        </button>`;
    })
    .join("");
  activityEl.querySelectorAll(".row-card").forEach((b) =>
    b.addEventListener("click", () => gotoPoint(b.dataset.acct, b.dataset.pt))
  );
}

async function gotoPoint(accountId, pointId) {
  if (!accountId || !pointId) return;
  switchTab("audit");
  accountSelect.value = accountId;
  await onAccountChange();
  pointSelect.value = pointId;
  await onPointChange();
}

// ---------------------------------------------------------------------------
// Audit: data loading
// ---------------------------------------------------------------------------
async function loadAccounts() {
  const { data, error } = await sb.from("accounts").select("id,name").order("name");
  if (error) return fail("Could not load accounts", error);
  if (!data.length) {
    accountSelect.innerHTML = '<option value="">No accounts yet — add them in Supabase</option>';
    return;
  }
  accountSelect.innerHTML =
    '<option value="">Select an account…</option>' +
    data.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join("");
}

async function onAccountChange() {
  const accountId = accountSelect.value;
  pointView.hidden = true;
  currentPointId = null;
  if (!accountId) {
    pointSelect.disabled = true;
    pointSelect.innerHTML = '<option value="">Select an account first</option>';
    return;
  }
  pointSelect.disabled = true;
  pointSelect.innerHTML = '<option value="">Loading…</option>';
  const { data, error } = await sb
    .from("injection_points").select("id,tank,well").eq("account_id", accountId).order("tank");
  if (error) return fail("Could not load injection points", error);
  if (!data.length) {
    pointSelect.innerHTML = '<option value="">No injection points for this account</option>';
    return;
  }
  pointSelect.disabled = false;
  pointSelect.innerHTML =
    '<option value="">Select an injection point…</option>' +
    data.map((p) => `<option value="${p.id}" data-tank="${esc(p.tank)}" data-well="${esc(p.well)}">${esc(p.tank)} → ${esc(p.well)}</option>`).join("");
}

async function onPointChange() {
  currentPointId = pointSelect.value || null;
  if (!currentPointId) { pointView.hidden = true; return; }
  const opt = pointSelect.selectedOptions[0];
  pointSummary.textContent = `${opt.dataset.tank} → ${opt.dataset.well}`;
  resetForm();
  pointView.hidden = false;
  await loadHistory();
}

// ---------------------------------------------------------------------------
// Form rendering
// ---------------------------------------------------------------------------
function buildForm() {
  form.innerHTML = window.AUDIT_SECTIONS.map(renderSection).join("");
  form.addEventListener("click", (e) => {
    const btn = e.target.closest(".toggle button");
    if (!btn) return;
    const group = btn.parentElement;
    const already = btn.getAttribute("aria-pressed") === "true";
    group.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false"));
    btn.setAttribute("aria-pressed", already ? "false" : "true");
    group.dataset.value = already ? "" : btn.dataset.val;
  });
}

function renderSection(section) {
  const items = section.items.map((item) =>
    item.type === "toggle" ? renderToggleItem(item) : renderRecordItem(item)
  );
  return `<div class="section"><h3>${esc(section.title)}</h3>${items.join("")}</div>`;
}

function renderToggleItem(item) {
  const buttons = TOGGLE_VALUES.map(
    (v) => `<button type="button" data-val="${v}" aria-pressed="false">${TOGGLE_LABELS[v]}</button>`
  ).join("");
  return `<div class="item">
      <span class="item-label">${esc(item.label)}</span>
      <span class="toggle" data-key="${item.key}" data-value="">${buttons}</span>
    </div>`;
}

function renderRecordItem(item) {
  const id = `f_${item.key}`;
  const ph = item.placeholder ? ` placeholder="${esc(item.placeholder)}"` : "";
  const input =
    item.type === "number"
      ? `<div class="input-unit"><input type="number" step="any" inputmode="decimal" id="${id}" data-key="${item.key}"${ph} />${item.unit ? `<span class="unit">${esc(item.unit)}</span>` : ""}</div>`
      : `<input type="text" id="${id}" data-key="${item.key}"${ph} />`;
  return `<div class="item record">
      <label class="item-label" for="${id}">${esc(item.label)}</label>
      ${input}
    </div>`;
}

function resetForm() {
  form.querySelectorAll(".toggle").forEach((g) => {
    g.dataset.value = "";
    g.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false"));
  });
  form.querySelectorAll("input").forEach((i) => (i.value = ""));
  generalNotes.value = "";
  formStatus.textContent = "";
}

function collectAnswers() {
  const answers = {};
  form.querySelectorAll(".toggle").forEach((g) => { if (g.dataset.value) answers[g.dataset.key] = g.dataset.value; });
  form.querySelectorAll("input[data-key]").forEach((i) => {
    const v = i.value.trim();
    if (v !== "") answers[i.dataset.key] = i.type === "number" ? Number(v) : v;
  });
  return answers;
}

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------
async function saveAudit() {
  if (!currentPointId) return;
  const answers = collectAnswers();
  if (Object.keys(answers).length === 0) { formStatus.textContent = "Answer at least one item before saving."; return; }
  saveBtn.disabled = true;
  formStatus.textContent = "Saving…";
  const { error } = await sb.from("audits").insert({
    injection_point_id: currentPointId,
    auditor: currentUser ? currentUser.email : null,
    answers,
    notes: generalNotes.value.trim() || null,
  });
  saveBtn.disabled = false;
  if (error) { formStatus.textContent = ""; return fail("Could not save audit", error); }
  resetForm();
  toast("Audit saved");
  await loadHistory();
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------
async function loadHistory() {
  historyEl.innerHTML = '<p class="muted">Loading…</p>';
  const { data, error } = await sb
    .from("audits").select("id,auditor,audited_at,answers,notes")
    .eq("injection_point_id", currentPointId).order("audited_at", { ascending: false });
  if (error) return fail("Could not load history", error);
  historyCount.textContent = data.length ? `${data.length} audit${data.length === 1 ? "" : "s"}` : "";
  if (!data.length) { historyEl.innerHTML = '<p class="empty">No audits recorded yet for this injection point.</p>'; return; }
  historyEl.innerHTML = data.map(renderHistoryEntry).join("");
  historyEl.querySelectorAll(".del-audit").forEach((b) => b.addEventListener("click", () => deleteAudit(b.dataset.id)));
}

function renderHistoryEntry(a) {
  const answers = a.answers || {};
  let pass = 0, failc = 0;
  for (const v of Object.values(answers)) { if (v === "pass") pass++; else if (v === "fail") failc++; }
  const badges =
    (failc ? `<span class="badge fail">${failc} fail</span>` : "") +
    (pass ? `<span class="badge pass">${pass} pass</span>` : "");
  const sections = window.AUDIT_SECTIONS.map((s) => {
    const rows = s.items.filter((it) => answers[it.key] !== undefined).map((it) => renderAnswerRow(it, answers[it.key])).join("");
    return rows ? `<div class="ds"><h4>${esc(s.title)}</h4>${rows}</div>` : "";
  }).join("");
  const notes = a.notes ? `<div class="ds"><h4>Notes</h4><div class="ans-row">${esc(a.notes)}</div></div>` : "";
  return `<details class="audit-entry">
      <summary>
        <span><span class="when">${fmtDate(a.audited_at)}</span>${a.auditor ? `<span class="who"> · ${esc(a.auditor)}</span>` : ""}</span>
        <span class="badges">${badges}</span>
      </summary>
      <div class="audit-detail">${sections}${notes}
        <button type="button" class="del-audit" data-id="${a.id}">Delete this audit</button>
      </div>
    </details>`;
}

function renderAnswerRow(item, value) {
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

async function deleteAudit(id) {
  if (!confirm("Delete this audit permanently?")) return;
  const { error } = await sb.from("audits").delete().eq("id", id);
  if (error) return fail("Could not delete audit", error);
  toast("Audit deleted");
  await loadHistory();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
let toastTimer;
function toast(msg, isError) {
  toastEl.textContent = msg;
  toastEl.className = "toast" + (isError ? " error" : "");
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.hidden = true), 3000);
}
function fail(msg, error) {
  console.error(msg, error);
  toast(msg + (error && error.message ? `: ${error.message}` : ""), true);
}
