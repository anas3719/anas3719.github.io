const { chromium } = require(process.argv[2] || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
async function main() {
  const root = path.resolve(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const data = fs.readFileSync(path.join(root, 'works-data.js'), 'utf8');
  const server = http.createServer((req, res) => {
    const file = path.join(root, new URL(req.url, 'http://localhost').pathname);
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.webp') ? 'image/webp' : 'text/html');
    try { res.end(fs.readFileSync(file)); } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      let writes = 0;
      await context.route('https://api.github.com/**', route => { writes++; return route.abort(); });
      await context.route('https://raw.githubusercontent.com/**', route => route.fulfill({ body: route.request().url().includes('works-data') ? data : html }));
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/portfolio-admin.html`);
      await page.waitForFunction(() => document.querySelector('#sync-status').textContent.includes('محدثة'));
      await page.getByRole('button', { name: 'المحتوى والصور', exact: true }).click();
      assert.equal(await page.getByLabel('النص البديل للصورة الرئيسية').count(), 0);
      assert.equal(await page.locator('.content-section:visible').count(), 2);
      assert.equal(await page.evaluate(source => window.portfolioContentEditor.apply(source), html), html);
      const tab = name => page.locator('.content-tabs').getByRole('tab', { name, exact: true });
      await tab('النبذة').click();
      await page.getByRole('textbox', { name: 'النبذة', exact: true }).fill('مسودة للتأكد من التنقل');
      assert.equal(await page.locator('.content-section:visible').count(), 1);
      assert.equal(await page.getByLabel('أزرار الواجهة 1').isVisible(), false);
      await tab('الأزرار والعناوين').click();
      await page.getByLabel('أزرار الواجهة 1').fill('تواصل معي');
      await tab('البيانات').click();
      await page.getByLabel('البيانات والمقاسات والمجالات 1').fill('جدة / 170 سم');
      await tab('النبذة').click();
      assert.equal(await page.getByRole('textbox', { name: 'النبذة', exact: true }).inputValue(), 'مسودة للتأكد من التنقل');
      await tab('النبذة').press('ArrowLeft');
      assert.equal(await tab('البيانات').getAttribute('aria-selected'), 'true');
      const saved = await page.evaluate(source => {
        const doc = new DOMParser().parseFromString(window.portfolioContentEditor.apply(source), 'text/html');
        return { bio: doc.querySelector('.lead').textContent, button: doc.querySelector('.hero-actions a').textContent, alt: doc.querySelector('.hero-media img').alt };
      }, html);
      assert.equal(saved.bio, 'مسودة للتأكد من التنقل');
      assert.equal(saved.button, 'تواصل معي');
      assert.ok(saved.alt.length > 0);
      assert.equal(writes, 0);
      await tab('الصور').click();
      await page.evaluate(() => scrollTo(0, 0));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: path.join(require('node:os').tmpdir(), `portfolio-tabs-${width}.png`) });
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ width, draftsRetained: true, oneCategoryVisible: true, noAutomaticWrites: true, noOverflow: true }));
      await context.close();
    }
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
