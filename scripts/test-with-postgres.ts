/** Run migrations and integration/regression tests on a fresh loopback-only cluster. */
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

async function findPostgresBin(): Promise<string> {
  const suffix = process.platform === 'win32' ? '.exe' : ''
  const candidates = [process.env.TALVYN_POSTGRES_BIN, ...String(process.env.PATH || '').split(path.delimiter)].filter((value): value is string => !!value)
  if (process.platform === 'win32') {
    const installedRoot = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'PostgreSQL')
    const versions = await fs.readdir(installedRoot).catch(() => [] as string[])
    candidates.push(...versions.filter((version) => /^\d+$/.test(version)).sort((a, b) => Number(b) - Number(a)).map((version) => path.join(installedRoot, version, 'bin')))
  }
  for (const candidate of candidates) if (['initdb', 'pg_ctl', 'createdb'].every((name) => existsSync(path.join(candidate, name + suffix)))) return candidate
  throw new Error('PostgreSQL tools were not found. Set TALVYN_POSTGRES_BIN to their bin directory. No application database was accessed.')
}

async function freePort(): Promise<number> {
  const server = net.createServer()
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Could not reserve a test port')
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  return address.port
}

class CommandTimeoutError extends Error {
  readonly code = 'TALVYN_COMMAND_TIMEOUT'
  constructor(command: string, timeout: number, closed: boolean) {
    super(`[TALVYN_COMMAND_TIMEOUT] ${path.basename(command)} exceeded ${timeout}ms. ${closed ? 'The direct child closed; descendant shutdown remains unconfirmed.' : 'The direct child did not close within 10s of the termination request.'}`)
    this.name = 'CommandTimeoutError'
  }
}

class UncertainCommandShutdownError extends Error {
  constructor(command: string, signal: NodeJS.Signals | null) {
    super(`${path.basename(command)} closed without a normal exit status (signal: ${signal || 'unknown'}); descendant shutdown remains unconfirmed.`)
    this.name = 'UncertainCommandShutdownError'
  }
}

async function run(command: string, args: string[], env: NodeJS.ProcessEnv, timeout = 600_000): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), env, stdio: 'inherit', windowsHide: true })
    let timedOut = false
    let settled = false
    let commandError: Error | undefined
    let terminationTimer: ReturnType<typeof setTimeout> | undefined
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (terminationTimer) clearTimeout(terminationTimer)
      error ? reject(error) : resolve()
    }
    const timer = setTimeout(() => {
      timedOut = true
      // Terminate only this child. Descendants may survive, so timeout always
      // requires retaining the cluster directory even when this child closes.
      terminationTimer = setTimeout(() => {
        child.unref()
        finish(new CommandTimeoutError(command, timeout, false))
      }, 10_000)
      try { child.kill() } catch (error) { commandError = error instanceof Error ? error : new Error(String(error)) }
    }, timeout)
    child.once('error', (error) => { commandError = error })
    // close follows exit and completion of the child's stdio handles. Do not
    // enter directory cleanup merely because an exit event was received.
    child.once('close', (code, signal) => {
      if (timedOut) finish(new CommandTimeoutError(command, timeout, true))
      else if (commandError) finish(commandError)
      else if (signal || code === null) finish(new UncertainCommandShutdownError(command, signal))
      else finish(code === 0 ? undefined : new Error(`${path.basename(command)} exited with status ${code}`))
    })
  })
}

async function main(): Promise<void> {
  const bin = await findPostgresBin()
  const suffix = process.platform === 'win32' ? '.exe' : ''
  const executable = (name: string) => path.join(bin, name + suffix)
  const tempParent = await fs.realpath(os.tmpdir())
  const root = await fs.mkdtemp(path.join(tempParent, 'talvyn-postgres-'))
  const marker = randomUUID()
  await fs.writeFile(path.join(root, '.talvyn-disposable'), marker)
  const data = path.join(root, 'data')
  const port = await freePort()
  // This URL is constructed here, never read from the application .env.
  const testUrl = `postgresql://talvyn_test@127.0.0.1:${port}/talvyn_test?schema=public&connect_timeout=5`
  const env = { ...process.env, NODE_ENV: 'test', DATABASE_URL: testUrl, TALVYN_TEST_DATABASE_URL: testUrl,
    JWT_SECRET: `test-access-${randomUUID()}`, JWT_REFRESH_SECRET: `test-refresh-${randomUUID()}` }
  let started = false
  let commandFailed = false
  let retainReason: string | undefined
  try {
    console.log('Creating a disposable PostgreSQL cluster; application database configuration is ignored.')
    await run(executable('initdb'), ['-D', data, '-U', 'talvyn_test', '-A', 'trust', '--encoding=UTF8', '--locale=C'], env, 120_000)
    await run(executable('pg_ctl'), ['-D', data, '-l', path.join(root, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -F`, '-w', '-t', '30', 'start'], env, 40_000)
    started = true
    await run(executable('createdb'), ['-h', '127.0.0.1', '-p', String(port), '-U', 'talvyn_test', 'talvyn_test'], env, 30_000)
    await run(process.execPath, [require.resolve('prisma'), 'migrate', 'deploy'], env, 60_000)
    await run(process.execPath, [require.resolve('prisma'), 'migrate', 'status'], env, 30_000)
    await run(process.execPath, [require.resolve('tsx/cli'), 'test/verify-postgres-integration.ts'], env)
    await run(process.execPath, [require.resolve('tsx/cli'), 'test/verify-saved-searches.ts'], env)
    await run(process.execPath, [require.resolve('tsx/cli'), 'scripts/run-tests.ts', 'security'], env)
    await run(process.execPath, [require.resolve('tsx/cli'), 'scripts/run-tests.ts', 'regression'], env)
    console.log('PASS: migrations, real PostgreSQL integration and all regression suites.')
  } catch (error) {
    commandFailed = true
    if (error instanceof CommandTimeoutError || error instanceof UncertainCommandShutdownError) retainReason = error.message
    throw error
  } finally {
    // Only stop the cluster created above. If shutdown fails, retain its data
    // for diagnosis instead of deleting files used by a running server.
    let shutdownFailure: unknown
    if (started || existsSync(path.join(data, 'postmaster.pid'))) {
      try {
        await run(executable('pg_ctl'), ['-D', data, '-m', 'fast', '-w', '-t', '30', 'stop'], env, 40_000)
      } catch (error) {
        shutdownFailure = error
        const message = error instanceof Error ? error.message : String(error)
        retainReason = [retainReason, `Cluster shutdown failed: ${message}`].filter(Boolean).join('\n')
      }
    }
    if (retainReason) {
      console.error(`Retained disposable PostgreSQL directory: ${root}\n${retainReason}\nVerify the owned cluster and command descendants have stopped before removing this directory.`)
    } else {
      const resolvedRoot = await fs.realpath(root)
      if (path.dirname(resolvedRoot) !== tempParent || !path.basename(resolvedRoot).startsWith('talvyn-postgres-') ||
          (await fs.lstat(root)).isSymbolicLink() || await fs.readFile(path.join(root, '.talvyn-disposable'), 'utf8') !== marker) {
        throw new Error('Refusing cleanup: disposable cluster path or ownership marker changed')
      }
      await fs.rm(resolvedRoot, { recursive: true, force: true })
      console.log('Disposable PostgreSQL cluster stopped and removed.')
    }
    // Preserve an earlier timeout as the primary failure if stopping also fails.
    if (shutdownFailure && !commandFailed) throw shutdownFailure
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'PostgreSQL validation failed')
  process.exitCode = 1
})
