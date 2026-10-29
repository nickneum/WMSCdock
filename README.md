# WMSC Dock — Water Quality, automatic updater

A restyled version of just the top table from the public Xylem HydroSphere
dashboard ("WMSC Dock - Water Quality Summary"), hosted on GitHub Pages
and updated automatically every hour — with no manual re-uploads and no
chat messages.

## What it does

Every hour, a GitHub Actions workflow runs a headless browser, reads the
rendered public dashboard table (temperature, salinity, dissolved oxygen,
chlorophyll, phycocyanin — latest value and 1-day average), regenerates
`index.html`, and pushes it only if the values changed. GitHub Pages then
serves the new version at the same URL.

Temperature is rounded to the nearest whole degree, in both °C and °F at
the same size and weight. All other values are shown exactly as reported.
There is no subtitle, no snapshot date line, and no "Public Dashboard"
badge. The source is linked through the text "HydroSphere dashboard".

## Why a browser, not a simple fetch?

The dashboard is a JavaScript app shell. A plain HTTP fetch returns the
app shell, not the table, and no public JSON API, export link, or embed
option was found on the page. The updater therefore scrapes the rendered
table. It never logs in and never uses credentials — it only reads the
public dashboard.

## Setup (once)

1. Create a GitHub account if you don't have one yet.
2. Create a **public** repository (GitHub Pages on a free account works
   cleanly with public repos, and this data is public anyway). It can be
   empty to start.
3. Upload all the files in this package to the repository, keeping the
   folder structure exactly as-is:
   - `index.html` (in the repo root)
   - `update.mjs`
   - `package.json`
   - `.github/workflows/update.yml`
4. In the repo, go to **Settings → Actions → General → Workflow
   permissions** and choose **Read and write permissions**, then Save.
   This is what lets the workflow push the updated `index.html` back.
5. Go to **Settings → Pages → Build and deployment → Source** and choose
   **Deploy from a branch**, branch **main**, folder **/(root)**, then Save.
6. Test it: go to **Actions → Update WMSC Dock water quality → Run
   workflow**. Wait for it to finish (a few minutes — it installs a
   browser the first time), then open your Pages URL. It should show the
   table.
7. Your Pages URL will be:
   `https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/`

## Use it in WordPress

In WordPress, add a **Custom HTML** block and paste:

```html
<iframe src="https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/" width="100%" height="460" style="border:0;" loading="lazy" title="WMSC Dock Water Quality Summary"></iframe>
```

Replace `YOUR-USERNAME` and `YOUR-REPO-NAME` with your real values.
Test it in Preview first — some WordPress.com plans can strip iframes,
in which case paste the table directly instead (see below).

## If it stops updating

- Check **Actions** in the repo: a failed run leaves the previous page
  up (it never overwrites `index.html` with blank values), and the log
  will show why — most often Xylem changed the page layout, or the
  dashboard was temporarily unreachable.
- If Xylem changed the layout, the scraper in `update.mjs` (the part
  that looks for the 5 table rows) will need updating to match the new
  layout. The rest of the setup stays the same.

## Limitations to know about

- Updates are hourly on GitHub's schedule (top of the hour, UTC), not
  instant, and GitHub Actions schedules can run a few minutes late.
- GitHub's free tier includes a monthly Actions minutes allowance. An
  hourly browser run uses a few minutes each time; if you ever hit the
  limit, runs will pause until the allowance resets.
- This updater is silent by design: it does not send chat messages.
  You can see each run, and whether it changed anything, in the repo's
  **Actions** tab and commit history.
- The initial `index.html` in this package shows the values observed on
  29 Oct 2026 at about 10:02 a.m. PDT. The first scheduled run will
  replace them with the then-current values.
