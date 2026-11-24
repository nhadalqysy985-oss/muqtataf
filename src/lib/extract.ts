import { PDFDocument } from 'pdf-lib'
import JSZip from 'jszip'
import { loadPdf, renderThumbnail } from './pdf'
import { ocrWithDeepSeek } from './deepseek'
import type { UsageEvent } from './deepseek'
import { makeSnippet, normalizeArabic, scorePage } from './text'
import { cleanDisplay, isRejectedNameWord, normalizeDigits } from './text'
import { coverFingerprint, loadCoverCache, saveCoverCache } from './coverCache'
import {
  buildCitation,
  detectCountry,
  detectPrintedPageNumber,
  splitAuthorNames,
} from './research'
import type {
  CoverInfo,
  FileProgress,
  PageMatch,
  ResearchPage,
  Sensitivity,
  SourceFile,
  SourceResult,
  Topic,
} from './types'

const AUTHOR_MARKER =
  /(?:^|\s)(?:من\s+|قام\s+ب)?(?:إعداد|اعداد|أعداد|تأليف|تاليف)\s*(?:الطالبتان|الطالبان|الباحثتان|الباحثان|الطالبات|الطلاب|الطالب(?:ة|\/ة)?|الطلبة|الباحث(?:ة|\/ة)?|الباحثين)?\s*[:\-–]?\s*(.*)$/u

const ROLE_MARKER =
  /^(?:الباحث(?:ة)?|الطالب(?:ة)?|الطالبات|الطلاب|الطلبة|الطالبان|الطالبتان|الباحثان|الباحثتان|المؤلف(?:ة)?)\s*[:\-–]\s*(.+)$/u

const TITLE_ROLE =
  /^(?:أ\.?\s*د\.?|أستاذ|الأستاذ|الدكتور|الدكتورة|د\.)\s+/u

const EXCLUDED_ROLE =
  /^(?:إشراف|اشراف|بإشراف|بِإشراف|المشرف|لجنة|لجنه|تتألف|رئيس|عميد|مقوم|مقيم|مناقش|البريد|الملخص|المستخلص|abstract|كلمات|keywords)/i

const INSTITUTION_LINE =
  /(جامعه|كليه|قسم|معهد|مركز|هيئه|وزاره|مجله|شركه|مؤسسه|منظمه|الكترونيه|ملخص|كلمات|مفتاحيه|journal|university|college|department|faculty|@|بريد|email|https?|www|doi|issn)/i

const RESEARCH_WORD =
  /(دراسه|دراسة|بحث|مقارنه|مقارنة|تحليل|تطبيق|رساله|رسالة|اطروحه|أطروحة|منهج|منهجيه|منهجية|ميدانيه|ميدانية|تجريبيه|تجريبية|نظريه|نظرية|ملخص|كلمات|مفتاحيه|مجلد|عدد)/i

const TITLE_WORDS = new Set(
  [
    'في',
    'على',
    'من',
    'إلى',
    'الى',
    'حول',
    'عن',
    'خلال',
    'بين',
    'دراسة',
    'دراسه',
    'بحث',
    'تحليل',
    'دور',
    'أثر',
    'اثر',
    'واقع',
    'تطبيق',
    'مقارنة',
    'مقارنه',
    'مدخل',
    'إطار',
    'اطار',
    'علاقة',
    'علاقه',
    'تأثير',
    'تاثير',
    'أبعاد',
    'ابعاد',
    'مفاهيم',
    'نظريات',
    'القيادة',
    'القياده',
    'الإبداع',
    'الابداع',
    'الأداء',
    'الاداء',
    'الرضا',
    'الالتزام',
    'التنظيمي',
    'المؤسسي',
    'الوظيفي',
    'العام',
    'الخاص',
    'الجامعات',
    'القطاع',
  ].map(normalizeArabic),
)

const COUNTRY_LINE =
  /^(?:العراق|الجزائر|اليمن|مصر|السعودية|المملكة العربية السعودية|الأردن|سوريا|لبنان|تونس|المغرب|ليبيا|السودان|فلسطين|الكويت|الإمارات|قطر|البحرين|عمان)$/u

function cleanPersonName(line: string): string {
  return cleanDisplay(line)
    .replace(TITLE_ROLE, '')
    .replace(/^(?:الباحث(?:ة)?|الطالب(?:ة)?|المؤلف(?:ة)?)\s*[:\-–]?\s*/u, '')
    .replace(/^(?:و|&)\s+/, '')
    .replace(/^[:\-–،.\s]+|[:\-–،.\s]+$/g, '')
    .trim()
}

