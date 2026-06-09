// Functional E2E suite for BPM Tracker (Playwright, driving system Chrome).
// Usage: node e2e-functional.mjs [baseUrl]
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4280/';
const email = `claude-e2e-${Date.now()}@example.com`;
const password = 'E2e-Test-2026!';

const results = [];
const consoleErrors = [];
let page;

async function step(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  PASS  ${name}`);
  } catch (e) {
    results.push({ name, ok: false, error: e.message.split('\n')[0] });
    console.log(`  FAIL  ${name} — ${e.message.split('\n')[0]}`);
    try { await page.screenshot({ path: `/tmp/e2e-fail-${results.length}.png` }); } catch {}
  }
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
page = await ctx.newPage();
page.on('console', m => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});

console.log(`Running against ${BASE} as ${email}\n`);

// The library collapses to a strip once a song is selected; hovering expands it.
async function openLibrary() {
  await page.hover('app-song-pane');
  await page.waitForTimeout(650); // spring transition
}

await step('signup: fresh account lands in app', async () => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.click('button.link'); // switch to signup
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForSelector('.logout', { timeout: 20000 });
});

await step('logout button is visible (light bg, readable text)', async () => {
  const s = await page.locator('.logout').evaluate(el => {
    const cs = getComputedStyle(el);
    return { color: cs.color, bg: cs.backgroundColor };
  });
  if (s.bg !== 'rgb(255, 255, 255)') throw new Error(`bg is ${s.bg}, expected white`);
  if (s.color === s.bg) throw new Error('text color equals background');
});

await step('create song from default "All songs" view', async () => {
  const headerBtn = page.locator('app-song-pane .action');
  if (await headerBtn.isDisabled()) throw new Error('"New song" button is DISABLED on the default All songs view');
  await headerBtn.click();
  await page.waitForSelector('#new-song-title', { timeout: 3000 });
});

await step('create song via Unfiled (fallback path)', async () => {
  // recover from previous step if the form never opened
  if (!(await page.locator('#new-song-title').count())) {
    await page.getByText('Unfiled', { exact: false }).first().click();
    await page.locator('app-song-pane .action').click();
    await page.waitForSelector('#new-song-title', { timeout: 3000 });
  }
  await page.fill('#new-song-title', 'My First Song');
  await page.locator('.song-card.creating input[type="number"]').fill('120');
  await page.click('.song-card.creating .primary');
  await page.waitForSelector('.song-card:not(.creating) .song-title', { timeout: 8000 });
  const title = await page.locator('.song-title').first().textContent();
  if (!title.includes('My First Song')) throw new Error(`song title is "${title}"`);
});

await step('song is auto-selected, workspace shows it', async () => {
  await page.waitForSelector('.workspace .breadcrumb', { timeout: 5000 });
  const crumb = await page.locator('.workspace .breadcrumb').textContent();
  if (!crumb.includes('My First Song')) throw new Error(`breadcrumb is "${crumb}"`);
});

await step('add first part', async () => {
  await page.locator('.add-part').click();
  await page.fill('#new-part-title', 'Verse');
  await page.locator('.part-card.creating input[type="number"]').fill('16');
  await page.locator('.part-card.creating .primary').click();
  await page.waitForSelector('.part-card:not(.creating)', { timeout: 8000 });
  const txt = await page.locator('.part-card:not(.creating)').first().textContent();
  if (!txt.includes('Verse')) throw new Error(`part card says "${txt}"`);
  if (!txt.includes('0/16')) throw new Error(`expected 0/16 bars, card says "${txt}"`);
});

await step('part hero appears with metronome controls', async () => {
  await page.waitForSelector('.workspace .hero', { timeout: 5000 });
});

await step('add second part via Enter key', async () => {
  await page.locator('.add-part').click();
  await page.fill('#new-part-title', 'Chorus');
  await page.press('#new-part-title', 'Enter');
  await page.waitForFunction(
    () => document.querySelectorAll('.part-card:not(.creating)').length === 2,
    { timeout: 8000 },
  );
});

await step('adjust learnt bars up', async () => {
  // hero "+1 bar" style control: find buttons that adjust bars
  const before = await page.locator('.part-card.active .part-card-sub, .part-card:not(.creating)').last().textContent();
  const plus = page.locator('.hero button', { hasText: '+' }).first();
  await plus.click();
  await page.waitForTimeout(1200);
  const after = await page.locator('.part-card:not(.creating)').last().textContent();
  if (before === after) throw new Error('bar count did not change after +');
});

await step('persists after reload (data round-trips Supabase)', async () => {
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.logout', { timeout: 20000 });
  await openLibrary();
  await page.waitForSelector('.song-card', { timeout: 8000 });
  await page.locator('.song-card').first().click();
  await page.waitForFunction(
    () => document.querySelectorAll('.part-card:not(.creating)').length === 2,
    { timeout: 8000 },
  );
});

await step('delete a part', async () => {
  page.once('dialog', d => d.accept());
  // open the selected part's hero and use its delete control
  const del = page.locator('.hero button.danger, .hero .ghost.danger').first();
  if (!(await del.count())) throw new Error('no delete control found in hero');
  await del.click();
  await page.waitForFunction(
    () => document.querySelectorAll('.part-card:not(.creating)').length === 1,
    { timeout: 8000 },
  );
});

await step('create folder and song inside it', async () => {
  await page.locator('app-folder-rail button', { hasText: '+' }).first().click().catch(async () => {
    await page.locator('.folders .add, [aria-label*="folder" i]').first().click();
  });
  const input = page.locator('app-folder-rail input').first();
  await input.fill('Practice Set');
  await input.press('Enter');
  await page.waitForTimeout(800);
  await page.getByText('Practice Set').first().click();
  await openLibrary();
  const btn = page.locator('app-song-pane .action');
  if (await btn.isDisabled()) throw new Error('New song disabled inside a folder');
  await btn.click();
  await page.fill('#new-song-title', 'Folder Song');
  await page.press('#new-song-title', 'Enter');
  await page.waitForSelector('.song-card:not(.creating)', { timeout: 8000 });
});

await step('tap tempo sets working BPM near tapped rate', async () => {
  // go back to the song with parts
  await page.getByText('All songs').first().click();
  await openLibrary();
  await page.locator('.song-card', { hasText: 'My First Song' }).first().click();
  await page.waitForSelector('.hero', { timeout: 8000 });
  const tap = page.locator('.tap-btn');
  for (let i = 0; i < 5; i++) {
    await tap.click();
    await page.waitForTimeout(500); // ~120 BPM
  }
  await page.waitForTimeout(1000);
  const bpm = Number(await page.locator('.bpm-input').inputValue());
  if (bpm < 100 || bpm > 140) throw new Error(`expected ~120 BPM, got ${bpm}`);
});

await step('mark all learnt completes the part', async () => {
  await page.locator('.bars-quick button', { hasText: 'Mark all learnt' }).click();
  await page.waitForFunction(() => {
    const cur = document.querySelector('.bars-current')?.textContent;
    const tot = document.querySelector('.bars-total')?.textContent;
    return cur && tot && cur === tot;
  }, { timeout: 8000 });
  const chip = await page.locator('.state-chip').textContent();
  if (!/learnt/i.test(chip)) throw new Error(`state chip says "${chip}"`);
});

await step('reset returns learnt bars to 0', async () => {
  await page.locator('.bars-quick button', { hasText: 'Reset' }).click();
  await page.waitForFunction(
    () => document.querySelector('.bars-current')?.textContent === '0',
    { timeout: 8000 },
  );
});

await step('song search filters the library', async () => {
  await openLibrary();
  await page.fill('.search-input', 'folder');
  await page.waitForTimeout(400);
  const titles = await page.locator('.song-card:not(.creating) .song-title').allTextContents();
  if (titles.length !== 1 || !titles[0].includes('Folder Song')) {
    throw new Error(`expected only "Folder Song", got [${titles.join(', ')}]`);
  }
  await page.fill('.search-input', 'zzz-no-match');
  await page.waitForTimeout(400);
  const emptyTitle = await page.locator('.empty-card .empty-title').textContent();
  if (!emptyTitle.includes('No songs match')) throw new Error(`empty state says "${emptyTitle}"`);
  await page.click('.search-clear');
  await page.waitForTimeout(400);
  const after = await page.locator('.song-card:not(.creating)').count();
  if (after < 2) throw new Error(`expected all songs back after clear, got ${after}`);
});

await step('options panel opens via gear button', async () => {
  await page.click('.topbar-btn.gear');
  await page.waitForSelector('.options-panel', { timeout: 5000 });
});

await step('dark theme applies to the page', async () => {
  await page.locator('.options-panel .seg button', { hasText: 'Dark' }).click();
  await page.waitForTimeout(300);
  const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  if (theme !== 'dark') throw new Error(`data-theme is "${theme}"`);
  const bg = await page.locator('app-workspace').evaluate(el => getComputedStyle(el).backgroundColor);
  if (bg !== 'rgb(18, 18, 25)') throw new Error(`workspace canvas is ${bg}, expected dark`);
  // regression: "Start metronome" must keep contrast in dark mode
  const btn = await page.locator('.play-btn').evaluate(el => {
    const cs = getComputedStyle(el);
    return { fg: cs.color, bg: cs.backgroundColor };
  });
  if (btn.fg !== 'rgb(22, 22, 29)' || btn.bg !== 'rgb(242, 241, 247)') {
    throw new Error(`play-btn is ${btn.fg} on ${btn.bg} in dark mode`);
  }
});

await step('sound, volume and accent settings persist across reload', async () => {
  await page.locator('.options-panel .seg button', { hasText: 'Wood' }).click();
  await page.locator('.opt-group', { hasText: 'Accent' }).locator('button', { hasText: '4' }).click();
  await page.locator('.volume').fill('30');
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.logout', { timeout: 20000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('bpm-tracker-settings')));
  if (saved.theme !== 'dark') throw new Error(`persisted theme ${saved.theme}`);
  if (saved.sound !== 'wood') throw new Error(`persisted sound ${saved.sound}`);
  if (saved.beatsPerBar !== 4) throw new Error(`persisted beatsPerBar ${saved.beatsPerBar}`);
  if (Math.abs(saved.volume - 0.3) > 0.001) throw new Error(`persisted volume ${saved.volume}`);
  const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  if (theme !== 'dark') throw new Error(`theme after reload "${theme}"`);
});

await step('accent color is pickable and persists', async () => {
  await page.click('.topbar-btn.gear');
  await page.waitForSelector('.options-panel');
  await page.locator('.swatch[title="Teal"]').click();
  await page.waitForTimeout(300);
  const accent = await page.evaluate(() => ({
    attr: document.documentElement.getAttribute('data-accent'),
    value: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
  }));
  if (accent.attr !== 'teal') throw new Error(`data-accent is "${accent.attr}"`);
  if (accent.value.toUpperCase() !== '#14B8A6') throw new Error(`--accent is "${accent.value}"`);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('bpm-tracker-settings')));
  if (saved.accent !== 'teal') throw new Error(`persisted accent ${saved.accent}`);
  await page.locator('.swatch[title="Violet"]').click();
  await page.click('.options-close');
});

await step('switch back to light theme', async () => {
  await page.click('.topbar-btn.gear');
  await page.waitForSelector('.options-panel');
  await page.locator('.options-panel .seg button', { hasText: 'Light' }).click();
  await page.waitForTimeout(300);
  const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  if (theme !== 'light') throw new Error(`data-theme is "${theme}"`);
  await page.click('.options-close');
});

await step('logout returns to login screen', async () => {
  await page.click('.logout');
  await page.waitForSelector('input[name="email"]', { timeout: 10000 });
});

await step('login again, data still there', async () => {
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForSelector('.logout', { timeout: 20000 });
  await openLibrary();
  await page.waitForSelector('.song-card', { timeout: 8000 });
});

await browser.close();

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
const ng0600 = consoleErrors.filter(e => e.includes('NG0600')).length;
const otherErrs = [...new Set(consoleErrors.filter(e => !e.includes('NG0600') && !e.includes('LockManager')))];
console.log(`console: ${ng0600}x NG0600, other unique errors: ${otherErrs.length}`);
otherErrs.slice(0, 5).forEach(e => console.log('  ', e.slice(0, 160)));
process.exit(failed.length ? 1 : 0);
