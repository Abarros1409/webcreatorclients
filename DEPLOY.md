# Deploying to Vercel

The site is a single static file. `public/index.html` is committed, so Vercel has nothing to
build — it just serves the folder.

## First deploy

1. On [vercel.com](https://vercel.com), **Add New → Project**, and import
   `Abarros1409/webcreatorclients`.
2. Framework preset: **Other**. Leave the build command empty.
3. Output directory: **`public`** — `vercel.json` already sets this, so the field should
   fill itself in. If Vercel shows a 404 after deploying, this is the setting to check.
4. Deploy. The URL it gives you works for anyone, signed in or not.

Pick the branch you want it to track. `main` is the usual choice; if you deploy the
`claude/netherlands-restaurant-leads-539zwn` branch before merging, Vercel treats it as a
preview deployment.

## Updating the data

`public/index.html` is generated, not hand-edited. To change the leads or the scoring:

```bash
# edit data/leads_raw.jsonl or the scoring in build_dashboard.py, then
python3 build_dashboard.py
git add -A && git commit -m "Refresh leads" && git push
```

Vercel redeploys on push. Editing `public/index.html` directly works until the next build
overwrites it — change `template.html` or `build_dashboard.py` instead.

## What the call log does on Vercel

**Per browser, not shared.** Vercel serves a static page; there is no server storing anything,
so each visitor's ticks and notes live in their own browser's `localStorage`. You and anyone
else opening the URL see the same 121 leads and completely separate call logs.

Use **Export log** / **Import log** to move a log between people — the newest edit per business
wins on merge.

Making the log genuinely shared needs somewhere to put it: a Vercel KV or Postgres store with a
small API route, a Google Sheet, or any hosted database. That is a real change to the page, not
a setting.
