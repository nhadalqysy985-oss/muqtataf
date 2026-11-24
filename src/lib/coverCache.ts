import type { CoverInfo } from './types'

const CACHE_PREFIX = 'muqtataf.cover.v1.'

function hashString(input: string): string {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function coverFingerprint(file: File): string {
  return hashString(`${file.name}|${file.size}|${file.lastModified}`)
}

function cacheKey(fingerprint: string): string {
  return `${CACHE_PREFIX}${fingerprint}`
}

export function loadCoverCache(fingerprint: string): CoverInfo | null {
  if (!fingerprint) return null
  try {
    const raw = localStorage.getItem(cacheKey(fingerprint))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { version?: number; cover?: CoverInfo }
    if (parsed.version !== 1 || !parsed.cover) return null
    const cover = parsed.cover
    if (typeof cover.title !== 'string' || typeof cover.authors !== 'string') return null
    if (typeof cover.year !== 'string') return null
    return cover
  } catch {
    return null
  }
}

export function saveCoverCache(fingerprint: string, cover: CoverInfo): void {
  if (!fingerprint) return
  try {
    localStorage.setItem(
      cacheKey(fingerprint),
      JSON.stringify({ version: 1, savedAt: Date.now(), cover }),
    )
  } catch {
    // Local storage may be disabled; extraction still works.
  }
}

export function clearCoverCache(fingerprint: string): void {
  if (!fingerprint) return
  try {
    localStorage.removeItem(cacheKey(fingerprint))
  } catch {
    // Ignore storage errors.
  }
}
