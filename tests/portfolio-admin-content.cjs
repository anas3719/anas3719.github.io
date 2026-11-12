const { chromium } = require(process.argv[2] || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');

async function main() {
  const root = path.resolve(__dirname, '..');
  const originalIndex = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const originalData = fs.readFileSync(path.join(root, 'works-data.js'), 'utf8');
  const photo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=', 'base64');
  const mime = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp4': 'video/mp4' };
  const server = http.createServer((request, response) => {
    const file = path.join(root, new URL(request.url, 'http://localhost').pathname);
    try {
      response.setHeader('Content-Type', mime[path.extname(file)] || 'text/html');
      response.end(fs.readFileSync(file));
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true,
    ...(process.platform === 'win32' ? { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' } : {}),
  });
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      context.setDefaultTimeout(12000);
      await context.addInitScript(() => localStorage.setItem('portfolio-admin-github-token', 'isolated-test-only'));
      const page = await context.newPage();
      const selectTab = name => page.locator('.content-tabs').getByRole('tab', { name, exact: true }).click();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      let publicIndex = originalIndex, publicData = originalData, failPublish = false;
      const mutations = [], blobs = new Map(), uploadedFiles = new Map(), trees = [];
      let nextTree;
      await context.route('https://raw.githubusercontent.com/**', route => route.fulfill({ body: route.request().url().includes('works-data.js') ? publicData : publicIndex }));
      await context.route('**/works-data.js?admin=*', route => route.fulfill({ body: publicData }));
      await context.route('**/index.html?admin=*', route => route.fulfill({ body: publicIndex }));
      await context.route('https://api.github.com/**', async route => {
        const request = route.request(), url = request.url(), method = request.method();
        if (method !== 'GET') mutations.push({ method, url });
        let result = {};
        if (method === 'GET' && url.includes('/git/ref/')) result = { object: { sha: 'base-commit' } };
        else if (method === 'GET' && url.includes('/git/commits/')) result = { tree: { sha: 'base-tree' } };
        else if (url.endsWith('/git/blobs')) {
          const sha = 'blob-' + blobs.size;
          blobs.set(sha, Buffer.from(request.postDataJSON().content, 'base64'));
          result = { sha };
        } else if (url.endsWith('/git/trees')) {
          nextTree = request.postDataJSON().tree;
          trees.push(nextTree);
          result = { sha: 'next-tree' };
        } else if (url.endsWith('/git/commits')) result = { sha: 'next-commit' };
        else if (method === 'PATCH') {
          assert.equal(request.postDataJSON().force, false);
          if (failPublish) return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ message: 'Isolated conflict test' }) });
          for (const file of nextTree) {
            const bytes = blobs.get(file.sha);
            if (file.path === 'index.html') publicIndex = bytes.toString('utf8');
            else if (file.path === 'works-data.js') publicData = bytes.toString('utf8');
            else uploadedFiles.set(file.path, bytes);
          }
          result = { object: { sha: 'next-commit' } };
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
      });
      const base = `http://127.0.0.1:${server.address().port}`;
      await page.goto(base + '/portfolio-admin.html');
      await page.waitForFunction(() => document.querySelector('#sync-status').textContent.includes('محدثة'));
      assert.equal(await page.evaluate(html => window.portfolioContentEditor.apply(html), originalIndex), originalIndex);
      await page.getByRole('button', { name: 'المحتوى والصور', exact: true }).click();
      assert.equal(await page.locator('.content-photo-row').count(), 6);
      await selectTab('النبذة');
      await page.getByLabel('الاسم', { exact: true }).fill('أنس للاختبار فقط');
      await page.getByRole('textbox', { name: 'النبذة', exact: true }).fill('نبذة تجريبية 170 سم، وليست للنشر الحقيقي.');
      await selectTab('البيانات');
      await page.getByLabel('البيانات والمقاسات والمجالات 1', { exact: true }).fill('الطول 170 سم / الوزن 74 كجم / جدة');
      await selectTab('التواصل');
      await page.getByLabel('رابط واتساب', { exact: true }).fill('https://wa.me/966500000000');
      await selectTab('إعدادات الصفحة');
      await page.getByLabel('عنوان الصفحة', { exact: true }).fill('بورتفوليو تجريبي');
      await selectTab('الصور');
      await page.locator('.content-photo-row').nth(1).getByRole('button', { name: 'تعيين كرئيسية' }).click();
      assert.match(await page.getByLabel('رابط الصورة', { exact: true }).first().inputValue(), /photo-2.webp$/);
      await page.evaluate(() => {
        const read = FileReader.prototype.readAsDataURL;
        FileReader.prototype.readAsDataURL = function (file) { setTimeout(() => read.call(this, file), 500); };
      });
      await page.getByLabel('رفع صورة من الجهاز', { exact: true }).first().setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: photo });
      assert.equal(await page.locator('#publish-changes').isDisabled(), true);
      assert.equal(await page.locator('#reload-data').isDisabled(), true);
      assert.equal(await page.locator('#portfolio-content-panel').evaluate(element => element.inert), true);
      await page.waitForFunction(() => !window.portfolioContentEditor.isPending());
      const heroPath = await page.getByLabel('رابط الصورة', { exact: true }).first().inputValue();
      assert.match(heroPath, /^assets\/uploads\/photo-.*\.png$/);
      await page.locator('.content-photo-row').first().getByRole('button', { name: 'حذف الصورة' }).click();
      await page.locator('.content-photo-row').first().getByRole('button', { name: 'بعد', exact: true }).click();
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'إضافة صورة', exact: true }).click();
      await (await chooser).setFiles({ name: 'second.png', mimeType: 'image/png', buffer: photo });
      await page.waitForFunction(() => !window.portfolioContentEditor.isPending());
      const galleryPath = await page.locator('.content-photo-row').last().getByLabel('رابط الصورة', { exact: true }).inputValue();
      await selectTab('الفيديو');
      await page.getByLabel('رابط ملف الفيديو', { exact: true }).fill('https://example.com/intro.webm');
      assert.equal(mutations.length, 0);
      await selectTab('التواصل');
      await page.getByLabel('رابط إنستغرام', { exact: true }).fill('javascript:alert(1)');
      await page.locator('#publish-changes').click();
      await page.waitForFunction(() => !document.body.classList.contains('is-busy'));
      assert.match(await page.locator('#sync-status').innerText(), /رابط التواصل غير صالح/);
      assert.equal(mutations.length, 0);
      await page.getByLabel('رابط إنستغرام', { exact: true }).fill('https://www.instagram.com/model.anas2/');
      failPublish = true;
      await page.locator('#publish-changes').click();
      await page.waitForFunction(() => !document.body.classList.contains('is-busy'));
      assert.equal(publicIndex, originalIndex);
      assert.equal(await page.getByLabel('الاسم', { exact: true }).inputValue(), 'أنس للاختبار فقط');
      assert.equal(await page.evaluate(() => window.portfolioContentEditor.files().length), 2);
      failPublish = false;
      await page.locator('#publish-changes').click();
      await page.waitForFunction(() => document.querySelector('#sync-status').textContent.includes('تم النشر بنجاح'));
      assert.equal(uploadedFiles.size, 2);
      for (const bytes of uploadedFiles.values()) assert.deepEqual(bytes, photo);
      assert.equal(await page.evaluate(() => window.portfolioContentEditor.files().length), 0);
      const proof = await page.evaluate(html => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return { name: doc.querySelector('h1').textContent, bio: doc.querySelector('.lead').textContent,
          hero: doc.querySelector('.hero-media img').getAttribute('src'),
          photos: [...doc.querySelectorAll('.gallery img')].map(image => image.getAttribute('src')),
          downloads: [...doc.querySelectorAll('.gallery button')].map(button => button.dataset.downloadSrc),
          video: doc.querySelector('video').getAttribute('src'), videoDownload: doc.querySelector('.intro-video-copy a').getAttribute('href'),
          videoFilename: doc.querySelector('.intro-video-copy a').download,
          whatsapp: doc.querySelector('.contact-panel a:last-child').getAttribute('href'),
          contactIcons: doc.querySelectorAll('.contact-panel svg').length,
          scripts: [...doc.scripts].map(script => script.getAttribute('src')), title: doc.title };
      }, publicIndex);
      assert.equal(proof.hero, heroPath);
      assert.equal(proof.photos.length, 6);
      assert.match(proof.photos[0], /photo-3.webp$/);
      assert.equal(proof.photos.at(-1), galleryPath);
      assert.equal(proof.downloads.at(-1), galleryPath);
      assert.match(proof.downloads[0], /photo-3.jpg$/);
      assert.equal(proof.video, 'https://example.com/intro.webm');
      assert.equal(proof.videoDownload, proof.video);
      assert.equal(proof.videoFilename, 'intro.webm');
      assert.equal(proof.whatsapp, 'https://wa.me/966500000000');
      assert.equal(proof.contactIcons, 3);
      assert.ok(proof.scripts.some(src => src.startsWith('work-brand-assets.js')));
      assert.equal(proof.name, 'أنس للاختبار فقط');
      assert.equal(proof.title, 'بورتفوليو تجريبي');
      assert.ok(proof.bio.includes('170 سم'));
      const parseWorks = value => JSON.parse(value.slice(value.indexOf('{'), value.lastIndexOf('}') + 1));
      assert.deepEqual(parseWorks(publicData), parseWorks(originalData));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await selectTab('النبذة');
      await page.getByLabel('الاسم', { exact: true }).focus();
      assert.equal(await page.getByLabel('الاسم', { exact: true }).evaluate(element => document.activeElement === element), true);
      await page.screenshot({ path: path.join(os.tmpdir(), `portfolio-content-${width}.png`) });
      await selectTab('الصور');
      await page.locator('.content-photo-row').first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(os.tmpdir(), `portfolio-content-gallery-${width}.png`) });
      await selectTab('النبذة');
      await page.getByRole('textbox', { name: 'النبذة', exact: true }).fill('تعديل لاحق');
      await page.locator('#publish-changes').click();
      await page.waitForFunction(() => document.querySelector('#sync-status').textContent.includes('تم النشر بنجاح'));
      assert.deepEqual(trees.at(-1).map(file => file.path).sort(), ['index.html', 'works-data.js']);
      await page.reload();
      await page.waitForFunction(() => document.querySelector('#sync-status').textContent.includes('محدثة'));
      await page.getByRole('button', { name: 'المحتوى والصور', exact: true }).click();
      await selectTab('النبذة');
      assert.equal(await page.getByRole('textbox', { name: 'النبذة', exact: true }).inputValue(), 'تعديل لاحق');
      assert.equal(await page.getByLabel('رابط الصورة', { exact: true }).first().inputValue(), heroPath);
      assert.equal(await page.locator('.content-photo-row').count(), 6);
      await context.route('**/content-public-test.html', route => route.fulfill({ contentType: 'text/html', body: publicIndex }));
      await context.route('**/assets/uploads/*', route => {
        const name = new URL(route.request().url()).pathname.slice(1);
        return route.fulfill({ contentType: 'image/png', body: uploadedFiles.get(name) });
      });
      await context.route('https://example.com/**', route => route.fulfill({ body: '' }));
      await page.goto(base + '/content-public-test.html');
      assert.equal(await page.locator('h1').innerText(), 'أنس للاختبار فقط');
      await page.waitForFunction(() => document.querySelector('.hero-media img').naturalWidth > 0);
      await page.locator('.shot-button').last().click();
      assert.equal(await page.locator('#imageModal').getAttribute('aria-hidden'), 'false');
      assert.equal(await page.locator('#imageDownloadLink').getAttribute('href'), galleryPath);
      assert.match(await page.locator('#imageDownloadLink').getAttribute('download'), /\.png$/);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#imageModal').getAttribute('aria-hidden'), 'true');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ width, noAutomaticWrites: true, originalBytesPreserved: true, failedSaveRetainsDraft: true, reloadPersistsContent: true, noOverflow: true }));
      await context.close();
    }
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
