import type { UsageEvent } from './deepseek'

export interface UsageStats {
  attempts: number
  successful: number
  failed: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  pages: number
  updatedAt: number
}

export const OCR_PRICE_PER_1000_PAGES = 0.225
const STORAGE_PREFIX = 'muqtataf.usage.v1.'

export function emptyUsage(): UsageStats {
  return {
    attempts: 0,
    successful: 0,
    failed: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    pages: 0,
    updatedAt: 0,
  }
}

export function keyFingerprint(apiKey: string): string {
  let hash = 2166136261
  const value = apiKey.trim()
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `${(hash >>> 0).toString(16)}-${value.length}`
}

export function loadUsage(fingerprint: string): UsageStats {
  if (!fingerprint) return emptyUsage()
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + fingerprint)
    if (!raw) return emptyUsage()
    const parsed = JSON.parse(raw) as Partial<UsageStats>
    return {
      ...emptyUsage(),
      ...parsed,
      attempts: Number(parsed.attempts) || 0,
      successful: Number(parsed.successful) || 0,
      failed: Number(parsed.failed) || 0,
      inputTokens: Number(parsed.inputTokens) || 0,
      outputTokens: Number(parsed.outputTokens) || 0,
      totalTokens: Number(parsed.totalTokens) || 0,
      pages: Number(parsed.pages) || 0,
    }
  } catch {
    return emptyUsage()
  }
}

export function saveUsage(fingerprint: string, usage: UsageStats): void {
  if (!fingerprint) return
  try {
    localStorage.setItem(STORAGE_PREFIX + fingerprint, JSON.stringify(usage))
  } catch {
    // Usage tracking is best-effort; the app must keep working without storage.
  }
}

export function applyUsageEvent(usage: UsageStats, event: UsageEvent): UsageStats {
  if (event.type === 'attempt') {
    return { ...usage, attempts: usage.attempts + 1, updatedAt: Date.now() }
  }
  if (event.type === 'failure') {
    return { ...usage, failed: usage.failed + 1, updatedAt: Date.now() }
  }
  return {
    ...usage,
    successful: usage.successful + 1,
    inputTokens: usage.inputTokens + event.usage.inputTokens,
    outputTokens: usage.outputTokens + event.usage.outputTokens,
    totalTokens: usage.totalTokens + event.usage.totalTokens,
    pages: usage.pages + event.pages,
    updatedAt: Date.now(),
  }
}

export function resetUsage(fingerprint: string): UsageStats {
  if (fingerprint) {
    try {
      localStorage.removeItem(STORAGE_PREFIX + fingerprint)
    } catch {
      // Ignore unavailable storage.
    }
  }
  return emptyUsage()
}

export function estimateOcrCost(pages: number): string {
  return (pages / 1000) * OCR_PRICE_PER_1000_PAGES > 0
    ? ((pages / 1000) * OCR_PRICE_PER_1000_PAGES).toFixed(4)
    : '0.0000'
}

export function formatUsageNumber(value: number): string {
  return value.toLocaleString('en-US')
}
