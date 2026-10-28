import type { CookieOptions, Response } from 'express'
import { setWebSession } from '../../server/services/webSession'

/** Capture the real server cookie helper without inventing a login response. */
export function captureWebsiteSession(userId: string, authVersion: number) {
  let issued: { name: string; value: string; options: CookieOptions } | undefined
  const response = {
    cookie(name: string, value: string, options: CookieOptions) {
      issued = { name, value, options }
      return response
    },
  }
  const result = setWebSession(response as Response, userId, authVersion)
  if (!issued) throw new Error('Website session helper did not issue a cookie')
  return { ...issued, result }
}
