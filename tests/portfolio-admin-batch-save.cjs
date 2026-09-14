const { chromium } = require(process.argv[2] || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');

async function main() {
  const root = path.resolve(__dirname, '..');
  const initialData = fs.readFileSync(path.join(root, 'works-data.js'), 'utf8');
  const initialIndex = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const parse = source => JSON.parse(source.slice(source.indexOf('{'), source.lastIndexOf('}') + 1));
  const initial = parse(initialData);
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = path.join(root, pathname);
    try {
      response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      response.end(fs.readFileSync(file));
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true,
    ...(process.platform === 'win32' ? { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' } : {}),
  });
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(() => localStorage.setItem('portfolio-admin-github-token', 'isolated-test-only'));
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      let publicData = initialData;
      let publicIndex = initialIndex;
      let published = false;
      const mutations = [];
      const blobs = [];
      await context.route('https://raw.githubusercontent.com/**', route => route.fulfill({
        body: route.request().url().includes('works-data.js') ? initialData : initialIndex,
      }));
      await context.route('https://drive.google.com/**', route => route.fulfill({ body: '' }));
      await context.route('**/works-data.js?admin=*', route => route.fulfill({ body: publicData }));
      await context.route('**/index.html?admin=*', route => route.fulfill({ body: publicIndex }));
      await context.route('https://api.github.com/**', async route => {
        const request = route.request();
        const url = request.url();
        const method = request.method();
        let result = {};
        if (method !== 'GET') mutations.push({ method, url });
        if (method === 'GET' && url.includes('/git/ref/')) result = { object: { sha: 'base-commit' } };
        else if (method === 'GET' && url.includes('/git/commits/')) result = { tree: { sha: 'base-tree' } };
        else if (url.endsWith('/git/blobs')) {
          blobs.push(Buffer.from(request.postDataJSON().content, 'base64').toString('utf8'));
          result = { sha: 'blob-' + blobs.length };
        } else if (url.endsWith('/git/trees')) result = { sha: 'next-tree' };
        else if (url.endsWith('/git/commits')) result = { sha: 'next-commit' };
        else if (method === 'PATCH') {
          publicData = blobs.find(value => value.startsWith('window.portfolioWorks'));
          publicIndex = blobs.find(value => value.includes('<!doctype html>'));
          assert.ok(publicData && publicIndex);
          published = true;
          result = { object: { sha: 'next-commit' } };
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
      });
      await page.goto(`http://127.0.0.1:${server.address().port}/portfolio-admin.html`);
      await page.waitForFunction(() => document.querySelector('#sync-status').textContent.includes('محدثة'));
      assert.equal(await page.locator('#publish-changes').isVisible(), true);
      assert.equal(await page.locator('#publish-changes').isEnabled(), false);

      await page.getByRole('button', { name: 'تعديل ' + initial.regular[0].brand, exact: true }).click();
      await page.locator('#work-brand').fill('العمل الأول المعدل');
      await page.getByRole('button', { name: 'تعديل ' + initial.regular[1].brand, exact: true }).click();
      await page.locator('#work-brand').fill('العمل الثاني المعدل');
      await page.locator('.profile-drag-handle').first().press('ArrowDown');
      await page.getByRole('button', { name: 'تعديل ' + initial.regular[2].brand, exact: true }).click();
      await page.locator('#delete-work').click();
      await page.locator('#confirm-delete').click();
      await page.locator('[data-category="ugc"]').click();
      await page.getByRole('button', { name: 'تعديل ' + initial.ugc[0].brand, exact: true }).click();
      await page.locator('#work-brand').fill('عمل UGC معدل');
      await page.locator('#add-work').click();
      await page.locator('#work-brand').fill('عمل جديد');
      await page.locator('#publish-changes').click();
      assert.equal(await page.locator('#form-error').isVisible(), true);
      assert.equal(mutations.length, 0);
      await page.locator('#work-url').fill('https://drive.google.com/file/d/test-new-video/view');
      assert.equal(mutations.length, 0);
      assert.equal(await page.locator('#github-dialog').evaluate(element => element.open), false);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await page.locator('#publish-changes').evaluate(element => element.scrollWidth <= element.clientWidth), true);
      await page.screenshot({ path: path.join(require('node:os').tmpdir(), `portfolio-batch-${width}.png`) });
      await page.locator('#publish-changes').click();
      await page.waitForFunction(() => document.querySelector('#sync-status').textContent.includes('تم النشر بنجاح'));
      assert.equal(published, true);
      assert.equal(mutations.filter(item => item.method === 'PATCH').length, 1);
      const next = parse(publicData);
      assert.equal(next.regular.length, initial.regular.length - 1);
      assert.equal(next.ugc.length, initial.ugc.length + 1);
      assert.equal(next.regular[0].brand, 'العمل الثاني المعدل');
      assert.equal(next.regular[1].brand, 'العمل الأول المعدل');
      assert.equal(next.ugc[0].brand, 'عمل UGC معدل');
      assert.equal(next.ugc.at(-1).brand, 'عمل جديد');
      assert.equal(await page.locator('#publish-changes').isEnabled(), false);
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ width, mutationsBeforeSave: 0, publicationCount: 1, allEditsIncluded: true, noOverflow: true }));
      await context.close();
    }
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
