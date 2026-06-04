# Field Audit

A lightweight web app for capturing field audit info on chemical injection
points (tank → well), backed by [Supabase](https://supabase.com). Every audit is
saved as a dated record, so you get full history per injection point over time.

- **No login** — anyone with the link can view data and record audits.
- **Static site** — plain HTML/JS, no build step. Hosts on GitHub Pages.
- **Tri-state checks** — each item is Pass / Fail / N/A.

## How it works

| File | Purpose |
|------|---------|
| `index.html` | Page shell |
| `questions.js` | **The audit questions** — single source of truth, edit here |
| `app.js` | Loads accounts/points, renders the form, saves & shows history |
| `config.js` | Supabase URL + publishable key (safe to commit) |
| `styles.css` | Styling |

Data lives in three Supabase tables:

- `accounts` — the accounts being audited
- `injection_points` — each tank and the well it serves, tied to an account
- `audits` — one row per audit visit; answers stored as JSON

`accounts` and `injection_points` are **read-only from the app** (managed in
Supabase) so the master list can't be wiped by accident. `audits` is fully
read/write.

## Editing the audit questions

Open `questions.js`. To reword a question, change its `label`. To add or remove
one, edit the `items` array. Keep each `key` stable — that's how answers are
stored. The form and the history view both update automatically.

## Adding accounts & injection points

Edit `seed.sql` with your real accounts and injection points, then run it in the
Supabase SQL editor (Dashboard → SQL Editor), or send the list and it can be
loaded for you.

## Deploying to GitHub Pages

1. Push this folder to a GitHub repo.
2. Repo **Settings → Pages → Build and deployment**.
3. Source: **Deploy from a branch**, Branch: **main**, Folder: **/ (root)**.
4. Save. Your app will be live at `https://<user>.github.io/<repo>/` in a minute.

Because the repo is public, anyone with the link can use the app. The Supabase
publishable key in `config.js` is meant to be public; access is governed by
Row Level Security, not by hiding the key.

## Running locally

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```
