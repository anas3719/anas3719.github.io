const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'works-data.js'), 'utf8'), context);
const works = context.window.portfolioWorks;
const receipt = require('./fixtures/portfolio-ugc-upload-20261108.json');

test('UGC snapshot follows verified video upload dates, newest first', () => {
  assert.deepEqual(Array.from(works.ugc, work => work.brand), receipt.works.map(work => work.brand));
  const dates = receipt.works.map(work => Date.parse(work.uploadedAt));
  assert.ok(dates.every(Number.isFinite));
  assert.ok(dates.every((date, index) => index === 0 || dates[index - 1] >= date));
  assert.equal(works.ugc[0].brand, 'مستقبل اللغات');
  assert.equal(works.ugc[1].brand, 'مهل');
});

test('new work targets and refreshed multi-video folder do not select a random clip', () => {
  const ford = works.regular.find(work => work.brand === 'فورد');
  assert.equal(ford.type, 'folder');
  assert.equal(ford.url, 'https://drive.google.com/drive/folders/1GvNy0nSUv_plrGrTgxbQApp2lj1H2JWk');
  assert.equal(ford.featuredVideo, undefined);
  const future = works.ugc.find(work => work.brand === 'مستقبل اللغات');
  assert.equal(future.type, 'folder');
  assert.equal(future.url, 'https://drive.google.com/drive/folders/1KPwQtgB16skRyE1jLH9hKbH8ZvgUpSwO');
  assert.equal(future.featuredVideo, undefined);
  assert.equal(works.ugc.find(work => work.brand === 'مهل').type, 'video');
  assert.equal(works.regular.length, 54);
  assert.equal(works.ugc.length, 47);
});
