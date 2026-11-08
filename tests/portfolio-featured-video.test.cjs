const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const admin = fs.readFileSync(path.join(root, 'portfolio-admin.js'), 'utf8');
const publicSource = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const context = vm.createContext({ URL });
vm.runInContext(admin.slice(admin.indexOf('  function normalizeWorks('), admin.indexOf('  function getSelectedRadio(')), context);
vm.runInContext(publicSource.slice(publicSource.indexOf('function getWorkVideo('), publicSource.indexOf('function getActiveWorks(')), context);
const folder = 'https://drive.google.com/drive/folders/folder-id';
const video = 'https://drive.google.com/file/d/selected-video-id/view?usp=sharing';
const plain = value => JSON.parse(JSON.stringify(value));

test('an optional selected video preserves the folder target and canonical video links', () => {
  const work = plain(context.normalizeDriveWork('Brand', 'folder', folder, video));
  assert.equal(work.url, folder);
  assert.equal(work.type, 'folder');
  assert.deepEqual(work.featuredVideo, {
    url: 'https://drive.google.com/file/d/selected-video-id/view',
    preview: 'https://drive.google.com/file/d/selected-video-id/preview',
  });
  assert.deepEqual(plain(context.getWorkVideo(work)), { brand: 'Brand', ...work.featuredVideo });
});

test('selected video survives load, serialize, category move and brand edits', () => {
  const original = context.normalizeDriveWork('Brand', 'folder', folder, video);
  let works = context.normalizeWorks({ regular: [original], ugc: [] });
  const moved = works.regular.pop();
  moved.brand = 'Updated';
  works.ugc.push(moved);
  const target = { window: {} };
  vm.runInNewContext(context.serializeWorks(works), target);
  works = context.normalizeWorks(target.window.portfolioWorks);
  assert.equal(works.ugc[0].featuredVideo.url, original.featuredVideo.url);
  assert.equal(works.ugc[0].url, folder);
  assert.equal(works.ugc[0].brand, 'Updated');
});

test('clearing the selected video or switching to direct video removes only the optional selection', () => {
  const work = context.normalizeDriveWork('Brand', 'folder', folder, '');
  assert.equal(work.featuredVideo, undefined);
  assert.equal(work.url, folder);
  assert.equal(context.getWorkVideo(work), null);
  const direct = context.normalizeDriveWork('Brand', 'video', video, video);
  assert.equal(direct.featuredVideo, undefined);
  assert.equal(context.getWorkVideo(direct).preview, direct.preview);
});

test('reject folder links, foreign domains and malformed selected video URLs', () => {
  for (const input of [folder, 'https://evil.example/file/d/fake/view', 'https://drive.google.com.evil.example/file/d/fake/view', 'javascript:alert(1)', 'https://drive.google.com/file/d/fake%22/view', 'https://docs.google.com/document/d/doc-id/edit']) {
    assert.throws(() => context.normalizeDriveWork('Brand', 'folder', folder, input), /الفيديو الرئيسي/);
    assert.equal(context.getWorkVideo({ type: 'folder', featuredVideo: { url: input } }), null);
  }
});

test('Drive sharing resource keys survive saved links, preview and public playback', () => {
  const work = context.normalizeDriveWork('Brand', 'folder', folder, `${video}&resourcekey=resource-key`);
  assert.equal(new URL(work.featuredVideo.url).searchParams.get('resourcekey'), 'resource-key');
  assert.equal(new URL(work.featuredVideo.preview).searchParams.get('resourcekey'), 'resource-key');
  assert.equal(new URL(context.getWorkVideo(work).preview).searchParams.get('resourcekey'), 'resource-key');
});

test('accept signed-in Drive paths and standard file sharing URLs', () => {
  assert.equal(context.detectLinkType('https://drive.google.com/drive/u/0/folders/folder-id'), 'folder');
  assert.equal(context.normalizeDriveWork('Brand', 'folder', 'https://drive.google.com/drive/u/0/folders/folder-id').url, folder);
  for (const link of ['https://drive.google.com/file/u/0/d/selected-video-id/view', 'https://drive.google.com/open?id=selected-video-id', 'https://drive.google.com/uc?id=selected-video-id']) {
    const work = context.normalizeDriveWork('Brand', 'folder', folder, link);
    assert.equal(work.featuredVideo.preview, 'https://drive.google.com/file/d/selected-video-id/preview');
  }
});

test('existing works and owner-selected videos load unchanged without inventing selections', () => {
  const data = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'works-data.js'), 'utf8'), data);
  assert.deepEqual(plain(context.normalizeWorks(data.window.portfolioWorks)), plain(data.window.portfolioWorks));
  for (const work of Object.values(data.window.portfolioWorks).flat().filter(work => work.type === 'folder')) {
    assert.equal(Boolean(context.getWorkVideo(work)), Boolean(work.featuredVideo));
  }
});
