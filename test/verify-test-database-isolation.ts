import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

// Subprocesses cover module initialization without changing the parent suite's
// database configuration or issuing a database request.
for (const dedicated of ['', 'postgresql://test_only@127.0.0.1:1/talvyn_test']) {
  const source = `
    import assert from 'node:assert/strict';
    import { requireTestDatabase, allowDatabaseFixtureFallback } from './test/helpers/testDatabase';
    const dedicated = process.env.TALVYN_TEST_DATABASE_URL;
    assert.equal(process.env.NODE_ENV, 'test');
    if (dedicated) {
      assert.equal(process.env.DATABASE_URL, dedicated);
      requireTestDatabase();
      const original = new Error('Synthetic database failure');
      assert.throws(() => allowDatabaseFixtureFallback(original), error => error === original);
    } else {
      assert.ok(process.env.DATABASE_URL.startsWith('postgresql://talvyn_test:unused@127.0.0.1:1/'));
      assert.throws(requireTestDatabase);
      allowDatabaseFixtureFallback(new Error('No test database'));
    }
  `
  const result = spawnSync(process.execPath, [require.resolve('tsx/cli'), '--eval', source], {
    cwd: process.cwd(), windowsHide: true, encoding: 'utf8', timeout: 30_000,
    env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: 'postgresql://application_sentinel@127.0.0.1:1/never_use', TALVYN_TEST_DATABASE_URL: dedicated },
  })
  assert.equal(result.status, 0, `Database isolation/strict-failure case failed (${dedicated ? 'dedicated' : 'fixture'}). Child output is withheld to avoid configuration leaks.`)
}
console.log('PASS: test database isolation and explicit-database failures cannot silently fall back to fixtures.')
