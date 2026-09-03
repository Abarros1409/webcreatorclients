# Deploying to Vercel

The site is a single static file. It is committed as **`index.html` at the repo root**, with an
identical copy at `public/index.html`, so Vercel finds it whether the project serves the root or a
`public/` output directory. Nothing is built at deploy time.

> The first attempt set `outputDirectory: "public"` in `vercel.json` and served a 404 — the project
> was serving the repo root, where there was no `index.html`. Writing both copies removes the guess.

## First deploy

1. On [vercel.com](https://vercel.com), **Add New → Project**, and import
   `Abarros1409/webcreatorclients`.
2. Framework preset: **Other**. Leave the build command empty.
3. Output directory: leave it empty (the repo root). `index.html` is right there.
4. Deploy.

Pick the branch you want it to track. `main` is the usual choice; if you deploy the
`claude/netherlands-restaurant-leads-539zwn` branch before merging, Vercel treats it as a
preview deployment.

**Preview URLs may ask for a Vercel login.** On paid plans Vercel's Standard Protection covers
preview deployments while production stays public. If your friend hits a login wall, either merge to
`main` and share the production URL, or turn the protection off under
Project → Settings → Deployment Protection.

## Updating the data

`public/index.html` is generated, not hand-edited. To change the leads or the scoring:

```bash
# edit data/leads_raw.jsonl or the scoring in build_dashboard.py, then
python3 build_dashboard.py     # rewrites index.html, public/index.html and the artifact bodies
git add -A && git commit -m "Refresh leads" && git push
```

Vercel redeploys on push. Editing `index.html` directly works until the next build overwrites it —
change `template.html` or `build_dashboard.py` instead.

## What the call log does on Vercel

**Per browser, not shared.** Vercel serves a static page; there is no server storing anything,
so each visitor's ticks and notes live in their own browser's `localStorage`. You and anyone
else opening the URL see the same 121 leads and completely separate call logs.

Use **Export log** / **Import log** to move a log between people — the newest edit per business
wins on merge.

Making the log genuinely shared needs somewhere to put it: a Vercel KV or Postgres store with a
small API route, a Google Sheet, or any hosted database. That is a real change to the page, not
a setting.
