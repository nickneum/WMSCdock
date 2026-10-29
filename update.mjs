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
  body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: transparent; color: #000000; }
  .card { width: 100%; margin: 0; background: #ffffff; border: 1px solid #cccccc; border-radius: 0; overflow: hidden; }
  .head { background: #990000; color: #ffffff; padding: 14px 16px 12px; border-bottom: 4px solid #ffcc00; }
  .head h1 { margin: 0; font-size: 21px; line-height: 1.2; }
  .head p { margin: 5px 0 0; font-size: 13.5px; line-height: 1.45; color: #ffffff; }
  .head a { color: #ffcc00; }
  table { width: 100%; border-collapse: collapse; font-size: 15px; }
  th { font-size: 11.5px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: #767676; text-align: right; padding: 10px 16px 8px; border-bottom: 2px solid #ffcc00; }
  th:first-child { text-align: left; }
  td { padding: 11px 16px; border-bottom: 1px solid #cccccc; vertical-align: middle; }
  td.num { text-align: right; font-size: 16px; font-weight: 600; white-space: nowrap; }
  td.num span { font-size: 12.5px; font-weight: 500; color: #767676; margin-left: 3px; }
  tr:last-child td { border-bottom: 0; }
  tr.alt { background: #fff2bf; }
  .prop { font-weight: 600; }
  .unit { display: block; font-size: 12px; color: #767676; margin-top: 1px; font-weight: 400; }
</style>
</head>
<body>
<main class="card">
  <div class="head">
    <h1>WMSC Dock — Water Quality Summary</h1>
    <p>Water quality at the dock, from the public <a href="${DASHBOARD_URL}" target="_blank" rel="noopener">HydroSphere dashboard</a>.</p>
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
