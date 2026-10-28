import { createHash, createPublicKey } from 'node:crypto'

/** Build/server configuration only. Never import this Node module into website code. */
export interface ExtensionIdentity { publicKey: string; extensionId: string }
export type ExtensionIdentityEnvironment = Partial<Record<
  'TALVYN_EXTENSION_PUBLIC_KEY' | 'TALVYN_DEV_EXTENSION_PUBLIC_KEY' |
  'TALVYN_EXTENSION_IDS' | 'TALVYN_DEV_EXTENSION_IDS' | 'VITE_TALVYN_EXTENSION_ID',
  string | undefined
>>

const KEY_ERROR = 'Extension identity requires a canonical base64 DER/SPKI PUBLIC key. Never provide a private key.'

/** Chrome hashes the manifest public-key bytes, then maps hex nibbles to a-p. */
export function deriveExtensionIdentity(publicKey: string): ExtensionIdentity {
  const value = publicKey.trim()
  if (!value || value.length > 16384 || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error(KEY_ERROR)
  const bytes = Buffer.from(value, 'base64')
  if (bytes.toString('base64') !== value) throw new Error(KEY_ERROR)
  try {
    const parsed = createPublicKey({ key: bytes, format: 'der', type: 'spki' })
    // Reject trailing bytes and noncanonical encodings so all components hash
    // the exact bytes Chrome will read. This does not verify release provenance.
    const canonical = parsed.export({ format: 'der', type: 'spki' })
    if (!canonical.equals(bytes)) throw new Error(KEY_ERROR)
  } catch { throw new Error(KEY_ERROR) }
  const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 32)
  const extensionId = digest.replace(/[0-9a-f]/g, (nibble) => String.fromCharCode(97 + parseInt(nibble, 16)))
  return { publicKey: value, extensionId }
}

function optionalIdentity(value?: string): ExtensionIdentity | undefined {
  return value?.trim() ? deriveExtensionIdentity(value) : undefined
}

/** A development build must never inherit the production extension identity. */
export function resolveManifestExtensionIdentity(mode: string, env: ExtensionIdentityEnvironment): ExtensionIdentity | undefined {
  return optionalIdentity(mode === 'development' ? env.TALVYN_DEV_EXTENSION_PUBLIC_KEY : env.TALVYN_EXTENSION_PUBLIC_KEY)
}

export function resolveWebsiteExtensionId(mode: string, env: ExtensionIdentityEnvironment): string {
  const identity = resolveManifestExtensionIdentity(mode, env)
  const configuredId = env.VITE_TALVYN_EXTENSION_ID?.trim() || ''
  if (mode !== 'development') {
    if (configuredId && configuredId !== identity?.extensionId) throw new Error('Production VITE_TALVYN_EXTENSION_ID must match the ID derived from TALVYN_EXTENSION_PUBLIC_KEY. Configure the owner public key or remove the ID override.')
    return identity?.extensionId || ''
  }
  if (configuredId && !/^[a-p]{32}$/.test(configuredId)) throw new Error('Development VITE_TALVYN_EXTENSION_ID must be the actual loaded extension ID.')
  if (configuredId && identity && configuredId !== identity.extensionId) throw new Error('Development extension ID does not match TALVYN_DEV_EXTENSION_PUBLIC_KEY.')
  return configuredId || identity?.extensionId || ''
}

function configuredIds(value?: string): string[] {
  return (value || '').split(',').map((id) => id.trim()).filter((id) => /^[a-p]{32}$/.test(id))
}

/** Explicit server allowlists are owner configuration, never page/runtime input. */
export function resolveTrustedExtensionIds(nodeEnv: string, env: ExtensionIdentityEnvironment): string[] {
  const production = nodeEnv === 'production'
  const identity = resolveManifestExtensionIdentity(production ? 'production' : 'development', env)
  return [...new Set([
    ...(identity ? [identity.extensionId] : []),
    ...configuredIds(env.TALVYN_EXTENSION_IDS),
    ...(production ? [] : configuredIds(env.TALVYN_DEV_EXTENSION_IDS)),
  ])]
}