function isInvalidAuthorName(name: string): boolean {
  const normalized = normalizeArabic(cleanPersonName(name))
  const tokens = normalized.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true
  if (tokens.some((token) => isRejectedNameWord(token))) return true
  if (INSTITUTION_LINE.test(normalized)) return true
  if (RESEARCH_WORD.test(normalized)) return true
  if (COUNTRY_LINE.test(normalized)) return true
  if (EXCLUDED_ROLE.test(normalized)) return true
  return false
}

function looksLikePersonName(line: string): boolean {
  if (/^(?:أ\.?\s*د\.?|أستاذ|الأستاذ|الدكتور|الدكتورة)\b/u.test(cleanDisplay(line))) {
    return false
  }
  const cleaned = cleanPersonName(line)
  if (cleaned.length < 6 || cleaned.length > 80) return false
  if (/\d|@|https?:|www\./i.test(cleaned)) return false
  if (isInvalidAuthorName(cleaned)) return false
  const tokens = cleaned.split(/\s+/).filter(Boolean)
  if (tokens.length < 2 || tokens.length > 6) return false
  if (TITLE_WORDS.has(normalizeArabic(tokens[0]))) return false
  return true
}

const BOILERPLATE =
  /(جامعه|كليه|قسم|معهد|وزاره|الجمهوريه|رساله|اطروحه|ماجستير|دكتوراه|دبلوم|بكالوريوس|جزء من متطلبات|نيل شهاده|بسم الله|الرحمن|الرحيم)/

const DEGREE = /(ماجستير|دكتوراه|دبلوم|بكالوريوس)/

