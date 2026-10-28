/** Preserve internal return paths without accepting protocol-relative URLs. */
export function safeRedirectPath(value: string | null): string | null {
  if (!value) return null
  let path = value
  try {
    if (/^%2f/i.test(path)) path = decodeURIComponent(path)
  } catch { return null }
  if (!path.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(path)) return null
  return path
}
