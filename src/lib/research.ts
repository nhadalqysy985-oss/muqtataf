import type { CoverInfo, ResearchCitation, SourceResult } from './types'
import type { UsageEvent } from './deepseek'
import { cleanDisplay, normalizeDigits } from './text'

export const RESEARCH_SYSTEM_PROMPT = `أنت باحث أكاديمي متخصص في الكتابة العلمية باللغة العربية. مصدر معلوماتك الوحيد هو ملفات PDF (رسائل وأطاريح جامعية) المرفقة في هذه المحادثة. مهمتك كتابة نصوص بحثية رصينة بأسلوبك الخاص مع توثيق دقيق.

أولاً: استخراج بيانات التوثيق (لكل ملف)
من صفحة الغلاف (الواجهة) فقط:
1. اسم الباحث: يُكتب بعد كلمة "إعداد" أو "إعداد الطالب/الطالبة/الطلبة" أو ما يماثلها. استخدم "اللقب" (الاسم الأخير) في التوثيق. مثال: "حافظ عبد الكريم الغزالي" ← الغزالي.
2. السنة: سنة الرسالة المكتوبة في الغلاف.
3. تجاهل اسم المشرف تماماً؛ لا يُوثَّق به.
إذا كان الباحثون اثنين: (لقب1 ولقب2، السنة: ص). ثلاثة فأكثر: (لقب الأول وآخرون، السنة: ص).

ثانياً: رقم الصفحة
- استخدم رقم الصفحة المطبوع على صفحة الرسالة نفسها (أعلى أو أسفل الصفحة)، وليس رقم ترتيب الصفحة في ملف PDF، وليس أرقام المصادر أو الهوامش داخل المتن.
- حوّل الأرقام الهندية (١٢) إلى أرقام عربية/لاتينية (12).
- إذا امتدت المعلومة على صفحتين: (الغزالي، 2012: 12-13).
- إذا لم تستطع قراءة رقم الصفحة بوضوح، لا تخمّن؛ اكتب [رقم الصفحة غير واضح] ونبّه المستخدم.

ثالثاً: أسلوب الكتابة
- أعد صياغة الفكرة بأسلوب باحث متخصص: حلّل، اربط، أعد ترتيب الجمل. ممنوع النسخ واللصق أو تغيير كلمات قليلة فقط.
- حافظ على المعنى بدقة؛ لا تضف معلومة غير موجودة في الصفحة المُوثَّقة.
- لغة أكاديمية رصينة، جمل واضحة، بدون حشو.
- الاقتباس الحرفي نادر، ويكون بين علامتي تنصيص مع الصفحة.

رابعاً: التوثيق
- يوضع التوثيق في نهاية الفقرة/الجملة قبل النقطة أو بعدها بشكل ثابت، بصيغة: (اللقب، السنة: الصفحة).
- كل معلومة تُوثَّق بصفحتها الخاصة. إذا جمعت فقرة معلومات من صفحات مختلفة، وثّق كل جملة على حدة.
- النزاهة العلمية: إذا ذكرت الرسالة تعريفاً لباحث آخر (مثل Northouse, 2001)، فأنت لم تقرأ مصدره الأصلي، فاكتب: "عرّفها نورثهاوس (2001) نقلاً عن (الغزالي، 2012: 12)". لا تنسب المعلومة للباحث الداخلي كأنك رجعت له مباشرة.
- لا تخترع مصدراً أو رقم صفحة أبداً. إذا لم تجد المعلومة في الملفات، قل: "لم أجد هذه المعلومة في المصادر المرفقة".

خامساً: في نهاية كل إجابة
أضف قائمة مراجع بالصيغة:
اللقب، الاسم الكامل (السنة). عنوان الرسالة. نوع الرسالة، الجامعة، البلد.

قيود إضافية صارمة:
- اعتمد فقط على المقاطع والصفحات المرفقة في رسالة المستخدم. لا تستخدم معرفتك العامة أو الإنترنت.
- لا تذكر رقم صفحة PDF أو ترتيب الصفحة في الملف؛ استخدم فقط "الصفحة المطبوعة" المذكورة في السياق.
- إذا كانت الصفحة تحمل [رقم الصفحة غير واضح] فالتزم بذلك ولا تخترع رقماً.
- لا تنسب عبارة إلى باحث لم ترد عبارته في المقطع، والتزم بقاعدة النقل غير المباشر عند وجود اقتباس داخلي.
- اكتب بالعربية الفصحى، وابدأ مباشرة بالإجابة من دون مقدمات عن نفسك.`