function stripCoverMarkup(line: string): string {
  return line
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#\d+;/g, ' ')
    .replace(/\*\*|__/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`#>|¦]/g, ' ')
    .replace(/[\uFFFD\u25A1\u25A0\u25AA\u25CF\u25C6\u25C7\u2022\u00B7\u25E6]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/^[.,;:،؛\-–—_=+*#/\\]+|[.,;:،؛\-–—_=+*#/\\]+$/g, '')
    .trim()
}

function pageLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => cleanDisplay(stripCoverMarkup(line)))
    .filter((line) => line.length > 0)
}

function extractAuthors(
  lines: string[],
  titleIndex: number,
): { authors: string; sourceLine: string } {
  const cleanInline = (value: string) =>
    cleanDisplay(value)
      .replace(/\s*(?:إشراف|اشراف|المشرف|لجنة المناقشة|تتألف لجنة)\s*[:：].*$/u, '')
      .replace(/^[:\-–،.\s]+|[:\-–،.\s]+$/g, '')
      .trim()

  for (let index = 0; index < Math.min(lines.length, 15); index += 1) {
    const line = lines[index]
    const marker = line.match(AUTHOR_MARKER) ?? line.match(ROLE_MARKER)
    if (!marker) continue
    const inline = cleanInline(marker[1] ?? '')
    if (
      inline.length >= 3 &&
      inline.length <= 100 &&
      !EXCLUDED_ROLE.test(inline) &&
      !isInvalidAuthorName(inline)
    ) {
      return { authors: inline, sourceLine: line }
    }
    const next = lines[index + 1]
    if (next && looksLikePersonName(next)) {
      return { authors: cleanPersonName(next), sourceLine: next }
    }
  }

  const start = titleIndex >= 0 ? titleIndex + 1 : 0
  for (let index = start; index < Math.min(lines.length, start + 8); index += 1) {
    const line = lines[index]
    const normalized = normalizeArabic(line)
    if (EXCLUDED_ROLE.test(normalized)) break
    if (INSTITUTION_LINE.test(normalized) || COUNTRY_LINE.test(normalized)) break
    if (looksLikePersonName(line)) {
      return { authors: cleanPersonName(line), sourceLine: line }
    }
  }

  return { authors: '', sourceLine: '' }
}

const COMMON_GIVEN_NAMES = [
  'عبدالرحمن',
  'عبدالله',
  'عبدالعزيز',
  'عبدالكريم',
  'عبدالحكيم',
  'عبدالرزاق',
  'محمد',
  'أحمد',
  'احمد',
  'محمود',
  'مصطفى',
  'إبراهيم',
  'ابراهيم',
  'علي',
  'حسن',
  'حسين',
  'خالد',
  'سعيد',
  'سعد',
  'يوسف',
  'عمر',
  'عثمان',
  'سليمان',
  'سليمة',
  'فاطمة',
  'مريم',
  'زينب',
  'نور',
  'هدى',
  'سارة',
  'ليلى',
  'رانيا',
  'صفاء',
  'حافظ',
  'عارف',
  'ياسر',
  'ناصر',
  'قاسم',
  'كريم',
  'رحيم',
  'جاسم',
  'عباس',
  'حيدر',
  'أمير',
  'امين',
  'آمنة',
  'آية',
  'إسراء',
  'اسراء',
  'دعاء',
  'شهد',
  'رقية',
  'سجى',
  'تبارك',
  'ملاك',
  'بنين',
  'غادة',
  'غيداء',
  'شيماء',
  'أسماء',
  'اسماء',
]

function repairGluedName(token: string): { text: string; warning?: string } {
  if (token.includes(' ') || token.length < 6) return { text: token }
  if (COMMON_GIVEN_NAMES.includes(token)) return { text: token }
  const prefixes = [...COMMON_GIVEN_NAMES]
    .filter((name) => name.length >= 3 && token.startsWith(name))
    .sort((a, b) => b.length - a.length)
  for (const prefix of prefixes) {
    const rest = token.slice(prefix.length)
    if (rest.length >= 2) {
      return { text: `${prefix} ${rest}` }
    }
  }
  return {
    text: token,
    warning:
      token.length >= 8
        ? `اسم ملصوق لم أتمكن من فصله بثقة: «${token}». يرجى مراجعته يدويًا.`
        : undefined,
  }
}

function repairAuthors(rawAuthors: string): { authors: string; names: string[]; warnings: string[] } {
  const rawNames = splitAuthorNames(rawAuthors)
  if (rawNames.length === 0) return { authors: '', names: [], warnings: [] }
  const warnings: string[] = []
  const names = rawNames.map((name) => {
    const repaired = repairGluedName(name)
    if (repaired.warning) warnings.push(repaired.warning)
    return repaired.text
  }).filter((name) => !isInvalidAuthorName(name))
  return { authors: names.join(' و '), names, warnings }
}

const COVER_VISION_PROMPT = `أنت تقرأ صورة عالية الوضوح لصفحة غلاف بحث علمي. استخرج فقط:
1. أسماء الباحثين/المؤلفين الظاهرين أسفل عنوان البحث، أو بعد عبارات: إعداد، الباحث، الباحثة، الطالب، الطالبة، تأليف.
2. سنة النشر المطبوعة (4 أرقام).

قواعد صارمة:
- استبعد المشرف (بإشراف)، لجنة المناقشة، المقوّمين، عميد الكلية، رئيس القسم.
- لا تعتبر الجامعة أو الكلية أو القسم أو المجلة أو الشركة أو المؤسسة اسم باحث.
- لا تعتبر ISSN أو DOI أو رقم صفحة أو رقم مجلد/عدد سنة نشر.
- إذا لم يتضح اسم الباحث أو السنة، أعد مصفوفة فارغة أو سنة فارغة، ولا تخمّن.
- أعد JSON فقط بهذه البنية:
{"authors":["الاسم الكامل"],"year":"2026","confidence":"high|medium|low"}
- لا تكتب أي شرح خارج JSON.`

interface VisionCoverInfo {
  authors: string[]
  year: string
}

async function renderCoverImage(bytes: Uint8Array): Promise<string | undefined> {
  let doc
  try {
    doc = (await loadPdf(bytes)).doc
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const scale = Math.max(2.2, Math.min(3.2, 2400 / base.width))
    const viewport = page.getViewport({ scale })
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
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    page.cleanup()
    canvas.width = 0
    canvas.height = 0
    return dataUrl
  } catch {
    return undefined
  } finally {
    await doc?.destroy().catch(() => undefined)
  }
}

async function readCoverFromImage(
  imageDataUrl: string,
  apiKey: string,
  onUsage?: (event: UsageEvent) => void,
): Promise<VisionCoverInfo | null> {
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
          { role: 'system', content: COVER_VISION_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'اقرأ غلاف البحث المرفق واستخرج أسماء الباحثين وسنة النشر فقط بصيغة JSON.',
              },
              {
                type: 'image_url',
                image_url: { url: imageDataUrl, detail: 'high' },
              },
            ],
          },
        ],
        temperature: 0,
        max_tokens: 600,
      }),
    })
  } catch {
    onUsage?.({ type: 'failure' })
    return null
  }

  const raw = await response.text()
  let data: {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
  }
  try {
    data = JSON.parse(raw)
  } catch {
    onUsage?.({ type: 'failure' })
    return null
  }
  if (!response.ok || !data.choices?.[0]?.message?.content) {
    onUsage?.({ type: 'failure' })
    return null
  }

  const content = data.choices[0].message.content
  const usage = {
    inputTokens: Number(data.usage?.prompt_tokens) || 0,
    outputTokens: Number(data.usage?.completion_tokens) || 0,
    totalTokens: Number(data.usage?.total_tokens) || 0,
  }
  onUsage?.({ type: 'success', usage, pages: 0 })

  try {
    const cleaned = content
      .replace(/```(?:json)?/gi, '')
      .replace(/```/g, '')
      .trim()
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
      authors?: unknown
      year?: unknown
    }
    const rawAuthors = Array.isArray(parsed.authors)
      ? parsed.authors
      : typeof parsed.authors === 'string'
        ? [parsed.authors]
        : []
    const authors = rawAuthors
      .filter((author): author is string => typeof author === 'string')
      .map((author) => cleanDisplay(author))
      .filter((author) => author.length >= 3 && !isInvalidAuthorName(author))
    const yearMatch = normalizeDigits(String(parsed.year ?? '')).match(
      /(?<!\d)((?:19|20)\d{2})(?!\d)/,
    )
    return { authors, year: yearMatch?.[1] ?? '' }
  } catch {
    return null
  }
}

function mergeVisionCover(base: CoverInfo, vision: VisionCoverInfo | null): CoverInfo {
  if (!vision) return base
  const visionAuthors = repairAuthors(vision.authors.join(' و '))
  const useVisionAuthors = visionAuthors.names.length > 0
  const authors = useVisionAuthors ? visionAuthors.authors : base.authors
  const authorNames = useVisionAuthors ? visionAuthors.names : base.authorNames ?? []
  const fields = {
    ...base,
    authors,
    authorNames,
    authorLine: useVisionAuthors ? 'صورة الغلاف (قراءة بصرية)' : base.authorLine,
    surnameLine: useVisionAuthors ? 'صورة الغلاف (قراءة بصرية)' : base.surnameLine,
    nameWarnings: useVisionAuthors ? visionAuthors.warnings : base.nameWarnings,
    year: vision.year ? `${vision.year}م` : base.year,
    yearLine: vision.year ? 'صورة الغلاف (قراءة بصرية)' : base.yearLine,
  }
  return fields
}

function extractYearFromCover(lines: string[]): { year: string; line: string } {
  let academic: { year: number; line: string } | null = null
  let best: { year: number; line: string; score: number } | null = null

  for (const line of lines) {
    const normalized = normalizeDigits(line)
    if (/(?:doi|issn|https?:\/\/|www\.|@)/i.test(normalized)) continue

    const cue =
      /(?:سنة|سنه|عام|تاريخ|نشر|جامعية|جامعيه|copyright|©|مجلة|مجله|جامعة|جامعه)/i.test(
        normalized,
      )
    const pageLine = /(?:صفح|صفحه|page|pp\.?)/i.test(normalized)
    const range = normalized.match(/((?:19|20)\d{2})\s*[/\-]\s*((?:19|20)\d{2})/)
    if (range && !(pageLine && !cue)) {
      const year = Math.max(Number(range[1]), Number(range[2]))
      if (!academic || year > academic.year) academic = { year, line }
      continue
    }

    const years = [
      ...normalized.matchAll(/(?<![\d.])((?:19|20)\d{2})(?![\d.])/g),
    ]
    for (const match of years) {
      const index = match.index ?? 0
      const before = normalized.slice(0, index)
      if (/(?:ص|صفحه|صفحة|page|pp|عدد|مجلد|volume|vol|issue|رقم)\s*[:.]?\s*$/i.test(before)) {
        continue
      }
      const year = Number(match[1])
      const score = cue ? 2 : 1
      if (
        !best ||
        score > best.score ||
        (score === best.score && year > best.year)
      ) {
        best = { year, line, score }
      }
    }
  }

  if (academic) return { year: `${academic.year}م`, line: academic.line }
  if (best) return { year: `${best.year}م`, line: best.line }
  return { year: '', line: '' }
}

function extractCover(pages: Array<{ index: number; text: string }>, fileName: string): CoverInfo {
  const first = pages.find((page) => page.index === 0)
  const lines = pageLines(first?.text ?? '')
  const fallback = fileName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() || 'مصدر بدون عنوان'

  const authorIndex = lines.findIndex((line) => AUTHOR_MARKER.test(line))
  const limit = authorIndex > 0 ? authorIndex : Math.min(lines.length, 12)
  const titleCandidates = lines
    .slice(0, limit)
    .filter((line) => line.length >= 8 && line.length <= 180)
    .filter((line) => !BOILERPLATE.test(normalizeArabic(line)))
    .filter((line) => !/(?:issn|doi|https?:\/\/|www\.|المجلد|العدد|صفحة|صفحه|page|volume|issue)/i.test(line))
    .filter((line) => !/^(?:doi|issn|https?)/i.test(line))
    .sort((a, b) => b.length - a.length)
  const title = titleCandidates[0] ?? fallback
  const titleIndex = title === fallback ? -1 : lines.findIndex((line) => line === title)

  const normalizedAll = normalizeArabic(lines.join(' '))
  const yearInfo = extractYearFromCover(lines)
  const universityLine = lines.find((line) => /(جامعه|كليه|معهد)/.test(normalizeArabic(line)))
  const degree = DEGREE.exec(normalizedAll)?.[1]
  const authorInfo = extractAuthors(lines, titleIndex)
  const repaired = repairAuthors(authorInfo.authors)

  return {
    title,
    authors: repaired.authors,
    authorNames: repaired.names,
    authorLine: authorInfo.sourceLine,
    surnameLine: authorInfo.sourceLine,
    nameWarnings: repaired.warnings,
    year: yearInfo.year,
    yearLine: yearInfo.line,
    university: universityLine,
    country: detectCountry(lines),
    degree,
    coverReadable: lines.length > 0,
    titleSource: title === fallback ? 'filename' : 'cover',
  }
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 110)
}

export async function extractSource(
  source: SourceFile,
  topics: Topic[],
  apiKey: string,
  sensitivity: Sensitivity,
  onProgress: (progress: FileProgress) => void,
  onUsage?: (event: UsageEvent) => void,
): Promise<SourceResult> {
  const bytes = new Uint8Array(await source.file.arrayBuffer())
  const fingerprint = coverFingerprint(source.file)
  const cachedCover = loadCoverCache(fingerprint)
  onProgress({ stage: 'reading', value: 0.03 })

  const ocr = await ocrWithDeepSeek(source.file, apiKey, onProgress, onUsage)
  const pages = ocr.pages
  if (pages.length === 0) throw new Error('لم يعُد DeepSeek بأي صفحات نصية لهذا الملف.')

  onProgress({ stage: 'cover', value: 0.76 })
  const textCover = extractCover(pages, source.name)
  let cover = cachedCover ?? textCover
  if (!cachedCover) {
    const coverImage = await renderCoverImage(bytes)
    if (coverImage) {
      const visionCover = await readCoverFromImage(coverImage, apiKey, onUsage)
      if (visionCover) {
        cover = mergeVisionCover(textCover, visionCover)
        saveCoverCache(fingerprint, cover)
      }
    }
  }

  let thumbnailUrl: string | undefined
  try {
    const loaded = await loadPdf(bytes)
    try {
      const firstPage = await loaded.doc.getPage(1)
      thumbnailUrl = await renderThumbnail(firstPage, 250)
    } finally {
      await loaded.doc.destroy().catch(() => undefined)
    }
  } catch {
    thumbnailUrl = undefined
  }

  onProgress({ stage: 'searching', value: 0.8 })
  const matches: PageMatch[] = []
  let incompletePages = 0

  for (const page of pages) {
    if (page.finishReason === 'length') incompletePages += 1
    if (page.index === 0) continue
    const scored = scorePage([normalizeArabic(page.text)], topics, sensitivity)
    if (scored.matched.length === 0) continue
    const matchedTerms = scored.matched.flatMap((match) => {
      const topic = topics.find((entry) => entry.display === match.topic)
      return topic ? topic.termVariants : []
    })
    matches.push({
      pageNumber: page.index + 1,
      score: scored.score,
      topics: scored.matched.map((match) => match.topic),
      snippet: makeSnippet(pageLines(page.text), matchedTerms),
    })
  }

  onProgress({ stage: 'building', value: 0.9 })

  const output = await PDFDocument.create()
  const sourceDoc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const sourcePageCount = sourceDoc.getPageCount()
  const validMatches = matches.filter(
    (match) => match.pageNumber >= 1 && match.pageNumber <= sourcePageCount,
  )
  const pageIndexes = [0, ...validMatches.map((match) => match.pageNumber - 1)]
  const copied = await output.copyPages(sourceDoc, pageIndexes)
  for (const page of copied) output.addPage(page)
  output.setTitle(`${cover.title} — مقتطف`)
  if (cover.authors) output.setAuthor(cover.authors)
  output.setSubject(
    `مقتطف من: ${source.name} — الموضوع: ${topics.map((topic) => topic.display).join('، ')}`,
  )
  output.setKeywords(topics.map((topic) => topic.display))
  output.setCreator('مُقتطف — تحليل عبر DeepSeek')
  output.setProducer('مُقتطف')
  const outputBytes = await output.save()
  const outputBlob = new Blob([outputBytes as BlobPart], { type: 'application/pdf' })

  const base = sanitizeFilename(source.name.replace(/\.pdf$/i, '')) || 'مصدر'
  const matchedTopics = [...new Set(matches.flatMap((match) => match.topics))]
  const citation = buildCitation(cover)
  const pageTextByNumber = new Map(pages.map((page) => [page.index + 1, page.text]))
  const researchPageNumbers = [1, ...matches.map((match) => match.pageNumber)].filter(
    (pageNumber, index, all) => all.indexOf(pageNumber) === index,
  )
  const researchPages: ResearchPage[] = researchPageNumbers
    .map((pageNumber, index) => {
      const text = pageTextByNumber.get(pageNumber) ?? ''
      if (!text) return null
      return {
        pdfPage: pageNumber,
        outputPage: index + 1,
        printedPage: detectPrintedPageNumber(text) ?? '',
        text,
      }
    })
    .filter((page): page is ResearchPage => page !== null)

  let warning: string | undefined
  if (matches.length === 0) {
    warning = 'لم تُعثر صفحات مطابقة للموضوع في النص الذي أعاده DeepSeek؛ الملف الناتج يضم الغلاف فقط.'
  } else if (incompletePages > 0) {
    warning = `تعذّر إكمال قراءة ${incompletePages} صفحة في DeepSeek؛ قد تكون بعض الصفحات ناقصة.`
  }

  onProgress({ stage: 'done', value: 1 })

  return {
    id: source.id,
    fileName: source.name,
    fileSize: source.size,
    fileFingerprint: fingerprint,
    pageCount: pages.length,
    cover,
    matches,
    matchedTopics,
    outputBlob,
    outputUrl: URL.createObjectURL(outputBlob),
    outputName: `${base} — مقتطف.pdf`,
    ocrPageCount: pages.length,
    citation,
    researchPages,
    usage: ocr.usage,
    thumbnailUrl,
    warning,
  }
}

export async function buildZip(results: SourceResult[]): Promise<Blob> {
  const zip = new JSZip()
  const used = new Set<string>()
  for (const result of results) {
    let name = result.outputName
    let counter = 2
    while (used.has(name)) {
      name = result.outputName.replace(/\.pdf$/i, ` (${counter}).pdf`)
      counter += 1
    }
    used.add(name)
    zip.file(name, result.outputBlob)
  }
  zip.file(
    'بيانات_المقتطفات.txt',
    [
      'مُقتطف — بيانات الملفات المستخرجة',
      '='.repeat(40),
      ...results.map((result) =>
        [
          `الملف: ${result.fileName}`,
          `العنوان: ${result.cover.title}`,
          `الباحثون: ${result.cover.authors || 'غير مذكور'}`,
          `السنة: ${result.cover.year || 'غير واضحة'}`,
          `عدد صفحات المصدر: ${result.pageCount}`,
          `الصفحات ذات الصلة: ${
            result.matches.length > 0
              ? result.matches.map((match) => match.pageNumber).join('، ')
              : 'لا توجد'
          }`,
          '',
        ].join('\n'),
      ),
    ].join('\n'),
  )
  return zip.generateAsync({ type: 'blob', compression: 'STORE' })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
