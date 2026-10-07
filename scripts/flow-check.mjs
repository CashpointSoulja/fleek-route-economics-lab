// End-to-end flow check against a running preview (npx vite preview --port 4173).
// CHROME_PATH must point at a local Chrome/Chromium binary.
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL = process.env.APP_URL || 'http://localhost:4173/';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const verdict = (p, id) => p.locator(`#compare [data-testid=verdict-${id}]`).innerText();

for (const [label, vp] of [['desktop 1366', { width: 1366, height: 900 }], ['mobile 390', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: vp, acceptDownloads: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await p.goto(URL);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  check(`${label}: logo top-left`, await p.locator('header .brand img[alt=Fleek]').isVisible());
  const foot = await p.locator('footer').innerText();
  check(`${label}: footer disclaimer`, foot.includes('Independent concept by Ayomide Ahmed') && foot.includes('Not an official Fleek product'));
  check(`${label}: no horizontal page overflow`, !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  check(`${label}: no sign-in, booking or payment controls`, (await p.locator('text=/sign in|log in|book now|place order|pay now|checkout/i').count()) === 0);
  check(`${label}: profitable pilot A proceeds`, (await verdict(p, 'A')).startsWith('Proceed'));
  check(`${label}: profitable pilot B proceeds`, (await verdict(p, 'B')).startsWith('Proceed'));

  await p.selectOption('[data-action=case]', 'freight-stress');
  check(`${label}: freight stress A holds`, (await verdict(p, 'A')).startsWith('Hold'));
  const sensA = await p.locator('[data-testid=sens-A]').innerText();
  check(`${label}: freight stress row fails`, /Freight \+25%[^\n]*\n?[^\n]*Fails/.test(sensA) || sensA.split('\n').some((l) => l.includes('Freight +25%') && l.includes('Fails')));

  await p.selectOption('[data-action=case]', 'evidence-gap');
  const vb = await verdict(p, 'B');
  check(`${label}: evidence gap B blocked`, vb.startsWith('Blocked'), vb);
  const ev = await p.locator('[data-testid=evidence-B]').innerText();
  check(`${label}: tariff and IOR gates listed`, ev.includes('Tariff rate known') && ev.includes('Status: unknown'));
  const scaleB = await p.locator('[data-testid=scale-B]').innerText();
  check(`${label}: blocked scale card says not recommended`, scaleB.includes('Scale is not recommended'));
  const opts = await p.locator('form[data-log="1"] select[name=call] option').allInnerTexts();
  check(`${label}: no scale-gate call offered on blocked route`, !opts.includes('scale-gate'), opts.join(','));

  // Unknown tariff on a passing route blocks it even with a positive margin.
  await p.selectOption('[data-action=case]', 'profitable-pilot');
  await p.locator('[data-unknown="0|dutyRatePct"]').check();
  check(`${label}: ticking Unknown tariff blocks Route A`, (await verdict(p, 'A')).startsWith('Blocked'));
  await p.locator('[data-unknown="0|dutyRatePct"]').uncheck();
  check(`${label}: unticking restores Route A`, (await verdict(p, 'A')).startsWith('Proceed'));

  // Margin floor is user-set.
  await p.fill('[data-limit="limits.minMarginPct"]', '30');
  await p.locator('[data-limit="limits.minMarginPct"]').press('Tab');
  check(`${label}: raising margin floor to 30% fails Route A`, (await verdict(p, 'A')).startsWith('Fail'));
  await p.fill('[data-limit="limits.minMarginPct"]', '15');
  await p.locator('[data-limit="limits.minMarginPct"]').press('Tab');

  // Decision log entry, then edit makes it stale.
  await p.locator('form[data-log="0"] button[type=submit]').click();
  check(`${label}: decision recorded`, (await p.locator('[data-testid=log-table]').innerText()).includes('scale-gate'));
  await p.fill('[data-in="0|freightFixed"]', '450');
  await p.locator('[data-in="0|freightFixed"]').press('Tab');
  check(`${label}: decision goes stale after an input edit`, (await p.locator('[data-testid=log-table]').innerText()).includes('Stale'));

  // Export JSON and CSV, re-import both.
  const dir = mkdtempSync(join(tmpdir(), 'rel-'));
  for (const kind of ['json', 'csv']) {
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click(`[data-action=export-${kind}]`)]);
    const path = join(dir, `x.${kind}`);
    await dl.saveAs(path);
    await p.setInputFiles('[data-action=import]', path);
    const want = `Imported x.${kind}`;
    const ok = await p.waitForFunction((w) => document.querySelector('.notice')?.textContent?.includes(w), want, { timeout: 5000 }).then(() => true, () => false);
    check(`${label}: ${kind.toUpperCase()} export re-imports`, ok);
  }
  const bad = join(dir, 'bad.json');
  const good = JSON.parse(readFileSync(join(dir, 'x.json'), 'utf8'));
  good.scenario.routes[0].inputs.lotKg = 'lots';
  writeFileSync(bad, JSON.stringify(good));
  const before = await verdict(p, 'A');
  await p.setInputFiles('[data-action=import]', bad);
  await p.waitForFunction(() => document.querySelector('.notice')?.textContent?.includes('Import rejected'), null, { timeout: 5000 }).catch(() => {});
  const rej = (await p.locator('.notice').allInnerTexts()).join(' ');
  check(`${label}: malformed import rejected with field error`, rej.includes('Import rejected') && rej.includes('inputs.lotKg'), rej.replace(/\s+/g, ' ').slice(0, 100));
  check(`${label}: rejected import leaves state unchanged`, (await verdict(p, 'A')) === before);

  // Invalid value gives INVALID, and export is refused.
  await p.fill('[data-in="1|lotKg"]', '0');
  await p.locator('[data-in="1|lotKg"]').press('Tab');
  check(`${label}: zero lot weight is invalid`, (await verdict(p, 'B')).startsWith('Invalid'));
  await p.click('[data-action=export-json]');
  check(`${label}: export refused while invalid`, (await p.locator('.notice.error').innerText()).includes('Export refused'));

  // Tampered localStorage is discarded on load.
  await p.evaluate(() => localStorage.setItem('fleek-route-economics-lab/v1', JSON.stringify({ scenario: { schema: 'x' }, log: [] })));
  await p.reload();
  check(`${label}: tampered saved state discarded with notice`, (await p.locator('.notice').innerText()).includes('discarded'));
  check(`${label}: no console errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} flow checks passed`);
process.exit(failed ? 1 : 0);
