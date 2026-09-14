const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../portfolio-admin.js'), 'utf8');
const key = 'portfolio-admin-github-token';
const legacy = 'cast-admin-github-token';

function storage(values = {}) {
  return {
    getItem: name => Object.hasOwn(values, name) ? values[name] : null,
    setItem: (name, value) => { values[name] = value; },
  };
}

function harness(local = storage(), session = storage()) {
  const context = vm.createContext({ window: { localStorage: local, sessionStorage: session } });
  const start = source.indexOf('  function loadStoredGithubToken()');
  const end = source.indexOf('  function encodeBase64Utf8', start);
  vm.runInContext(`const githubTokenStorageKey = '${key}'; const legacyGithubTokenStorageKey = '${legacy}';\n${source.slice(start, end)}`, context);
  return context;
}

test('remembered connection survives reload without changing the shared legacy key', () => {
  const local = storage({ [legacy]: 'test-legacy' });
  const first = harness(local);
  assert.equal(first.loadStoredGithubToken(), 'test-legacy');
  assert.equal(first.storeGithubToken('test-new', true), 'localStorage');
  assert.equal(harness(local).loadStoredGithubToken(), 'test-new');
  assert.equal(local.getItem(legacy), 'test-legacy');
});

test('disconnect does not resurrect a legacy connection', () => {
  const local = storage({ [legacy]: 'test-legacy' });
  const session = storage({ [legacy]: 'test-session' });
  harness(local, session).clearStoredGithubToken();
  assert.equal(harness(local, session).loadStoredGithubToken(), '');
});

test('blocked persistent storage still permits session storage and reports its scope', () => {
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  const session = storage();
  const context = harness(blocked, session);
  assert.equal(context.storeGithubToken('test-session', true), 'sessionStorage');
  assert.equal(harness(blocked, session).loadStoredGithubToken(), 'test-session');
  assert.equal(harness(blocked, blocked).storeGithubToken('test-memory', true), 'memory');
});

test('session-only choice clears the remembered portfolio connection', () => {
  const local = storage({ [key]: 'old-test' });
  const session = storage();
  const context = harness(local, session);
  context.storeGithubToken('session-test', false);
  assert.equal(context.loadStoredGithubToken(), 'session-test');
  assert.equal(harness(local).loadStoredGithubToken(), '');
});

test('GitHub errors retain HTTP identity and distinguish throttling from invalid credentials', async () => {
  const start = source.indexOf('  async function githubRequest(');
  const end = source.indexOf('  function rawGithubUrl', start);
  for (const status of [401, 403, 429, 500]) {
    const context = vm.createContext({ fetch: async () => ({ ok: false, status,
      headers: new Headers(status === 403 ? { 'x-ratelimit-remaining': '0' } : {}),
      json: async () => ({ message: 'Test error' }),
    }) });
    vm.runInContext(`let githubToken = 'test-only';\n${source.slice(start, end)}`, context);
    await assert.rejects(context.githubRequest('/test'), error => {
      assert.equal(error.status, status);
      if (status === 403 || status === 429) assert.match(error.message, /اتصالك محفوظ/);
      return true;
    });
  }
});
