const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const context = { window: {} };
for (const file of ['works-data.js', 'work-brand-assets.js']) {
  vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
}
const assets = context.window.portfolioBrandAssets;
const works = Object.values(context.window.portfolioWorks).flat();

test('verified brand assets refer to existing works and local files', () => {
  for (const [brand, asset] of Object.entries(assets)) {
    assert.ok(works.some(work => work.brand === brand), brand);
    assert.match(asset.file, /^[a-z0-9-]+\.(svg|png|jpe?g|webp)$/);
    assert.ok(fs.statSync(path.join(root, 'assets/work-brands', asset.file)).size > 100);
    assert.match(asset.background, /^#[0-9a-f]{6}$/i);
    assert.match(asset.ink, /^#[0-9a-f]{6}$/i);
    if (asset.frame) {
      assert.equal(asset.frame.length, 4);
      const [x, y, width, height] = asset.frame;
      assert.ok([x, y, width, height].every(Number.isFinite));
      assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0);
      assert.ok(x + width <= 1.00001 && y + height <= 1.00001);
    }
  }
});

test('SVG assets contain no executable content or external dependencies', () => {
  for (const asset of Object.values(assets).filter(asset => asset.file.endsWith('.svg'))) {
    const svg = fs.readFileSync(path.join(root, 'assets/work-brands', asset.file), 'utf8');
    assert.match(svg, /<svg\b/);
    assert.doesNotMatch(svg, /<script\b|<foreignObject\b|onload\s*=|javascript:|(?:href|src)\s*=\s*["']https?:/i);
  }
});

test('catalog loads before rendering and independently of admin-editable data', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(html.indexOf('work-brand-assets.js') < html.indexOf('src="script.js'));
  assert.equal(works.length, 101);
  assert.ok(works.every(work => work.url.startsWith('https://drive.google.com/')));
});

test('every used logo retains recorded source provenance and exact bytes', () => {
  const audit = JSON.parse(fs.readFileSync(path.join(root, 'assets/work-brands/sources.json'), 'utf8'));
  for (const asset of Object.values(assets)) {
    const source = audit.records.find(record => record.file === asset.file);
    assert.ok(source && source.page && source.asset, asset.file);
    assert.notEqual(source.aiRestored, true, asset.file);
    assert.doesNotMatch(asset.file, /restored|generated/, asset.file);
    const digest = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'assets/work-brands', asset.file))).digest('hex');
    assert.equal(digest, source.sha256, asset.file);
  }
  assert.equal(audit.pending.length + Object.keys(assets).length, works.length);
});

test('the eight owner-approved name-only works have no unverified logo mapping', () => {
  const audit = JSON.parse(fs.readFileSync(path.join(root, 'assets/work-brands/sources.json'), 'utf8'));
  assert.equal(audit.scope.textOnlyApproved, true);
  assert.equal(audit.pending.length, 8);
  assert.equal(Object.keys(assets).length, 93);
  for (const work of audit.pending) {
    assert.ok(works.some(candidate => candidate.brand === work.brand), work.brand);
    assert.equal(Object.hasOwn(assets, work.brand), false, work.brand);
  }
});
