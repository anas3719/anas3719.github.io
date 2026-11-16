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

test('folder targets preserve current owner-selected videos and unselected folders', () => {
  const ford = works.regular.find(work => work.brand === 'فورد');
  assert.equal(ford.type, 'folder');
  assert.equal(ford.url, 'https://drive.google.com/drive/folders/1GvNy0nSUv_plrGrTgxbQApp2lj1H2JWk');
  assert.equal(ford.featuredVideo.url, 'https://drive.google.com/file/d/1fRPekQGw9HqptrupN2NGJZlmUI2bNowJ/view');
  const future = works.ugc.find(work => work.brand === 'مستقبل اللغات');
  assert.equal(future.type, 'folder');
  assert.equal(future.url, 'https://drive.google.com/drive/folders/1KPwQtgB16skRyE1jLH9hKbH8ZvgUpSwO');
  assert.equal(future.featuredVideo, undefined);
  assert.equal(works.ugc.find(work => work.brand === 'مهل').type, 'video');
  assert.equal(works.regular.length, 56);
  assert.equal(works.ugc.length, 47);
});

test('p.team retains its folder and the video selected later by the owner', () => {
  const work = works.regular.find(work => work.brand === 'p.team');
  assert.equal(work.type, 'folder');
  assert.equal(work.url, 'https://drive.google.com/drive/folders/1fVGHAxeqpCdeUxBtuKNiK3EPVRqWQZbC');
  assert.equal(work.featuredVideo.url, 'https://drive.google.com/file/d/107MaLPo9fKyIFXZRiMqNHTpsj9lp1DLA/view');
  assert.equal(works.ugc.some(work => work.brand === 'p.team'), false);
  assert.equal(JSON.stringify(works).includes('1ChYtVKum9NcBR_wELr7_Mdo8RDCTAHCs'), false);
});

test('Aljazira Takaful opens the only video in its verified folder directly', () => {
  const work = works.regular.find(work => work.brand === 'الجزيرة تكافل');
  assert.equal(work.type, 'video');
  assert.equal(work.url, 'https://drive.google.com/file/d/1wOC9oaM4BMhCtBwl-Ft-v_lTihWmVtH2/view');
  assert.equal(work.preview, 'https://drive.google.com/file/d/1wOC9oaM4BMhCtBwl-Ft-v_lTihWmVtH2/preview');
});
