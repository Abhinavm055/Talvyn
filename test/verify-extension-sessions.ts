import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import jwt from 'jsonwebtoken'
import {
  EXTENSION_ACCESS_TOKEN_TTL,
  EXTENSION_REFRESH_TOKEN_TTL,
  EXTENSION_REFRESH_TOKEN_TTL_MS,
  hashRefreshToken,
  hashesMatch,
  signExtensionAccessToken,
  signExtensionRefreshToken,
} from '../server/routes/auth'
import { config } from '../server/config'

const userId = 'session-test-user'
const sessionId = 'session-test-id'
const accessToken = signExtensionAccessToken(userId, sessionId, 4)
const accessClaims = jwt.verify(accessToken, config.jwtSecret) as jwt.JwtPayload
assert.equal(accessClaims.tokenUse, 'extension_access')
assert.equal(accessClaims.sessionId, sessionId)
assert.equal(accessClaims.authVersion, 4)
assert.equal((accessClaims.exp || 0) - (accessClaims.iat || 0), 15 * 60, 'access token expires in 15 minutes')

const refreshToken = signExtensionRefreshToken(sessionId)
const refreshClaims = jwt.verify(refreshToken, config.jwtRefreshSecret) as jwt.JwtPayload
assert.equal(refreshClaims.tokenUse, 'extension_refresh')
assert.equal(refreshClaims.sessionId, sessionId)
assert.ok(typeof refreshClaims.nonce === 'string', 'refresh token includes a unique rotation nonce')
assert.equal((refreshClaims.exp || 0) - (refreshClaims.iat || 0), 30 * 24 * 60 * 60, 'refresh token expires in 30 days')
assert.equal(EXTENSION_ACCESS_TOKEN_TTL, '15m')
assert.equal(EXTENSION_REFRESH_TOKEN_TTL, '30d')
assert.equal(EXTENSION_REFRESH_TOKEN_TTL_MS, 30 * 24 * 60 * 60 * 1000)

const refreshHash = hashRefreshToken(refreshToken)
assert.notEqual(refreshHash, refreshToken, 'database stores a digest rather than the refresh credential')
assert.equal(hashesMatch(refreshHash, hashRefreshToken(refreshToken)), true, 'current refresh credential matches its stored digest')
assert.equal(hashesMatch(refreshHash, hashRefreshToken(`${refreshToken}x`)), false, 'a different refresh credential does not match')
assert.equal(hashesMatch('bad', refreshHash), false, 'malformed digest lengths fail safely')

const authSource = fs.readFileSync(path.resolve(process.cwd(), 'server', 'routes', 'auth.ts'), 'utf8')
const middlewareSource = fs.readFileSync(path.resolve(process.cwd(), 'server', 'middleware', 'auth.ts'), 'utf8')
const schemaSource = fs.readFileSync(path.resolve(process.cwd(), 'prisma', 'schema.prisma'), 'utf8')
assert.match(authSource, /refreshTokenHash:\s*session\.refreshTokenHash[\s\S]*?revokedAt:\s*null/)
assert.match(authSource, /rotation\.count !== 1[\s\S]*?revokedAt: now/)
assert.match(authSource, /authVersion:\s*\{\s*increment:\s*1\s*\}/)
assert.match(authSource, /where:\s*\{\s*userId:\s*req\.userId,\s*revokedAt:\s*null\s*\}/)
assert.match(middlewareSource, /payload\.authVersion[\s\S]*?user\.authVersion/)
assert.match(middlewareSource, /session\.revokedAt[\s\S]*?session\.expiresAt/)
assert.match(schemaSource, /model ExtensionSession[\s\S]*?refreshTokenHash\s+String\s+@unique[\s\S]*?revokedAt\s+DateTime\?/)

console.log('✓ Extension session token, rotation guard, revocation, and migration model checks passed')
