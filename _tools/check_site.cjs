// Integration checks against real generated hub data and a running Jekyll build.
// Requires Playwright externally; no browser dependency is shipped with the site.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../_data/plugins.json')));
const base = process.env.SITE_URL || 'http://localhost:4123';
const shots = process.env.SCREENSHOTS;

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, colorScheme: 'dark', reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    const theme = () => page.locator('html').getAttribute('data-theme');
    const choose = name => page.getByRole('radio', { name, exact: true }).check();
    const reset = async () => {
      await page.getByRole('button', {name:'Reset filters'}).click();
      await page.waitForFunction(() => [...document.querySelectorAll('.plugin-table tbody tr')].every(row => !row.hidden));
    };
    const beforeCSS = [];
    await page.route('**/assets/site.css', async route => {
      beforeCSS.push(await page.locator('html').getAttribute('data-theme'));
      await route.continue();
    });
    await page.goto(base);
    assert.equal(await theme(), 'dark', 'System defaults to the OS');
    assert.equal(beforeCSS.at(-1), 'dark', 'Theme is applied before the stylesheet loads');
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await choose('Dark');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.emulateMedia({ colorScheme: 'light' });
    assert.equal(await theme(), 'dark', 'Explicit choice ignores OS changes');
    await page.goto(`${base}/plugins/`);
    assert.equal(await theme(), 'dark', 'Explicit choice persists across pages');
    assert.equal(beforeCSS.at(-1), 'dark', 'Saved choice is applied before CSS on navigation');
    await page.reload();
    assert.equal(await theme(), 'dark', 'Explicit choice persists across reloads');
    await choose('System');
    assert.equal(await theme(), 'light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    await page.getByRole('radio', { name: 'System', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await theme(), 'light', 'Theme radios work with the keyboard');
    const focus = await page.locator('input[value=light] + span').evaluate(el => getComputedStyle(el).outlineStyle);
    assert.equal(focus, 'solid', 'Keyboard focus is visible');
    const paths = ['/', '/plugins/', ...data.hubs.map(h => `/plugins/${h.key}/`)];
    const viewports = [
      [320, 568], [360, 800], [390, 844], [768, 1024], [844, 390],
      [1024, 768], [1440, 900], [1920, 1080], [2560, 1440],
      [3440, 1440], [3840, 2160], [2560, 720],
    ];
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      for (const mode of ['Light', 'Dark']) {
        await choose(mode);
        for (const pathname of paths) {
          await page.goto(base + pathname);
          assert.equal(await page.locator('h1').count(), 1, `${pathname}: one primary heading`);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${pathname}: no page overflow at ${width}px / ${mode}`);
          assert.equal(await page.locator('.brand img').evaluate(img => img.complete && img.naturalWidth > 0), true, 'Brand asset loads');
          const layout = await page.evaluate(() => ({
            font: parseFloat(getComputedStyle(document.documentElement).fontSize),
            width: document.querySelector('main').getBoundingClientRect().width,
            controls: [...document.querySelectorAll('.theme-switch span, .plugin-filters input[type=search], .plugin-filters select, .reset-filters')].map(el => ({
              height: el.getBoundingClientRect().height, font: parseFloat(getComputedStyle(el).fontSize), field: el.matches('input,select'),
            })),
          }));
          assert.ok(layout.font >= 16 && layout.font <= 24, 'Typography stays readable and capped');
          if (width >= 1920 && height >= 1080) assert.ok(layout.font > 16, 'Large displays scale typography');
          if (width >= 1920 && height <= 720) assert.equal(layout.font, 16, 'Shallow widescreen windows retain compact typography');
          assert.ok(layout.width >= width * .85, 'Content uses the available viewport width');
          assert.ok(layout.controls.every(c => c.height >= 44), 'Theme and filter controls have touch-friendly heights');
          assert.ok(layout.controls.filter(c => c.field).every(c => c.font >= 16), 'Form text avoids small-font mobile auto-zoom');
        }
      }
    }
    await page.setViewportSize({ width: 1440, height: 1100 });
    for (const hub of data.hubs) {
      await page.goto(`${base}/plugins/${hub.key}/`);
      const groups = [hub.plugins, ...(hub.mods.length ? [hub.mods] : [])];
      const original = await page.locator('.plugin-table').evaluateAll(tables => tables.map(t => [...t.tBodies[0].rows].map(r => ({name:r.cells[0].querySelector('strong').textContent, text:r.textContent.toLowerCase(), envs:r.dataset.envs, hrefs:[...r.querySelectorAll('a')].map(a=>a.href)}))));
      for (let i = 0; i < groups.length; i++) {
        assert.equal(original[i].length, groups[i].length, `${hub.key}: all real entries rendered`);
        for (const entry of groups[i]) {
          const row = original[i].find(r => r.name === entry.name && r.hrefs.includes(entry.hub_entry));
          assert.ok(row?.hrefs.includes(entry.source), `${hub.key}: source/workshop and hub entry links preserved for ${entry.name}`);
        }
      }
      await page.getByRole('searchbox').fill('__no_such_plugin_1232__');
      assert.equal(await page.locator('.plugin-table tbody tr:visible').count(), 0);
      assert.equal(await page.locator('.plugin-empty:visible').count(), groups.length, 'Empty states shown');
      await reset();
      assert.equal(await page.locator('.plugin-table tbody tr:visible').count(), groups.flat().length, 'Reset restores the catalogue');
      const query = hub.plugins[0].name.slice(0, 5).toUpperCase();
      await page.getByRole('searchbox').fill(query);
      for (let i = 0; i < groups.length; i++) {
        const expected = original[i].filter(r => r.text.includes(query.toLowerCase())).length;
        assert.equal(await page.locator('.plugin-table').nth(i).locator('tbody tr:visible').count(), expected, 'Case-insensitive search');
      }
      await reset();
      const flavors = hub.flavors.length > 1 ? ['', ...hub.flavors] : [''];
      for (const flavor of flavors) {
        if (hub.flavors.length > 1) await page.getByRole('combobox', {name:`${hub.loader} flavor`, exact:true}).selectOption(flavor);
        for (const platform of hub.platforms) {
          await page.getByRole('combobox', {name:'Platform', exact:true}).selectOption(platform);
          for (let i = 0; i < groups.length; i++) {
            const compatible = groups[i].filter(e => !e.unavailable && e.environments.split(' ').some(pair => {
              const [f, p] = pair.split('/'); return (!flavor || f === flavor) && p === platform;
            }));
            const table = page.locator('.plugin-table').nth(i);
            assert.equal(await table.locator('tr.unavailable').count(), groups[i].length - compatible.length, `${hub.key}: ${flavor}/${platform} compatibility`);
            assert.equal(await table.locator('tr.unavailable .plugin-reason').evaluateAll(els => els.every(el=>el.textContent.startsWith('Unavailable:'))), true, 'Unavailable entries explain why');
            assert.equal(await table.locator('tbody').evaluate(el => {
              let unavailable = false;
              return [...el.rows].every(row => { if (row.classList.contains('unavailable')) unavailable = true; else if (unavailable) return false; return true; });
            }), true, 'Compatible entries are ordered first');
            await page.getByLabel('Hide unavailable', {exact:true}).check();
            assert.equal(await table.locator('tbody tr:visible').count(), compatible.length, 'Hide unavailable respects the selected setup');
            await page.getByLabel('Hide unavailable', {exact:true}).uncheck();
          }
        }
      }
      await reset();
      const details = page.locator('details').first();
      if (await details.count()) {
        await details.locator('summary').click();
        assert.equal(await details.getAttribute('open'), '', 'Native descriptions expand');
        await details.locator('summary').click();
      }
    }
    // Exercise the real controls after portrait/landscape reflow, including open content.
    const se1Sections = 1 + Number(data.hubs.find(h => h.key === 'se1').mods.length > 0);
    for (const [width, height] of [[320, 568], [844, 390]]) {
      await page.setViewportSize({width, height});
      await page.goto(`${base}/plugins/se1/`);
      await page.getByRole('combobox', {name:'Platform', exact:true}).selectOption('Linux');
      await page.getByLabel('Hide unavailable', {exact:true}).check();
      assert.equal(await page.locator('tr.unavailable:visible').count(), 0);
      await page.getByRole('searchbox').fill('__no_such_plugin__');
      assert.equal(await page.locator('.plugin-empty:visible').count(), se1Sections);
      await reset();
      await page.locator('details summary').first().click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Expanded descriptions fit mobile portrait and landscape');
    }
    // Text-only enlargement must reflow without hiding or clipping content.
    for (const width of [320, 1280]) {
      await page.setViewportSize({width, height:900});
      for (const pathname of paths) {
        await page.goto(base + pathname);
        await page.addStyleTag({content:':root{font-size:200% !important}'});
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${pathname}: 200% text reflows at ${width}px`);
        assert.equal(await page.locator('article,.quick-hubs a,.theme-switch,.plugin-filters').evaluateAll(els => els.every(el => el.scrollWidth <= el.clientWidth + 1)), true, 'Enlarged text stays inside cards and controls');
      }
    }
    await page.goto(base);
    for (const saved of ['garbage', '{bad-json', null]) {
      await page.evaluate(saved => { if (saved === null) localStorage.removeItem('cometworks-theme'); else localStorage.setItem('cometworks-theme', saved); }, saved);
      await page.emulateMedia({colorScheme:'dark'});
      await page.reload();
      assert.equal(await theme(), 'dark', 'Missing/corrupt preferences fall back to System');
      assert.equal(await page.getByRole('radio',{name:'System',exact:true}).isChecked(), true);
    }
    const blocked = await browser.newContext({ colorScheme:'dark' });
    await blocked.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
    });
    const restricted = await blocked.newPage();
    await restricted.goto(base);
    assert.equal(await restricted.locator('html').getAttribute('data-theme'), 'dark');
    await restricted.getByRole('radio',{name:'Light',exact:true}).check();
    assert.equal(await restricted.locator('html').getAttribute('data-theme'), 'light', 'Theme still changes when storage is blocked');
    await blocked.close();
    const noJS = await browser.newContext({javaScriptEnabled:false, colorScheme:'dark'});
    const staticPage = await noJS.newPage();
    await staticPage.goto(`${base}/plugins/se1/`);
    assert.equal(await staticPage.locator('.theme-switch').isVisible(), false);
    assert.equal(await staticPage.locator('.plugin-filters').isVisible(), false);
    assert.equal(await staticPage.locator('.plugin-table tbody tr').count(), data.hubs[0].plugins.length + data.hubs[0].mods.length, 'All entries remain available without JS');
    assert.equal(await staticPage.locator('html').evaluate(el=>getComputedStyle(el).colorScheme), 'dark', 'No-JS theme follows OS');
    await noJS.close();
    if (shots) {
      fs.mkdirSync(shots,{recursive:true});
      for (const mode of ['Light','Dark']) {
        await choose(mode);
        for (const [label, width, height] of [['desktop',1440,900],['mobile',390,844],['landscape',844,390],['qhd',2560,1440],['ultrawide',3440,1440],['4k',3840,2160]]) {
          await page.setViewportSize({width,height});
          for (const [name, pathname] of [['home','/'],['catalogue','/plugins/'],['se1','/plugins/se1/']]) {
            await page.goto(base+pathname);
            await page.screenshot({path:path.join(shots,`${name}-${label}-${mode.toLowerCase()}.png`),fullPage:name!=='se1'});
          }
        }
      }
    }
    assert.deepEqual(errors, [], 'No browser errors or failed site resources');
    console.log(`PASS: theme pre-paint/OS/persistence/keyboard/storage, ${viewports.length * paths.length * 2} responsive page/theme checks, mobile controls/expanded content, 200% text reflow, ${data.hubs.length} real hub catalogues, search/setup/hide/reset/order/details/links, and no-JS fallback.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