const COUNTRIES = [
  'العراق',
  'الجزائر',
  'اليمن',
  'مصر',
  'السعودية',
  'المملكة العربية السعودية',
  'الأردن',
  'سوريا',
  'لبنان',
  'تونس',
  'المغرب',
  'ليبيا',
  'السودان',
  'فلسطين',
  'الكويت',
  'الإمارات',
  'قطر',
  'البحرين',
  'عمان',
]

export function splitAuthorNames(authors: string): string[] {
  return authors
    .split(/\s+(?:و|&)\s+|،|;/g)
    .map((author) => cleanDisplay(author).replace(/^(?:و|&)\s+/, '').trim())
    .filter((author) => author.length >= 3)
}

export function surnameOf(fullName: string): string {
  const cleaned = cleanDisplay(fullName)
    .replace(/^(?:أ\.?د\.?|د\.?|الدكتور|الدكتورة|الأستاذ|الأستاذة)\s+/, '')
    .trim()
  const parts = cleaned.split(/\s+/).filter(Boolean)
  return parts[parts.length - 1] ?? cleaned
}

export function detectCountry(lines: string[]): string | undefined {
  const joined = lines.join(' ')
  return COUNTRIES.find((country) => joined.includes(country))
}

export function detectPrintedPageNumber(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => cleanDisplay(line))
    .filter(Boolean)
  const candidates = [...lines.slice(0, 3), ...lines.slice(-3)]
  for (const line of candidates) {
    const normalized = normalizeDigits(line)
    const match = normalized.match(
      /^(?:[-–—:.\s]*)(?:صفحة|صفحه|page)?\s*([0-9]{1,4})\s*(?:[-–—:.\s]*)$/i,
    )
    if (!match) continue
    const value = Number(match[1])
    if (value >= 1900 && value <= 2100) continue
    return String(value)
  }
  return null
}

export function buildCitation(cover: CoverInfo): ResearchCitation {
  const authors = cover.authorNames?.length
    ? cover.authorNames
    : splitAuthorNames(cover.authors)
  const surnames = authors.map(surnameOf).filter(Boolean)
  const rawYear = (cover.year || 'السنة غير واضحة').replace(/\s*[مه]$/u, '').trim()
  const year = rawYear || 'السنة غير واضحة'
  let label = '(مصدر غير محدد، السنة غير واضحة)'
  if (surnames.length === 1) label = `(${surnames[0]}، ${year})`
  else if (surnames.length === 2) label = `(${surnames[0]} و${surnames[1]}، ${year})`
  else if (surnames.length >= 3) label = `(${surnames[0]} وآخرون، ${year})`

  const degree = cover.degree ? `رسالة ${cover.degree}` : 'رسالة/أطروحة جامعية'
  const referenceAuthors = authors.length
    ? authors
        .map((author) => {
          const surname = surnameOf(author)
          const parts = cleanDisplay(author)
            .replace(/^(?:أ\.?د\.?|د\.?|الدكتور|الدكتورة|الأستاذ|الأستاذة)\s+/, '')
            .trim()
            .split(/\s+/)
          if (parts.length <= 1) return surname
          return `${surname}، ${parts.slice(0, -1).join(' ')}`
        })
        .join('؛ ')
    : 'مصدر بدون اسم باحث'
  const reference = `${referenceAuthors} (${year}). ${cover.title}. ${degree}، ${
    cover.university || 'جامعة غير محددة'
  }، ${cover.country || 'بلد غير محدد'}.`

  return {
    authors,
    surnames,
    year,
    title: cover.title,
    degree: cover.degree,
    university: cover.university,
    country: cover.country,
    label,
    reference,
  }
}

