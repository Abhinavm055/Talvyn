/** Full production middleware, temporary files, no database or external accounts. */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createApp } from '../server/app'

async function main(): Promise<void> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'talvyn-upload-access-'))
  const privateContent = 'Synthetic private resume: must never be publicly served'
  await fs.mkdir(path.join(root, 'avatars'))
  await fs.mkdir(path.join(root, 'resumes'))
  await fs.writeFile(path.join(root, 'avatars', 'public.png'), 'synthetic-avatar')
  await fs.writeFile(path.join(root, 'resumes', 'private.pdf'), privateContent)
  await fs.writeFile(path.join(root, 'private.pdf'), privateContent)
  const app = createApp({ uploadsRoot: root })
  const server = app.listen(0, '127.0.0.1')
  try {
    await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject) })
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    const base = `http://127.0.0.1:${address.port}`
    let checks = 0
    for (const method of ['GET', 'HEAD']) {
      for (const route of ['/uploads/resumes/private.pdf', '/uploads/private.pdf', '/uploads/avatars/../resumes/private.pdf', '/uploads/avatars/%2e%2e%2fresumes/private.pdf', '/uploads/avatars/..%5cresumes%5cprivate.pdf', '/uploads/avatars/%252e%252e%252fresumes/private.pdf']) {
        const response = await fetch(base + route, { method, signal: AbortSignal.timeout(5000) })
        assert.ok(response.status >= 400, `${method} ${route} must not serve private files`)
        assert.ok(!(await response.text()).includes(privateContent))
        checks++
      }
    }
    const avatar = await fetch(`${base}/uploads/avatars/public.png`)
    assert.equal(avatar.status, 200)
    assert.equal(await avatar.text(), 'synthetic-avatar')
    assert.equal(avatar.headers.get('cross-origin-resource-policy'), 'cross-origin')
    assert.equal((await fetch(`${base}/uploads/avatars/`)).status, 404)
    assert.equal((await fetch(`${base}/api/resumes/private/file`)).status, 401)
    assert.equal((await fetch(`${base}/api/health`)).status, 200)
    console.log(`PASS: full-server upload security (${checks} private GET/HEAD paths), public avatars, authenticated resume entry and health.`)
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    // Delete only the exact files/directories created by this test, without recursion.
    await fs.unlink(path.join(root, 'avatars', 'public.png'))
    await fs.unlink(path.join(root, 'resumes', 'private.pdf'))
    await fs.unlink(path.join(root, 'private.pdf'))
    await fs.rmdir(path.join(root, 'avatars'))
    await fs.rmdir(path.join(root, 'resumes'))
    await fs.rmdir(root)
  }
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1 })
