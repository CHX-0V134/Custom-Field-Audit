"use strict";

const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);

// ---- DOM refs ----
const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const userBar = document.getElementById("user-bar");
const userEmailEl = document.getElementById("user-email");
const signoutBtn = document.getElementById("signout-btn");
const loginEmail = document.getElementById("login-email");
const loginBtn = document.getElementById("login-btn");
const loginStatus = document.getElementById("login-status");

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
const STORAGE_KEY = "audit_user_email";
const TOGGLE_VALUES = ["pass", "fail", "na"];
const TOGGLE_LABELS = { pass: "Pass", fail: "Fail", na: "N/A" };

// ---------------------------------------------------------------------------
// Access gate (email checked against the whitelist; no password / no email link)
// ---------------------------------------------------------------------------
buildForm();
loginBtn.addEventListener("click", enterApp);
loginEmail.addEventListener("keydown", (e) => { if (e.key === "Enter") enterApp(); });
signoutBtn.addEventListener("click", signOut);

restoreSession();

// On load, re-check the saved email against the whitelist so removing someone
// locks them out on their next visit.
async function restoreSession() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return showLoggedOut();
  const { data: allowed, error } = await sb.rpc("is_email_allowed", { check_email: saved });
  if (error) return showLoggedOut(); // can't verify → require re-entry
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
  if (!allowed) {
    loginStatus.textContent = "That email isn't on the authorized list.";
    return;
  }
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
  appView.hidden = false;
  userBar.hidden = false;
  userEmailEl.textContent = email;
  auditorDisplay.textContent = email;
  if (!accountSelect.dataset.loaded) {
    accountSelect.dataset.loaded = "1";
    loadAccounts();
    accountSelect.addEventListener("change", onAccountChange);
    pointSelect.addEventListener("change", onPointChange);
    saveBtn.addEventListener("click", saveAudit);
  }
}

function showLoggedOut() {
  currentUser = null;
  appView.hidden = true;
  userBar.hidden = true;
  loginView.hidden = false;
}

// ---------------------------------------------------------------------------
// Data loading
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
    .from("injection_points")
    .select("id,tank,well")
    .eq("account_id", accountId)
    .order("tank");
  if (error) return fail("Could not load injection points", error);
  if (!data.length) {
    pointSelect.innerHTML = '<option value="">No injection points for this account</option>';
    return;
  }
  pointSelect.disabled = false;
  pointSelect.innerHTML =
    '<option value="">Select an injection point…</option>' +
    data
      .map((p) => `<option value="${p.id}" data-tank="${esc(p.tank)}" data-well="${esc(p.well)}">${esc(p.tank)} → ${esc(p.well)}</option>`)
      .join("");
}

async function onPointChange() {
  currentPointId = pointSelect.value || null;
  if (!currentPointId) {
    pointView.hidden = true;
    return;
  }
  const opt = pointSelect.selectedOptions[0];
  pointSummary.textContent = `Tank ${opt.dataset.tank} · Well ${opt.dataset.well}`;
  resetForm();
  pointView.hidden = false;
  await loadHistory();
}

// ---------------------------------------------------------------------------
// Form rendering (driven by questions.js)
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
      ? `<div class="input-unit"><input type="number" step="any" id="${id}" data-key="${item.key}"${ph} />${item.unit ? `<span class="unit">${esc(item.unit)}</span>` : ""}</div>`
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
  form.querySelectorAll(".toggle").forEach((g) => {
    if (g.dataset.value) answers[g.dataset.key] = g.dataset.value;
  });
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
  if (Object.keys(answers).length === 0) {
    formStatus.textContent = "Answer at least one item before saving.";
    return;
  }
  saveBtn.disabled = true;
  formStatus.textContent = "Saving…";
  const { error } = await sb.from("audits").insert({
    injection_point_id: currentPointId,
    auditor: currentUser ? currentUser.email : null,
    answers,
    notes: generalNotes.value.trim() || null,
  });
  saveBtn.disabled = false;
  if (error) {
    formStatus.textContent = "";
    return fail("Could not save audit", error);
  }
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
    .from("audits")
    .select("id,auditor,audited_at,answers,notes")
    .eq("injection_point_id", currentPointId)
    .order("audited_at", { ascending: false });
  if (error) return fail("Could not load history", error);
  historyCount.textContent = data.length ? `${data.length} audit${data.length === 1 ? "" : "s"}` : "";
  if (!data.length) {
    historyEl.innerHTML = '<p class="muted">No audits recorded yet for this injection point.</p>';
    return;
  }
  historyEl.innerHTML = data.map(renderHistoryEntry).join("");
  historyEl.querySelectorAll(".del-audit").forEach((b) =>
    b.addEventListener("click", () => deleteAudit(b.dataset.id))
  );
}

function renderHistoryEntry(a) {
  const answers = a.answers || {};
  let pass = 0, failc = 0;
  for (const v of Object.values(answers)) {
    if (v === "pass") pass++;
    else if (v === "fail") failc++;
  }
  const badges =
    (failc ? `<span class="badge fail">${failc} fail</span>` : "") +
    (pass ? `<span class="badge pass">${pass} pass</span>` : "");

  const sections = window.AUDIT_SECTIONS.map((s) => {
    const rows = s.items
      .filter((it) => answers[it.key] !== undefined)
      .map((it) => renderAnswerRow(it, answers[it.key]))
      .join("");
    return rows ? `<div class="ds"><h4>${esc(s.title)}</h4>${rows}</div>` : "";
  }).join("");

  const notes = a.notes ? `<div class="ds"><h4>Notes</h4><div class="ans-row">${esc(a.notes)}</div></div>` : "";

  return `<details class="audit-entry">
      <summary>
        <span>
          <span class="when">${fmtDate(a.audited_at)}</span>
          ${a.auditor ? `<span class="who"> · ${esc(a.auditor)}</span>` : ""}
        </span>
        <span class="badges">${badges}</span>
      </summary>
      <div class="audit-detail">
        ${sections}${notes}
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
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
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
