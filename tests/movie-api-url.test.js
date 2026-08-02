const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

test('shared exposes a helper to resolve API URLs against the configured origin', () => {
  const context = {
    window: {
      location: { hostname: '127.0.0.1' }
    },
    localStorage: { getItem() { return null; }, setItem() {} },
    document: { createElement() { return {}; }, body: {} },
    console,
    URL,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (cb) => cb()
  };
  context.window.window = context.window;

  const sharedScript = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'js', 'shared.js'), 'utf8');
  vm.runInContext(sharedScript, vm.createContext(context));

  const url = context.window.BugaShared.resolveApiUrl('/api/movies/1');
  assert.equal(url, 'http://127.0.0.1:3100/api/movies/1');

  const relativeUrl = context.window.BugaShared.resolveApiUrl('/api/movies/tmdb/550');
  assert.equal(relativeUrl, 'http://127.0.0.1:3100/api/movies/tmdb/550');
});
