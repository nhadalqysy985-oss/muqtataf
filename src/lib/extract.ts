import { PDFDocument } from 'pdf-lib'
import JSZip from 'jszip'
import { loadPdf, renderThumbnail } from './pdf'
import { ocrWithDeepSeek } from './deepseek'
import type { UsageEvent } from './deepseek'
import { makeSnippet, normalizeArabic, scorePage } from './text'
import { cleanDisplay, normalizeDigits } from './text'
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
  /(?:^|\s)(?:من\s+|قام\s+ب)?(?:إعداد|اعداد|أعداد)\s*(?:الطالبتان|الطالبان|الباحثتان|الباحثان|الطالبات|الطالب(?:ة|\/ة)?|الطلبة|الباحث(?:ة|\/ة)?|الباحثين)?\s*[:\-–]?\s*(.*)$/u

const BOILERPLATE =
  /(جامعه|كليه|قسم|معهد|وزاره|الجمهوريه|رساله|اطروحه|ماجستير|دكتوراه|دبلوم|بكالوريوس|جزء من متطلبات|نيل شهاده|بسم الله|الرحمن|الرحيم)/

const DEGREE = /(ماجستير|دكتوراه|دبلوم|بكالوريوس)/

function pageLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => cleanDisplay(line))
    .filter((line) => line.length > 0)
}

function extractAuthors(lines: string[]): { authors: string; sourceLine: string } {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const match = line.match(AUTHOR_MARKER)
    if (match) {
      const inline = cleanDisplay(match[1] ?? '')
        .replace(/\s*(?:إشراف|اشراف|المشرف|لجنة المناقشة)\s*[:：].*$/u, '')
        .replace(/^[:\-–،.\s]+|[:\-–،.\s]+$/g, '')
        .trim()
      if (inline.length >= 3 && inline.length <= 100) {
        return { authors: inline, sourceLine: line }
      }
      const next = lines[index + 1]
      if (next && next.length >= 3 && next.length <= 100) {
        return { authors: next, sourceLine: next }
      }
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
  })
  return { authors: names.join(' و '), names, warnings }
}

function extractYearFromCover(lines: string[]): { year: string; line: string } {
  let academic: { year: number; line: string } | null = null
  let single: { year: number; line: string } | null = null

  for (const line of lines) {
    const normalized = normalizeDigits(line)
    const range = normalized.match(/(20\d{2})\s*[/\-]\s*(20\d{2})/)
    if (range) {
      const year = Math.max(Number(range[1]), Number(range[2]))
      if (!academic || year > academic.year) academic = { year, line }
      continue
    }
    const match = normalized.match(/(?<!\d)(19|20)\d{2}(?!\d)/)
    if (match && !single) single = { year: Number(match[0]), line }
  }

  if (academic) return { year: `${academic.year}م`, line: academic.line }
  if (single) return { year: `${single.year}م`, line: single.line }
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
    .filter((line) => !/^(?:doi|issn|https?)/i.test(line))
    .sort((a, b) => b.length - a.length)
  const title = titleCandidates[0] ?? fallback

  const normalizedAll = normalizeArabic(lines.join(' '))
  const yearInfo = extractYearFromCover(lines)
  const universityLine = lines.find((line) => /(جامعه|كليه|معهد)/.test(normalizeArabic(line)))
  const degree = DEGREE.exec(normalizedAll)?.[1]
  const authorInfo = extractAuthors(lines)
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
  onProgress({ stage: 'reading', value: 0.03 })

  const ocr = await ocrWithDeepSeek(source.file, apiKey, onProgress, onUsage)
  const pages = ocr.pages
  if (pages.length === 0) throw new Error('لم يعُد DeepSeek بأي صفحات نصية لهذا الملف.')

  onProgress({ stage: 'cover', value: 0.76 })
  const cover = extractCover(pages, source.name)

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
