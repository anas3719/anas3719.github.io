const { chromium } = require(process.argv[2] || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const output = process.env.PORTFOLIO_QA_OUTPUT || require('node:os').tmpdir();
const initialSource = fs.readFileSync(path.join(root, 'works-data.js'), 'utf8');
const parsed = { window: {} };
vm.runInNewContext(initialSource, parsed);
const initial = JSON.parse(JSON.stringify(parsed.window.portfolioWorks));
const selected = initial.regular.find(work => work.type === 'video');
const folder = initial.regular.find(work => work.type === 'folder');
const fixture = structuredClone(initial);
fixture.regular.find(work => work.brand === folder.brand).featuredVideo = { url: selected.url, preview: selected.preview };
const fixtureSource = `window.portfolioWorks = ${JSON.stringify(fixture)};`;

async function main() {
  const mime = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json' };
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(`${root}${path.sep}`)) { response.writeHead(403).end(); return; }
    try {
      response.setHeader('Content-Type', mime[path.extname(file)] || 'text/html');
      response.end(fs.readFileSync(file));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' } : {}) });
  try {
    for (const width of [320, 390, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 2 });
      await context.route('https://drive.google.com/**', route => route.fulfill({ body: '' }));
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      // A synthetic selection tests rendering without choosing a real default for the owner.
      await page.route('**/works-data.js?*', route => route.fulfill({ contentType: 'text/javascript', body: fixtureSource }));
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => document.fonts.ready);
      for (const category of ['regular', 'ugc']) {
        await page.locator(`[data-work-category="${category}"]`).click();
        while (await page.locator('#showMoreWorks').isVisible()) await page.locator('#showMoreWorks').click();
        assert.equal(await page.locator('.work-card').count(), initial[category].length);
        await page.locator('.work-card__logo').evaluateAll(images => Promise.all(images.map(image => { image.loading = 'eager'; return image.decode(); })));
        const geometry = await page.locator('.work-card').evaluateAll(cards => cards.map(card => {
          const rect = card.getBoundingClientRect();
          const main = card.querySelector('.work-card__main').getBoundingClientRect();
          const art = card.querySelector('.work-card__artwork').getBoundingClientRect();
          const label = card.querySelector('.work-card__brand').getBoundingClientRect();
          const controls = [...card.querySelectorAll('.work-action')].map(button => {
            const bounds = button.getBoundingClientRect();
            return bounds.height >= 44 && bounds.left >= rect.left && bounds.right <= rect.right && button.scrollWidth <= button.clientWidth;
          });
          const logo = card.querySelector('.work-card__logo');
          let logoFits = true;
          if (logo) {
            const image = logo.getBoundingClientRect();
            const frame = window.portfolioBrandAssets[card.querySelector('.work-card__brand').textContent].frame;
            if (frame) {
              const [x, y, w, h] = frame;
              logoFits = image.left + image.width * x >= art.left - 1 && image.left + image.width * (x + w) <= art.right + 1 && image.top + image.height * y >= art.top - 1 && image.top + image.height * (y + h) <= art.bottom + 1;
            } else {
              const scale = Math.min(image.width / logo.naturalWidth, image.height / logo.naturalHeight);
              logoFits = scale > 0 && logo.naturalWidth * scale <= art.width + 1 && logo.naturalHeight * scale <= art.height + 1;
            }
          }
          return { brand: card.querySelector('.work-card__brand').textContent, controlsFit: controls.every(Boolean), labelFits: label.left >= rect.left && label.right <= rect.right && label.bottom <= main.bottom + 1, logoFits, nestedButtons: card.querySelector('button button') !== null };
        }));
        assert.ok(geometry.every(card => card.controlsFit && card.labelFits && card.logoFits && !card.nestedButtons), JSON.stringify(geometry.filter(card => !card.controlsFit || !card.labelFits || !card.logoFits || card.nestedButtons)));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      }
      await page.locator('[data-work-category="regular"]').click();
      const card = page.locator('.work-card').filter({ has: page.locator('.work-card__brand', { hasText: folder.brand }) }).first();
      await card.locator('.work-action--play').focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#videoModal').getAttribute('aria-hidden'), 'false');
      assert.equal(await page.locator('#videoFrame').getAttribute('src'), selected.preview);
      assert.equal(await page.locator('#videoExternalLink').getAttribute('href'), selected.url);
      await page.keyboard.press('Escape');
      const popupPromise = context.waitForEvent('page');
      await card.locator('.work-action--folder').click();
      const popup = await popupPromise;
      await popup.waitForURL(folder.url);
      assert.equal(await page.locator('#videoModal').getAttribute('aria-hidden'), 'true');
      await popup.close();
      await card.locator('.work-card__main').click();
      assert.equal(await page.locator('#videoFrame').getAttribute('src'), selected.preview);
      await page.keyboard.press('Escape');
      await card.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `portfolio-featured-fixture-${width}.png`) });

      // With actual unmodified data, no folder video is selected automatically.
      await page.unroute('**/works-data.js?*');
      await page.reload({ waitUntil: 'domcontentloaded' });
      const originalCard = page.locator('.work-card').first();
      assert.equal(await originalCard.locator('.work-action--play').isDisabled(), true);
      assert.equal(await originalCard.locator('.work-action--folder').isEnabled(), true);
      const folderPromise = context.waitForEvent('page');
      await originalCard.locator('.work-card__main').click();
      const originalPopup = await folderPromise;
      await originalPopup.waitForURL(folder.url);
      await originalPopup.close();
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ width, completeLogos: true, tapTargets44px: true, noNestedButtons: true, independentActions: true, selectedPlayback: true, noAutomaticSelection: true, noOverflow: true }));
      await context.close();
    }
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
