import type { Sensitivity, Topic } from './types'

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩'
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g

export function normalizeDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
}

export function cleanDisplay(input: string): string {
  return input
    .normalize('NFKC')
    .replace(MARKS, '')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeArabic(input: string): string {
  return normalizeDigits(cleanDisplay(input))
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export const NAME_REJECT_WORDS = new Set(
  [
    'الإلكترونية',
    'الالكترونية',
    'إلكترونية',
    'الكترونيه',
    'الشركة',
    'الشركات',
    'شركة',
    'شركه',
    'المؤسسة',
    'مؤسسة',
    'مؤسسه',
    'المنظمة',
    'منظمة',
    'منظمه',
    'العامة',
    'الأنظمة',
    'الانظمة',
    'أنظمة',
    'انظمه',
    'جامعة',
    'كلية',
    'قسم',
    'مجلة',
    'بحث',
    'دراسة',
    'تحليل',
    'المؤتمر',
    'المجلد',
    'العدد',
    'ملخص',
    'المستخلص',
    'كلمات',
    'مفتاحية',
    'مفتاحيه',
    'الإدارة',
    'الادارة',
    'الاقتصاد',
    'معهد',
    'مركز',
    'هيئة',
    'وزارة',
    'رسالة',
    'أطروحة',
    'ماجستير',
    'دكتوراه',
    'الباحث',
    'الباحثة',
    'الطالب',
    'الطالبة',
    'المؤلف',
    'المؤلفة',
  ].map(normalizeArabic),
)

export function isRejectedNameWord(word: string): boolean {
  return NAME_REJECT_WORDS.has(normalizeArabic(word))
}

const COMMON_WORDS = new Set(
  [
    'في', 'من', 'على', 'الي', 'عن', 'ان', 'انه', 'انها', 'التي', 'الذي', 'الذين',
    'هذا', 'هذه', 'هؤلاء', 'مع', 'بين', 'بعد', 'قبل', 'كل', 'هو', 'هي', 'كان',
    'كانت', 'كما', 'قد', 'لا', 'ما', 'اذ', 'او', 'ثم', 'حيث', 'عند', 'لدي',
    'نحو', 'حول', 'خلال', 'دون', 'غير', 'سوي', 'اي', 'ايضا', 'به', 'بها', 'له',
    'لها', 'منهم', 'فيها', 'فيه', 'عليه', 'عليها', 'اليه', 'اليها', 'يمكن',
    'تم', 'يتم', 'وقد', 'وفي', 'ومن', 'وعن', 'اما', 'الا', 'لكن', 'حتي', 'منذ',
    'ضد', 'نفس', 'ذات', 'دراسه', 'البحث', 'الرساله', 'الاطروحه', 'جامعه',
    'كليه', 'قسم', 'القياده', 'التحويليه', 'الاداء', 'الرضا', 'الوظيفي',
    'الالتزام', 'التنظيمي', 'الموضوع', 'المصادر', 'المقدمه', 'النتائج',
    'الدراسه', 'العلمي', 'الباحث', 'الطالب', 'ماجستير', 'دكتوراه', 'سنه',
    'عام', 'هجري', 'ميلادي', 'الجمهوريه', 'العراق', 'بغداد',
  ].map(normalizeArabic),
)

export function arabicScore(text: string): number {
  const tokens = normalizeArabic(text).split(' ').filter(Boolean)
  let score = 0
  for (const token of tokens) if (COMMON_WORDS.has(token)) score += 1
  return score
}

/**
 * Some generators store Arabic in visual (reversed) order. This restores a
 * logical reading order while keeping numbers and Latin runs intact.
 */
export function visualToLogical(input: string): string {
  const text = cleanDisplay(input)
  if (!text) return ''
  const protectedPattern = /[A-Za-z0-9]+(?:[.,:/\\-][A-Za-z0-9]+)*/g
  const units: Array<{ text: string; protect: boolean }> = []
  let cursor = 0
  for (const match of text.matchAll(protectedPattern)) {
    const start = match.index ?? 0
    if (start > cursor) units.push({ text: text.slice(cursor, start), protect: false })
    units.push({ text: match[0], protect: true })
    cursor = start + match[0].length
  }
  if (cursor < text.length) units.push({ text: text.slice(cursor), protect: false })
  return units
    .reverse()
    .map((unit) => (unit.protect ? unit.text : [...unit.text].reverse().join('')))
    .join('')
}

const STOP_WORDS = new Set(
  [
    'في', 'من', 'على', 'الي', 'عن', 'ان', 'انه', 'انها', 'التي', 'الذي', 'الذين',
    'هذا', 'هذه', 'هؤلاء', 'مع', 'بين', 'بعد', 'قبل', 'كل', 'هو', 'هي', 'كان',
    'كانت', 'كما', 'قد', 'لا', 'ما', 'اذ', 'او', 'ثم', 'حيث', 'عند', 'لدي',
    'نحو', 'حول', 'خلال', 'دون', 'غير', 'سوي', 'اي', 'ايضا', 'به', 'بها', 'له',
    'لها', 'منهم', 'فيها', 'فيه', 'عليه', 'عليها', 'اليه', 'اليها', 'وقال',
    'يمكن', 'تم', 'يتم', 'وقد', 'وفي', 'ومن', 'وعن', 'اما', 'الا', 'لكن', 'حتي',
    'منذ', 'ضد', 'نفس', 'ذات', 'كيفيه', 'كذلك', 'ايضا', 'هناك', 'بينما',
  ].map(normalizeArabic),
)

const GENERIC_LEAD = new Set(
  [
    'مفهوم', 'تعريف', 'ماهيه', 'طبيعه', 'اهميه', 'واقع', 'دراسه', 'بحث',
    'موضوع', 'محور', 'عنوان', 'مقدمه', 'مدخل',
  ].map(normalizeArabic),
)

const PREFIXES = ['وال', 'بال', 'كال', 'لل', 'ال', 'و', 'ب', 'ك', 'ل']
const SUFFIXES = ['ه', 'ي', 'ات', 'ون', 'ين', 'ان']

export function tokenVariants(input: string): string[] {
  const out = new Set<string>()
  const queue: string[] = [input]
  while (queue.length > 0 && out.size < 36) {
    const token = queue.shift() as string
    if (!token || out.has(token)) continue
    out.add(token)
    if (token.length >= 5) {
      for (const prefix of PREFIXES) {
        if (token.startsWith(prefix) && token.length - prefix.length >= 3) {
          queue.push(token.slice(prefix.length))
        }
      }
    }
    if (token.length >= 5) {
      for (const suffix of SUFFIXES) {
        if (token.endsWith(suffix) && token.length - suffix.length >= 3) {
          queue.push(token.slice(0, -suffix.length))
        }
      }
    }
  }
  return [...out]
}

export function parseTopics(input: string): Topic[] {
  const chunks = input
    .split(/\n|;|؛|•/g)
    .map((chunk) => chunk.replace(/^\s*(?:\d+|[٠-٩]+)\s*[.)-]\s*/, '').trim())
    .filter(Boolean)

  const seen = new Set<string>()
  const topics: Topic[] = []

  for (const chunk of chunks.slice(0, 8)) {
    const display = chunk.replace(/\s+/g, ' ').trim().slice(0, 240)
    const normalized = normalizeArabic(display)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)

    let words = normalized.split(' ').filter(Boolean)
    while (words.length > 1 && GENERIC_LEAD.has(words[0])) words = words.slice(1)
    const meaningful = words.filter((word) => !STOP_WORDS.has(word) && word.length > 1)
    const finalWords = meaningful.length > 0 ? meaningful : words
    const uniqueWords = [...new Set(finalWords)].slice(0, 14)

    const withVariants = uniqueWords.map((word) => ({
      word,
      variants: tokenVariants(word),
    }))
    const deduped: typeof withVariants = []
    const signatures = new Set<string>()
    for (const entry of withVariants) {
      const signature = [...entry.variants].sort().join('|')
      if (signatures.has(signature)) continue
      signatures.add(signature)
      deduped.push(entry)
    }

    topics.push({
      raw: chunk,
      display,
      normalized,
      terms: deduped.map((entry) => entry.word),
      termVariants: deduped.map((entry) => entry.variants),
      phrase: normalized,
      phraseNoAl: normalized
        .split(' ')
        .map((word) => (word.startsWith('ال') && word.length > 4 ? word.slice(2) : word))
        .join(' '),
    })
  }

  return topics
}

