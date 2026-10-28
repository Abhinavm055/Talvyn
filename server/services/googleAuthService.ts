import { OAuth2Client, TokenPayload } from 'google-auth-library'
import { config } from '../config'
import { prisma } from '../lib/prisma'

export interface VerifiedGoogleUser {
  googleId: string
  email: string
  name: string
  givenName?: string
  familyName?: string
  avatarUrl?: string
}

export class GoogleAuthService {
  private client: OAuth2Client

  constructor() {
    this.client = new OAuth2Client(config.googleClientId || undefined, config.googleClientSecret || undefined)
  }

  /**
   * Check if Google OAuth Client ID is properly configured on the backend.
   */
  isConfigured(): boolean {
    const id = config.googleClientId
    if (!id || typeof id !== 'string') return false
    const lower = id.toLowerCase().trim()
    if (
      lower.includes('your_google') ||
      lower.includes('your-google') ||
      lower.includes('your_client') ||
      lower.includes('xxxxx') ||
      lower.includes('example') ||
      lower.length < 15
    ) {
      return false
    }
    return true
  }

  /**
   * Verifies a Google ID token cryptographically against Google's public certificates.
   */
  async verifyGoogleToken(idToken: string): Promise<VerifiedGoogleUser> {
    if (!idToken || typeof idToken !== 'string') {
      throw new Error('Google credential/token is required')
    }

    // Every accepted credential must pass Google's signature verification.
    // Fixtures belong in tests; no test-token format is accepted by this API.
    if (idToken.length > 16384 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(idToken)) {
      throw new Error('Invalid Google credential format')
    }

    // Validate that backend has Google Client ID configured
    if (!this.isConfigured()) {
      throw new Error(
        'Google Sign-In is not configured on the backend. Please add a valid GOOGLE_CLIENT_ID to your .env file.'
      )
    }

    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: config.googleClientId,
      })

      const payload = ticket.getPayload()
      if (!payload) {
        throw new Error('Invalid Google token: empty payload')
      }

      return this.validatePayload(payload)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google token verification failed'
      throw new Error(`Google verification failed: ${msg}`)
    }
  }

  /**
   * Validates critical OpenID Connect security claims.
   */
  validatePayload(payload: TokenPayload): VerifiedGoogleUser {
    // 1. Email Verification
    if (typeof payload.email !== 'string' || !payload.email.includes('@')) {
      throw new Error('Google token does not contain an email address')
    }

    if (payload.email_verified !== true) {
      throw new Error('Google account email is not verified')
    }

    // 2. Google User ID (sub)
    if (typeof payload.sub !== 'string' || !payload.sub) {
      throw new Error('Google token does not contain a subject (user ID)')
    }

    // 3. Expiration Check
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) || payload.exp * 1000 <= Date.now()) {
      throw new Error('Google token has expired')
    }

    // 4. Issuer Validation
    const validIssuers = ['accounts.google.com', 'https://accounts.google.com']
    if (!validIssuers.includes(payload.iss)) {
      throw new Error(`Invalid Google token issuer: ${payload.iss}`)
    }

    // 5. Audience Check
    if (typeof payload.aud !== 'string' || !payload.aud || (config.googleClientId && payload.aud !== config.googleClientId)) {
      throw new Error('Google token audience does not match backend GOOGLE_CLIENT_ID')
    }

    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase().trim(),
      name: payload.name || '',
      givenName: payload.given_name,
      familyName: payload.family_name,
      avatarUrl: payload.picture,
    }
  }

  /**
   * Finds or creates a Talvyn user from verified Google credentials,
   * safely linking accounts by verified email.
   */
  async authenticateGoogleUser(googleData: VerifiedGoogleUser): Promise<{ user: any; isNewUser: boolean }> {
    // 1. Find by Google Account ID
    let user = await prisma.user.findUnique({
      where: { googleId: googleData.googleId },
      include: { profile: true },
    })

    if (user) {
      // Update avatar if newly available
      if (googleData.avatarUrl && !user.avatarUrl) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { avatarUrl: googleData.avatarUrl },
          include: { profile: true },
        })
      }
      return { user, isNewUser: false }
    }

    // 2. Account Linking by Verified Email
    const existingByEmail = await prisma.user.findUnique({
      where: { email: googleData.email },
      include: { profile: true },
    })

    if (existingByEmail) {
      // Link Google ID to existing email account
      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          googleId: googleData.googleId,
          avatarUrl: existingByEmail.avatarUrl || googleData.avatarUrl,
        },
        include: { profile: true },
      })
      return { user, isNewUser: false }
    }

    // 3. Create New Talvyn User
    user = await prisma.user.create({
      data: {
        email: googleData.email,
        googleId: googleData.googleId,
        authProvider: 'GOOGLE',
        avatarUrl: googleData.avatarUrl,
        profile: {
          create: {
            email: googleData.email,
            legalFullName: googleData.name || null,
            givenName: googleData.givenName || null,
            familyName: googleData.familyName || null,
            preferredRoles: '[]',
            skills: '[]',
            otherLinks: '[]',
            preferredLocations: '[]',
            preferredJobTypes: '[]',
            onboardingCompleted: false,
          },
        },
      },
      include: { profile: true },
    })

    return { user, isNewUser: true }
  }

}

export const googleAuthService = new GoogleAuthService()