export interface CitationIssue {
  citation: string
  message: string
}

export interface CitationValidation {
  checked: number
  valid: number
  issues: CitationIssue[]
}

/**
 * Lightweight post-check for generated citations. It does not prove that a
 * claim is supported; it only checks that the cited source/year/page exists in
 * the excerpts that were actually sent to the model.
 */
export function validateResearchCitations(
  output: string,
  sources: ResearchSource[],
): CitationValidation {
  const normalizedOutput = normalizeDigits(output)
  const matches = [
    ...normalizedOutput.matchAll(/\(([^()]*?\b\d{4}\b[^()]*?)\)/g),
  ]
  const issues: CitationIssue[] = []
  const seen = new Set<string>()
  let checked = 0
  let valid = 0

  const addIssue = (citation: string, message: string) => {
    const key = `${citation}|${message}`
    if (seen.has(key)) return
    seen.add(key)
    issues.push({ citation: citation.trim(), message })
  }

  for (const match of matches) {
    const inner = cleanDisplay(match[1])
    const segments = inner.split(/[؛;]/g)
    for (const rawSegment of segments) {
      const segment = rawSegment.trim()
      const years = [...segment.matchAll(/\b(1[89]\d{2}|20\d{2}|14\d{2})\b/g)]
      if (years.length === 0) continue
      checked += 1
      const lastYear = years[years.length - 1]
      const year = lastYear[0]
      let before = segment.slice(0, lastYear.index ?? 0)
      if (!before.replace(/[،,\s]/g, '')) continue
      const citedIndex = before.lastIndexOf('نقلاً عن')
      const citedIndexEn = before.toLowerCase().lastIndexOf('as cited in')
      if (citedIndex >= 0) before = before.slice(citedIndex + 'نقلاً عن'.length)
      if (citedIndexEn >= 0) before = before.slice(citedIndexEn + 'as cited in'.length)
      const after = segment.slice((lastYear.index ?? 0) + 4)
      const pageMatch = after.match(/:\s*([0-9]{1,4}(?:\s*[-–]\s*[0-9]{1,4})?)/)
      const citationText = `(${segment})`
      const source = sources.find((candidate) => {
        if (candidate.citation.year !== year) return false
        return candidate.citation.surnames.some((surname) => before.includes(surname))
      }) ?? sources.find((candidate) => candidate.citation.year === year)

      if (!source) {
        addIssue(citationText, 'المصدر أو السنة غير موجودة في المقاطع المرفقة.')
        continue
      }
      if (!pageMatch) {
        addIssue(citationText, 'لا يوجد رقم صفحة مطبوع بعد السنة.')
        continue
      }

      const pageText = pageMatch[1]
      const pageNumbers = pageText
        .split(/[-–]/g)
        .map((page) => page.trim())
        .filter(Boolean)
      const knownPages = new Set(
        source.pages.map((page) => page.printedPage).filter(Boolean),
      )
      const missing = pageNumbers.filter((page) => !knownPages.has(page))
      if (knownPages.size === 0) {
        addIssue(citationText, 'لا تتوفر أرقام صفحات مطبوعة لهذا المصدر في المقاطع.')
      } else if (missing.length > 0) {
        addIssue(
          citationText,
          `الصفحة ${missing.join('، ')} غير موجودة ضمن الصفحات المرفقة لهذا المصدر.`,
        )
      } else {
        valid += 1
      }
    }
  }

  return { checked, valid, issues }
}

export interface ResearchPageSource {
  printedPage: string
  text: string
  pdfPage?: number
}

export interface ResearchSource {
  fileName: string
  citation: ResearchCitation
  pages: ResearchPageSource[]
}

