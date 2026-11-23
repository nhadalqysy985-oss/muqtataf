import type { PDFPageProxy } from 'pdfjs-dist'
import type { CoverInfo, ResearchCitation, SourceResult } from './types'
import type { UsageEvent } from './deepseek'
import { loadPdf } from './pdf'
import { cleanDisplay, isRejectedNameWord, normalizeArabic, normalizeDigits } from './text'

export const RESEARCH_SYSTEM_PROMPT = `أنت باحث أكاديمي متخصص في الكتابة العلمية باللغة العربية. مصدر معلوماتك الوحيد هو ملفات PDF (رسائل وأطاريح جامعية) المرفقة في هذه المحادثة. مهمتك كتابة نصوص بحثية رصينة بأسلوبك الخاص مع توثيق دقيق.

قاعدة الأولوية النظرية:
- عند صياغة النصوص العلمية والمفاهيم والأبعاد والمقارنات النظرية، اعتمد بالدرجة الأولى على الإطار النظري، والمفاهيم، والتعريفات، والأبعاد، والأدبيات السابقة، والعلاقات النظرية بين المتغيرات.
- لا تضمّن في الصياغة النظرية أرقام الجداول أو نتائج التحليل الإحصائي الخاصة بعينة البحث الميداني مثل: معاملات الثبات (ألفا كرونباخ)، المتوسطات الحسابية، الانحرافات المعيارية، نسب الاستجابة، ترتيب فقرات الاستبيان، أو نتائج اختبار الفرضيات الخاصة بعينة دراسة معينة، إلا إذا طلب المستخدم صراحةً في سؤاله "نتائج الدراسة الميدانية" أو "الجانب التطبيقي" أو "الإحصاء".
- إذا وردت فكرة نظرية في سياق يذكر أرقام عينة أو استبيان، استخرج الفكرة/المفهوم النظري العام فقط دون نسب أرقام عينة باحث آخر وكأنها قاعدة عامة للطالب.
- إذا لم يطلب المستخدم صراحةً النتائج الميدانية أو الجانب التطبيقي أو الإحصاء، فاعتبر النتائج الإحصائية خارج نطاق الإجابة.

أولاً: استخراج اسم الباحث/المؤلف فقط
- ابحث عن اسم صاحب البحث الأصلي (عادةً أسفل العنوان مباشرة وقبل الانتماء الجامعي أو البريد الإلكتروني، أو مسبوقاً بعبارات مثل: إعداد، الباحث، الباحثة، الطالب، الطالبة، إعداد الطالب/ة، تأليف).
- لا تشترط وجود كلمة "إعداد" أو "الباحث"؛ أي اسم شخصي يظهر تحت عنوان البحث مباشرة وقبل جهة العمل أو البريد الإلكتروني يُعد اسم الباحث.
- استبعد تماماً ولا تستخدم أسماء: المشرفين (بإشراف)، أعضاء ورئيس لجنة المناقشة (تتألف لجنة المناقشة من)، مقوّمي البحث، عميد الكلية، أو رئيس القسم.
- لا تكتب (مصدر غير محدد) إلا إذا كان النص المرسل خالياً تماماً من اسم الباحث أو الجهة الناشرة.
- استخدم "اللقب" (الاسم الأخير) في التوثيق. مثال: "حافظ عبد الكريم الغزالي" ← الغزالي.
- باحث واحد: (لقب الباحث، السنة: الصفحة) — مثل: (علي، 2026: 112).
- باحثان اثنان: (لقب الأول ولقب الثاني، السنة: الصفحة) — مثل: إذا كان الباحث الأول "عبدالله فاضل علي" والثاني "خالد محمد جاسم"، يُكتب: (علي وجاسم، السنة: الصفحة).
- ثلاثة باحثين فأكثر: (لقب الباحث الأول وآخرون، السنة: الصفحة) — مثل: "عبدالله فاضل علي، خالد جاسم محمد، رقية عبدالله محمد" ← (علي وآخرون، السنة: الصفحة).

ثانياً: استخراج السنة ورقم الصفحة
- التقط سنة النشر من ترويسة البحث أو المجلة أو صفحة العنوان (مثل: 2026).
- التقط رقم الصفحة الداخلي الفعلي المطبوع على الصفحة (مثل: 112)، وليس رقم صفحة ملف PDF.
- إذا كان العنوان يحمل صيغة "السنة الجامعية 2021/2022" فخذ الرقم الأكبر (2022).
- إذا امتدت المعلومة على صفحتين: (الغزالي، 2012: 12-13).
- إذا لم تستطع قراءة رقم الصفحة بوضوح، لا تخمّن؛ اكتب [رقم الصفحة غير واضح] ونبّه المستخدم.

ثالثاً: أسلوب الكتابة
- الحد الأقصى 500 كلمة. هذا سقف مو هدف.
- اكتب كل ما تحتويه الصفحات المرفقة عن الموضوع، وإذا المادة تكفي وصل لقرب 500 كلمة، وإذا المادة قليلة اكتب أقل وتوقف عند آخر معلومة موثقة.
- ممنوع التطويل بكلام عام أو تكرار أو إعادة صياغة نفس الفكرة لحتى تزيد الكلمات.
- كل جملة لازم تستند إلى النص وتنتهي بتوثيق (اللقب، السنة: الصفحة).
- أعد صياغة الفكرة بأسلوب باحث متخصص: حلّل، اربط، أعد ترتيب الجمل. ممنوع النسخ واللصق أو تغيير كلمات قليلة فقط.
- حافظ على المعنى بدقة؛ لا تضف معلومة غير موجودة في الصفحة المُوثَّقة.
- لغة أكاديمية رصينة، جمل واضحة، بدون حشو.
- الاقتباس الحرفي نادر، ويكون بين علامتي تنصيص مع الصفحة.
- اكتب نصًا علميًا بحثيًا فقط بفقرات علمية وأكاديمية.
- ممنوع أي جملة عن الدراسة أو النص أو المقطع أو المستخدم أو عن غياب تعريف.
- انقل أسماء الأبعاد والمصطلحات كما هي في النص حرفيًا.
- لا تحدد عدد الأبعاد أو المراحل أو الأنواع إلا إذا كان مذكورًا صراحة في النص، وإذا كان النص مقطوعًا قل "من أهمها" أو "منها".
- إذا كانت الصفحة قائمة مراجع أو مصادر أو فهرسًا، فتجاهلها تمامًا ولا تكتب عنها.
- ممنوع أن تبدأ الإجابة أو أي فقرة بجملة عن عدم وجود تعريف، أو عن الصفحة/الصفحات المرفقة، أو عن أن الصفحة مخصصة للمراجع، أو عن حدود ما ورد في المصدر.

رابعاً: التوثيق
- يوضع التوثيق في نهاية الفقرة/الجملة قبل النقطة أو بعدها بشكل ثابت، بصيغة: (اللقب، السنة: الصفحة).
- كل معلومة تُوثَّق بصفحتها الخاصة. إذا جمعت فقرة معلومات من صفحات مختلفة، وثّق كل جملة على حدة.
- النزاهة العلمية: إذا ذكرت الرسالة تعريفاً لباحث آخر (مثل Northouse, 2001)، فأنت لم تقرأ مصدره الأصلي، فاكتب: "عرّفها نورثهاوس (2001) نقلاً عن (الغزالي، 2012: 12)". لا تنسب المعلومة للباحث الداخلي كأنك رجعت له مباشرة.
- لا تخترع مصدراً أو رقم صفحة أبداً. اكتفِ بما ورد فقط، ولا تكتب أي فقرة عن غياب المعلومة أو عن الصفحات أو عن حدود المصدر.

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
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (!isRejectedNameWord(parts[index])) return parts[index]
  }
  return ''
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

  const matchPage = (line: string): string | null => {
    const normalized = normalizeDigits(line)
    const match = normalized.match(
      /^(?:[-–—:.\s]*)(?:صفحة|صفحه|page)?\s*([0-9]{1,4}|[\u0621-\u064A])\s*(?:[-–—:.\s]*)$/i,
    )
    if (!match) return null
    const value = match[1]
    if (/^\d+$/.test(value)) {
      const number = Number(value)
      if (number >= 1900 && number <= 2100) return null
    }
    return value
  }

  // Header first; footer only if the header has no page marker.
  for (const line of lines.slice(0, 3)) {
    const page = matchPage(line)
    if (page) return page
  }
  for (const line of lines.slice(-3).reverse()) {
    const page = matchPage(line)
    if (page) return page
  }
  return null
}

export function isReferencePage(text: string): boolean {
  const lines = text
    .split(/\r?\n/)
    .map((line) => cleanDisplay(line))
    .filter(Boolean)
  const head = lines.slice(0, 4).map((line) => normalizeArabic(line).replace(/[.:：]/g, '').trim())
  const heading = /^(?:قايمه\s+)?(?:المصادر\s*و\s*المراجع|المراجع\s*و\s*المصادر|قايمه\s+المراجع|قايمه\s+المصادر|المصادر|المراجع|bibliography|references)$/
  if (head.some((line) => heading.test(line))) return true

  const yearLines = lines.filter((line) =>
    /(?<!\d)(19|20)\d{2}(?!\d)/.test(normalizeDigits(line)),
  )
  return lines.length >= 8 && yearLines.length >= 5 && yearLines.length / lines.length >= 0.35
}

export function buildCitation(cover: CoverInfo): ResearchCitation {
  const authors = cover.authorNames?.length
    ? cover.authorNames
    : splitAuthorNames(cover.authors)
  const validAuthors = authors.filter((author) => surnameOf(author))
  const surnames = validAuthors.map(surnameOf).filter(Boolean)
  const rawYear = (cover.year || '').replace(/\s*[مه]$/u, '').trim()
  const year = /^\d{4}$/.test(rawYear) ? rawYear : 'السنة غير واضحة'
  let label = `(باحث غير واضح، ${year})`
  if (surnames.length === 1) label = `(${surnames[0]}، ${year})`
  else if (surnames.length === 2) label = `(${surnames[0]} و${surnames[1]}، ${year})`
  else if (surnames.length >= 3) label = `(${surnames[0]} وآخرون، ${year})`

  const degree = cover.degree ? `رسالة ${cover.degree}` : 'رسالة/أطروحة جامعية'
  const referenceAuthors = validAuthors.length
    ? validAuthors
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
    : 'باحث غير واضح'
  const reference = `${referenceAuthors} (${year}). ${cover.title}. ${degree}، ${
    cover.university || 'جامعة غير محددة'
  }، ${cover.country || 'بلد غير محدد'}.`

  return {
    authors: validAuthors,
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
      const secondary = before.match(/(?:نقلاً عن|نقلًا عن|نقلا عن|as cited in)\s*(.*)$/i)
      if (secondary) before = secondary[1]
      const beforeNormalized = normalizeArabic(before)
      const after = segment.slice((lastYear.index ?? 0) + 4)
      const pageMatch = after.match(
        /:\s*((?:[0-9]{1,4}|[\u0621-\u064A])(?:\s*[-–]\s*(?:[0-9]{1,4}|[\u0621-\u064A]))?)/,
      )
      const citationText = `(${segment})`
      const source = sources.find((candidate) => {
        if (candidate.citation.year !== year) return false
        return candidate.citation.surnames.some((surname) =>
          beforeNormalized.includes(normalizeArabic(surname)),
        )
      })

      if (!source) {
        addIssue(citationText, 'لقب الباحث أو السنة غير موجود في أسماء الغلاف المرفقة.')
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

export interface CleanResearchResult {
  text: string
  warnings: string[]
}

const WARNING_START = /^(?:تنبيه|ملاحظة|ملحوظة)(?:\s|:|：|$)/
const META_START =
  /^(?:لم أجد|لم يُعرَّف|لم يعرف|لم يُعرف|الصفحة المرفقة|الصفحات المرفقة|لا تتضمن|لم تتضمن|قائمة المصادر|قائمة المراجع|المصادر والمراجع|تشير الصفحة|يظهر من سياق العرض)/

const PRACTICAL_SENTENCE =
  /((?:ألفا|الفا)\s*كرونباخ|كرونباخ|معامل\s*الثبات|المتوسط\s*الحسابي|المتوسطات\s*الحسابيه|الانحراف\s*المعيار|الانحرافات\s*المعياريه|نسب\s*الاستجابه|نسبه\s*الاستجابه|ترتيب\s*الفقرات|الاستبيان|الاستبانه|اختبار\s*الفرضيات|الفرضيه|الفرضيات|معامل\s*الارتباط|بيرسون|سبيرمان|ANOVA|T[- ]?test|Sig\.?|p[- ]?value|table\s*\d|الجدول\s*\(?\d|جدول\s*\(?\d|نتايج\s*التحليل\s*الاحصائي|عينه\s*الدراسه)/i

export function wantsPracticalResults(request: string): boolean {
  const normalized = normalizeArabic(request)
  return /(نتايج\s+الدراسه\s+الميدانيه|الجانب\s+التطبيقي|الجانب\s+الميداني|الاحصاء|التحليل\s+الاحصائي|نتايج\s+العينه|عينه\s+الدراسه)/.test(
    normalized,
  )
}

export function cleanResearchOutput(
  raw: string,
  allowPractical = false,
): CleanResearchResult {
  let text = raw
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ''))
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-+]\s+/gm, '')
    .replace(/^\s*---+\s*$/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\u0640/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')

  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => {
      const lines = paragraph.split(/\n/).map((line) => line.trimEnd())
      if (
        lines.length > 0 &&
        (WARNING_START.test(lines[0].trim()) || META_START.test(lines[0].trim()))
      ) {
        return ''
      }
      return lines
        .filter((line) => !WARNING_START.test(line.trim()) && !META_START.test(line.trim()))
        .join('\n')
        .trim()
    })
    .filter(Boolean)

  let removedPractical = 0
  const filteredParagraphs = allowPractical
    ? paragraphs
    : paragraphs
        .map((paragraph) => {
          const sentences = paragraph.split(/(?<=[.!؟])\s+/)
          const kept = sentences.filter((sentence) => {
            if (PRACTICAL_SENTENCE.test(normalizeArabic(sentence))) {
              removedPractical += 1
              return false
            }
            return true
          })
          return kept.join(' ').trim()
        })
        .filter(Boolean)

  text = filteredParagraphs.join('\n\n').trim()

  const normalized = normalizeArabic(text)
  const checks: Array<[string, string]> = [
    ['لم يُعرَّف', 'وردت عبارة «لم يُعرَّف» في النص.'],
    ['لم أجد', 'وردت عبارة «لم أجد» في النص.'],
    ['يظهر من سياق العرض', 'وردت عبارة «يظهر من سياق العرض» في النص.'],
    ['لم يتضمن المقطع', 'وردت عبارة «لم يتضمن المقطع» في النص.'],
    ['الصفحة المرفقة', 'ورد ذكر «الصفحة المرفقة» داخل النص.'],
    ['الصفحات المرفقة', 'ورد ذكر «الصفحات المرفقة» داخل النص.'],
  ]
  const warnings = checks
    .filter(([phrase]) => normalized.includes(normalizeArabic(phrase)))
    .map(([, message]) => message)
  if (removedPractical > 0) {
    warnings.unshift(
      `حُذفت ${removedPractical} جملة تحتوي أرقامًا أو نتائج ميدانية/إحصائية لأن طلبك نظري.`,
    )
  }

  return { text, warnings }
}

export interface ResearchPageSource {
  printedPage: string
  text: string
  pdfPage?: number
  outputPage?: number
}

export interface ResearchSource {
  fileName: string
  citation: ResearchCitation
  pages: ResearchPageSource[]
  pdfBlob?: Blob
}

export interface ResearchImage {
  sourceName: string
  citationLabel: string
  printedPage: string
  dataUrl: string
}

const MAX_IMAGES = 32
const MAX_IMAGE_DATA_CHARS = 24 * 1024 * 1024

async function pageToJpegDataUrl(page: PDFPageProxy): Promise<string | undefined> {
  try {
    const viewport = page.getViewport({ scale: 1.6 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const context = canvas.getContext('2d')
    if (!context) return undefined
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({
      canvasContext: context,
      viewport,
      canvas,
    } as Parameters<typeof page.render>[0]).promise
    const dataUrl = canvas.toDataURL('image/jpeg', 0.84)
    canvas.width = 0
    canvas.height = 0
    return dataUrl
  } catch {
    return undefined
  }
}

async function renderResearchImages(sources: ResearchSource[]): Promise<ResearchImage[]> {
  const withPdf = sources.filter((source) => source.pdfBlob && source.pages.length > 0)
  if (withPdf.length === 0) return []

  const perSource = Math.max(1, Math.floor(MAX_IMAGES / withPdf.length))
  const images: ResearchImage[] = []
  let totalChars = 0

  for (const source of withPdf) {
    if (!source.pdfBlob) continue
    const bytes = new Uint8Array(await source.pdfBlob.arrayBuffer())
    let doc
    try {
      doc = (await loadPdf(bytes)).doc
      const limit = Math.min(perSource, source.pages.length, doc.numPages)
      for (let index = 0; index < limit; index += 1) {
        if (images.length >= MAX_IMAGES || totalChars >= MAX_IMAGE_DATA_CHARS) break
        const pageMeta = source.pages[index]
        const outputPage = pageMeta?.outputPage ?? index + 1
        if (outputPage < 1 || outputPage > doc.numPages) continue
        const page = await doc.getPage(outputPage)
        const dataUrl = await pageToJpegDataUrl(page)
        page.cleanup()
        if (!dataUrl) continue
        if (totalChars + dataUrl.length > MAX_IMAGE_DATA_CHARS) break
        totalChars += dataUrl.length
        images.push({
          sourceName: source.fileName,
          citationLabel: source.citation.label,
          printedPage: pageMeta?.printedPage || '[رقم الصفحة غير واضح]',
          dataUrl,
        })
      }
    } catch {
      // If images cannot be rendered, the text context is still sent.
    } finally {
      await doc?.destroy().catch(() => undefined)
    }
  }

  return images
}

function imageContentBlocks(images: ResearchImage[]) {
  return images.flatMap((image) => [
    {
      type: 'text' as const,
      text: `[صورة من المصدر: ${image.sourceName} | التوثيق: ${image.citationLabel} | الصفحة المطبوعة: ${image.printedPage}]`,
    },
    {
      type: 'image_url' as const,
      image_url: { url: image.dataUrl, detail: 'high' as const },
    },
  ])
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
    .map((result) => {
      const pages = result.researchPages
        .filter((page) => page.pdfPage !== 1)
        .filter((page) => /^\d+$/.test(page.printedPage.trim()))
        .filter((page) => !isReferencePage(page.text))
        .map((page) => ({
          printedPage: page.printedPage,
          text: page.text,
          pdfPage: page.pdfPage,
          outputPage: page.outputPage,
        }))
      return {
        fileName: result.fileName,
        citation: result.citation,
        pages,
        pdfBlob: result.outputBlob,
      }
    })
    .filter((source) => source.pages.length > 0)
}

export interface ResearchAnswer {
  text: string
  finishReason: string
}

export async function askResearcher(
  apiKey: string,
  request: string,
  sources: ResearchSource[],
  onUsage?: (event: UsageEvent) => void,
): Promise<ResearchAnswer> {
  if (!apiKey.trim()) throw new Error('أدخل مفتاح DeepSeek API أولًا.')
  if (sources.length === 0) throw new Error('لا توجد صفحات مستخرجة يمكن الاعتماد عليها.')
  if (request.trim().length < 3) throw new Error('اكتب طلبك البحثي أولًا.')

  const context = buildResearchContext(sources)
  const images = await renderResearchImages(sources)
  const practical = wantsPracticalResults(request)
  const system = `${RESEARCH_SYSTEM_PROMPT}\n\n${
    practical
      ? 'طلب المستخدم صراحةً نتائج ميدانية/إحصائية؛ يجوز ذكرها ضمن الحدود المطلوبة.'
      : 'المستخدم لم يطلب نتائج ميدانية أو إحصائية؛ التزم بالإطار النظري والمفاهيم فقط، ولا تذكر أرقام العينة أو الجداول أو ألفا كرونباخ أو المتوسطات أو الفرضيات.'
  }\n\nالمصادر المتاحة (لا تخرج عنها):\n${context}\n\n${
    images.length > 0
      ? 'أُرفقت أيضًا صور للصفحات المستخرجة. استخدم الصور للتحقق البصري من النص وأرقام الصفحات المطبوعة، واعتمد على النص والصور معًا.'
      : ''
  }`
  const userContent: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; detail: 'high' } }
  > = [
    {
      type: 'text',
      text: `${request.trim()}\n\n${
        images.length > 0
          ? `أرفقت ${images.length} صورة من الصفحات المستخرجة.`
          : 'لم تتوفر صور للصفحات؛ اعتمد على النص المرفق.'
      }`,
    },
    ...imageContentBlocks(images),
  ]

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
          { role: 'user', content: userContent },
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
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>
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

  return {
    text: content,
    finishReason: data.choices?.[0]?.finish_reason ?? 'unknown',
  }
}
