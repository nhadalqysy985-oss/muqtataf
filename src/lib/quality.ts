import type { PageText } from './pdf'

export type TextQualityLevel = 'good' | 'fair' | 'poor'

export interface TextQuality {
  level: TextQualityLevel
  suspiciousPer1000: number
  brokenLigaturesPer1000: number
}

/**
 * Heuristic confidence check for extracted Arabic. It is intentionally
 * conservative: it only flags text that contains characters or ligature
 * patterns which are very unusual in normal academic Arabic PDFs.
 */
export function assessTextQuality(pages: PageText[]): TextQuality {
  const text = pages.map((page) => page.logicalText).join('\n')
  const letters = (text.match(/[\u0621-\u064A]/g) ?? []).length
  if (letters < 40) {
    return { level: 'good', suspiciousPer1000: 0, brokenLigaturesPer1000: 0 }
  }

  const suspicious = (text.match(/[\u063B-\u063F\u0640\uFFFD]/g) ?? []).length
  const broken = (text.match(/األ|اإل|اآل/g) ?? []).length
  const suspiciousPer1000 = (suspicious / letters) * 1000
  const brokenLigaturesPer1000 = (broken / letters) * 1000

  let level: TextQualityLevel = 'good'
  if (suspiciousPer1000 > 8 || brokenLigaturesPer1000 > 18) {
    level = 'poor'
  } else if (suspiciousPer1000 > 1 || brokenLigaturesPer1000 > 3) {
    level = 'fair'
  }

  return { level, suspiciousPer1000, brokenLigaturesPer1000 }
}