export function buildResearchContext(sources: ResearchSource[]): string {
  const maxChars = 110_000
  const blocks: string[] = []
  let total = 0
  let truncated = false

  for (const source of sources) {
    const header = [
      `[المصدر: ${source.fileName}]`,
      `العنوان: ${source.citation.title}`,
      `الباحثون: ${source.citation.authors.join('؛ ') || 'غير محدد'}`,
      `السنة: ${source.citation.year}`,
      `الجامعة: ${source.citation.university || 'غير محددة'}`,
      `البلد: ${source.citation.country || 'غير محدد'}`,
      `صيغة التوثيق: ${source.citation.label}`,
      `المرجع الكامل: ${source.citation.reference}`,
      'الصفحات:',
    ].join('\n')
    let block = header
    for (const page of source.pages) {
      const section = `--- الصفحة المطبوعة: ${
        page.printedPage || '[رقم الصفحة غير واضح]'
      } ---\n${page.text}\n`
      if (total + block.length + section.length > maxChars) {
        truncated = true
        break
      }
      block += `\n${section}`
      total += section.length
    }
    blocks.push(block)
    total += header.length
    if (total >= maxChars) {
      truncated = true
      break
    }
  }

  if (truncated) blocks.push('\n[ملاحظة: اختُصرت بعض المقاطع بسبب حد السياق.]')
  return blocks.join('\n\n')
}

export function collectResearchSources(results: SourceResult[]): ResearchSource[] {
  return results
    .filter((result) => result.matches.length > 0 && result.researchPages.length > 0)
    .map((result) => ({
      fileName: result.fileName,
      citation: result.citation,
      pages: result.researchPages.map((page) => ({
        printedPage: page.printedPage,
        text: page.text,
        pdfPage: page.pdfPage,
      })),
    }))
}

export async function askResearcher(
  apiKey: string,
  request: string,
  sources: ResearchSource[],
  onUsage?: (event: UsageEvent) => void,
): Promise<string> {
  if (!apiKey.trim()) throw new Error('أدخل مفتاح DeepSeek API أولًا.')
  if (sources.length === 0) throw new Error('لا توجد صفحات مستخرجة يمكن الاعتماد عليها.')
  if (request.trim().length < 3) throw new Error('اكتب طلبك البحثي أولًا.')

  const context = buildResearchContext(sources)
  const system = `${RESEARCH_SYSTEM_PROMPT}\n\nالمصادر المتاحة (لا تخرج عنها):\n${context}`
  onUsage?.({ type: 'attempt' })

  let response: Response
  try {
    response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-flash',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: request.trim() },
        ],
        temperature: 0.35,
        max_tokens: 4000,
      }),
    })
  } catch {
    onUsage?.({ type: 'failure' })
    throw new Error('تعذّر الاتصال بـ DeepSeek لكتابة النص. تحقق من الإنترنت ثم أعد المحاولة.')
  }

  const raw = await response.text()
  let data: {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    error?: { message?: string }
  }
  try {
    data = JSON.parse(raw)
  } catch {
    onUsage?.({ type: 'failure' })
    throw new Error(`استجابة غير متوقعة من DeepSeek (${response.status}).`)
  }

  if (!response.ok || data.error) {
    onUsage?.({ type: 'failure' })
    if (response.status === 401) throw new Error('مفتاح DeepSeek API غير صالح.')
    if (response.status === 402) throw new Error('رصيد DeepSeek غير كافٍ.')
    if (response.status === 429) throw new Error('طلبات كثيرة على DeepSeek. انتظر قليلًا.')
    throw new Error(data.error?.message || `تعذّرت الكتابة عبر DeepSeek (${response.status}).`)
  }

  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) {
    onUsage?.({ type: 'failure' })
    throw new Error('لم يعُد DeepSeek بأي نص.')
  }

  const inputTokens = Number(data.usage?.prompt_tokens) || 0
  const outputTokens = Number(data.usage?.completion_tokens) || 0
  onUsage?.({
    type: 'success',
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: Number(data.usage?.total_tokens) || inputTokens + outputTokens,
    },
    pages: 0,
  })

  return content
}