export interface TopicPageMatch {
  topic: string
  score: number
  coverage: number
  exactPhrase: boolean
  passed: boolean
}

function pageTokenSetAndCounts(text: string): {
  variants: Set<string>
  counts: Map<string, number>
} {
  const tokens = normalizeArabic(text).split(' ').filter(Boolean)
  const variants = new Set<string>()
  const counts = new Map<string, number>()
  for (const token of tokens) {
    const tokenVars = tokenVariants(token)
    for (const variant of tokenVars) {
      variants.add(variant)
      counts.set(variant, (counts.get(variant) ?? 0) + 1)
    }
  }
  return { variants, counts }
}

function requiredCoverage(termCount: number, sensitivity: Sensitivity): number {
  let base = 1
  if (termCount >= 4) base = 0.6
  else if (termCount === 3) base = 2 / 3
  if (sensitivity === 'strict') base = Math.min(1, base + 0.15)
  if (sensitivity === 'broad') base = Math.max(termCount <= 2 ? 0.5 : 0.34, base - 0.2)
  return base
}

export function matchTopicInText(
  variants: Set<string>,
  counts: Map<string, number>,
  normalizedText: string,
  topic: Topic,
  sensitivity: Sensitivity,
): TopicPageMatch {
  let matchedTerms = 0
  let occurrences = 0
  for (const termVariants of topic.termVariants) {
    const found = termVariants.some((variant) => variants.has(variant))
    if (found) {
      matchedTerms += 1
      occurrences += Math.max(
        ...termVariants.map((variant) => counts.get(variant) ?? 0),
        0,
      )
    }
  }

  const coverage = topic.termVariants.length > 0 ? matchedTerms / topic.termVariants.length : 0
  const exactPhrase =
    normalizedText.includes(topic.phrase) || normalizedText.includes(topic.phraseNoAl)
  const frequency = Math.min(1, occurrences / 4)
  const score = Math.round(100 * (0.68 * coverage + 0.22 * (exactPhrase ? 1 : 0) + 0.1 * frequency))
  const required = requiredCoverage(topic.termVariants.length, sensitivity)
  const passed = coverage >= required || (exactPhrase && coverage >= 0.5)

  return {
    topic: topic.display,
    score: passed ? Math.max(score, 45) : score,
    coverage,
    exactPhrase: exactPhrase && passed,
    passed,
  }
}

