import dotenv from 'dotenv'
import { resolveTrustedExtensionIds } from './services/extensionIdentity'
dotenv.config()

const nodeEnv = process.env.NODE_ENV || 'development'
const jwtSecret = process.env.JWT_SECRET || (nodeEnv === 'production' ? '' : 'fallback-secret')
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || (nodeEnv === 'production' ? '' : 'fallback-refresh-secret')

if (nodeEnv === 'production' && (!jwtSecret || !jwtRefreshSecret || jwtSecret === jwtRefreshSecret)) {
  throw new Error('Production requires distinct JWT_SECRET and JWT_REFRESH_SECRET values.')
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  jwtSecret,
  jwtRefreshSecret,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  nodeEnv,
  jwtExpiresIn: '7d',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleAllowedOrigin: process.env.GOOGLE_ALLOWED_ORIGIN || '',
  extensionIds: resolveTrustedExtensionIds(nodeEnv, process.env),
} as const
