// Automatic updater for the WMSC Dock water quality table.
//
// Why a browser, not a simple fetch?
// The public Xylem dashboard is a JavaScript app shell. A plain HTTP fetch
// returns the app shell, not the rendered table, and no public JSON API,
// export link, or embed option was found on the page. So this script runs
// a headless browser, waits for the rendered "WMSC Dock - Water Quality
// Summary" table, reads its 5 rows, and regenerates index.html.
// It never logs in, never uses credentials, and only reads the public
// dashboard. If the scrape fails, it exits non-zero WITHOUT overwriting
// index.html, so the previously published page stays up.

import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const DASHBOARD_URL = 'https://cloud.xylem.com/xc-platman-webapp/public-dashboard/6a837c1e80c63825081139f6';
const WANTED = ['temperature', 'salinity', 'dissolvedoxygen', 'chlorophyll', 'phycocyanin'];

function tempDisplay(celsius) {
  const c = Math.round(celsius);
  const f = Math.round(celsius * 9 / 5 + 32);
  return `${c} °C / ${f} °F`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function generateHtml(d) {
  // d: { temperature: {latest, avg}, salinity: {...}, ... } — raw numbers as strings
  // Last-updated time is the time this run scraped the dashboard, in Pacific Time,
  // rounded to the closest hour (e.g. a 1:07 PM run shows 1:00 PM, a 1:40 PM run shows 2:00 PM).
  // Pacific Time is a whole number of hours behind UTC, so rounding in UTC and then
  // formatting in Pacific Time gives the same hour boundary.
  const rounded = new Date(Date.now() + 30 * 60 * 1000);
  rounded.setMinutes(0, 0, 0);
  const updated = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(rounded);
  const rows = [
    ['Temperature', 'Water temperature', tempDisplay(Number(d.temperature.latest)), tempDisplay(Number(d.temperature.avg)), ''],
    ['Salinity', 'PPTH', d.salinity.latest, d.salinity.avg, 'PPTH'],
    ['Dissolved Oxygen', '% saturation', d.dissolvedoxygen.latest, d.dissolvedoxygen.avg, '%'],
    ['Chlorophyll', 'RFU', d.chlorophyll.latest, d.chlorophyll.avg, 'RFU'],
    ['Phycocyanin', 'RFU', d.phycocyanin.latest, d.phycocyanin.avg, 'RFU'],
  ];
  const tbody = rows.map(([name, unit, latest, avg, suffix], i) => {
    const cls = i % 2 === 1 ? ' class="alt"' : '';
    const latestCell = suffix
      ? `${escapeHtml(latest)}<span>${suffix}</span>`
      : escapeHtml(latest);
    const avgCell = suffix
      ? `${escapeHtml(avg)}<span>${suffix}</span>`
      : escapeHtml(avg);
    return `      <tr${cls}>
        <td><span class="prop">${name}</span><span class="unit">${unit}</span></td>
        <td class="num">${latestCell}</td>
        <td class="num">${avgCell}</td>
      </tr>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>WMSC Dock — Water Quality Summary</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 14px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: transparent; color: #333333; }
  .card { max-width: 760px; margin: 0 auto; background: #ffffff; border: 1px solid #e8ddd0; border-radius: 16px; overflow: hidden; }
  .head { background: #a63d40; color: #ffffff; padding: 18px 20px 16px; border-bottom: 4px solid #f2c94c; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .head-left { flex: 1 1 auto; min-width: 0; }
  .head h1 { margin: 0; font-size: 21px; line-height: 1.2; }
  .head p { margin: 5px 0 0; font-size: 13.5px; line-height: 1.45; color: #f5e6d3; }
  .head a { color: #f2c94c; }
  .updated { flex: 0 0 auto; text-align: right; font-size: 12.5px; line-height: 1.4; color: #f5e6d3; padding-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 15px; }
  th { font-size: 11.5px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: #7a7a7a; text-align: right; padding: 12px 20px 10px; border-bottom: 2px solid #f2c94c; }
  th:first-child { text-align: left; }
  td { padding: 13px 20px; border-bottom: 1px solid #e8ddd0; vertical-align: middle; }
  td.num { text-align: right; font-size: 16px; font-weight: 600; white-space: nowrap; }
  td.num span { font-size: 12.5px; font-weight: 500; color: #7a7a7a; margin-left: 3px; }
  tr:last-child td { border-bottom: 0; }
  tr.alt { background: #fdf6d8; }
  .prop { font-weight: 600; }
  .unit { display: block; font-size: 12px; color: #7a7a7a; margin-top: 1px; font-weight: 400; }
  @media (max-width: 560px) {
    body { padding: 8px; }
    .head { padding: 12px 12px 10px; flex-direction: column; gap: 6px; }
    .head h1 { font-size: 19px; }
    .updated { text-align: left; padding-top: 0; }
    table { table-layout: fixed; font-size: 13.5px; }
    th { font-size: 10px; padding: 8px 8px 6px; white-space: nowrap; }
    th:first-child { width: 34%; }
    td { padding: 8px 8px; }
    td.num { font-size: 13.5px; white-space: normal; }
    td.num span { font-size: 11px; }
    .unit { font-size: 11px; }
  }
</style>
</head>
<body>
<main class="card">
  <div class="head">
    <div class="head-left">
      <h1>WMSC Dock — Water Quality Summary</h1>
      <p>Water quality at the dock, from the public <a href="${DASHBOARD_URL}" target="_blank" rel="noopener">HydroSphere dashboard</a>.</p>
    </div>
    <div class="updated">Last updated<br>${escapeHtml(updated)}</div>
  </div>
  <table>
    <thead>
      <tr><th>Measurement</th><th>Latest</th><th>1-Day Average</th></tr>
    </thead>
    <tbody>
${tbody}
    </tbody>
  </table>
</main>
</body>
</html>
`;
}

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle', timeout: 120000 });
  // The table renders client-side; wait for its rows to appear.
  await page.waitForTimeout(8000);

  const data = await page.evaluate(() => {
    const tables = Array.from(document.querySelectorAll('table'));
    for (const table of tables) {
      const rows = Array.from(table.querySelectorAll('tbody tr'));
      const found = {};
      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('th, td')).map((c) => c.innerText.trim());
        if (cells.length < 4) continue;
        const key = cells[0].toLowerCase().replace(/\s+/g, '');
        if (['temperature', 'salinity', 'dissolvedoxygen', 'chlorophyll', 'phycocyanin'].includes(key)) {
          // cells: [property, unit, latestValue, avg-1d]
          found[key] = { latest: cells[2], avg: cells[3] };
        }
      }
      if (Object.keys(found).length === 5) return found;
    }
    return null;
  });

  if (!data) {
    throw new Error('Could not find all 5 rows in the WMSC Dock summary table. Page layout may have changed; index.html was NOT overwritten.');
  }
  for (const key of WANTED) {
    if (!data[key] || !/^-?\d+(\.\d+)?$/.test(data[key].latest) || !/^-?\d+(\.\d+)?$/.test(data[key].avg)) {
      throw new Error(`Invalid or missing values for ${key}: ${JSON.stringify(data[key])}. index.html was NOT overwritten.`);
    }
  }

  console.log('Scraped values:', JSON.stringify(data, null, 2));
  writeFileSync('index.html', generateHtml(data));
  console.log('Wrote index.html');
} finally {
  await browser.close();
}
