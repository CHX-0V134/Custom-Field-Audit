# Field Audit

A lightweight web app for capturing field audit info on chemical injection
points (tank → well), backed by [Supabase](https://supabase.com). Every audit is
saved as a dated record, so you get full history per injection point over time.

- **Email whitelist login** — only addresses in `allowed_emails` can sign in
  (passwordless magic link). The auditor is auto-set to the signed-in email.
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

All three tables are gated by Row Level Security so only signed-in, whitelisted
users can read or write. `accounts` and `injection_points` are otherwise managed
in Supabase (master list), and `audits` is read/write for authorized users.

## Managing the email whitelist

The list of who can sign in lives in the `allowed_emails` table. Add or remove
addresses in the Supabase SQL editor:

```sql
insert into public.allowed_emails (email) values ('new.person@company.com');
delete from public.allowed_emails where email = 'former.person@company.com';
```

Removing an email revokes access immediately. The auth setup lives in
`supabase/auth_whitelist.sql`.

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

The repo can be public — the app still requires a whitelisted email login. The
Supabase publishable key in `config.js` is meant to be public; access is governed
by Row Level Security and the email whitelist, not by hiding the key.

For magic-link login to work, set the **Site URL** and a **Redirect URL** to your
Pages URL in Supabase → Authentication → URL Configuration.

## Running locally

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```