export function scorePage(
  textVariants: string[],
  topics: Topic[],
  sensitivity: Sensitivity,
): { matched: TopicPageMatch[]; score: number } {
  const matched: TopicPageMatch[] = []
  for (const text of textVariants) {
    if (!text) continue
    const { variants, counts } = pageTokenSetAndCounts(text)
    for (const topic of topics) {
      const result = matchTopicInText(variants, counts, text, topic, sensitivity)
      if (!result.passed) continue
      const existing = matched.find((item) => item.topic === topic.display)
      if (!existing || result.score > existing.score) {
        if (existing) Object.assign(existing, result)
        else matched.push(result)
      }
    }
  }
  const score = matched.reduce((max, item) => Math.max(max, item.score), 0)
  return { matched, score }
}

export function makeSnippet(lines: string[], topicTerms: string[][]): string {
  if (lines.length === 0) return ''
  let bestIndex = 0
  let bestScore = 0
  const termSets = topicTerms.map((variants) => new Set(variants))
  for (let index = 0; index < lines.length; index += 1) {
    const tokens = normalizeArabic(lines[index]).split(' ').filter(Boolean)
    const tokenVariantsSet = new Set(tokens.flatMap((token) => tokenVariants(token)))
    let score = 0
    for (const termSet of termSets) {
      if ([...termSet].some((variant) => tokenVariantsSet.has(variant))) score += 1
    }
    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  }
  let snippet = cleanDisplay(lines[bestIndex] ?? '')
  if (snippet.length < 90 && lines[bestIndex + 1]) {
    snippet = `${snippet} ${cleanDisplay(lines[bestIndex + 1])}`.trim()
  }
  if (snippet.length > 260) {
    snippet = `${snippet.slice(0, 257).replace(/\s+\S*$/, '')}…`
  }
  return snippet
}
