import { PDFDocument } from 'pdf-lib'
import JSZip from 'jszip'
import { loadPdf, renderThumbnail } from './pdf'
import { ocrWithDeepSeek } from './deepseek'
import type { UsageEvent } from './deepseek'
import { makeSnippet, normalizeArabic, scorePage } from './text'
import { cleanDisplay, normalizeDigits } from './text'
import type {
  CoverInfo,
  FileProgress,
  PageMatch,
  Sensitivity,
  SourceFile,
  SourceResult,
  Topic,
} from './types'

const AUTHOR_MARKER =
  /(?:^|\s)(?:من\s+|قام\s+ب)?(?:إعداد|اعداد|أعداد)\s*(?:الطالبات|الطالب(?:ة|\/ة)?|الطلبة|الباحث(?:ة|\/ة)?|الباحثين)?\s*[:\-–]?\s*(.*)$/u

const BOILERPLATE =
  /(جامعه|كليه|قسم|معهد|وزاره|الجمهوريه|رساله|اطروحه|ماجستير|دكتوراه|دبلوم|بكالوريوس|جزء من متطلبات|نيل شهاده|بسم الله|الرحمن|الرحيم)/

const DEGREE = /(ماجستير|دكتوراه|دبلوم|بكالوريوس)/

function pageLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => cleanDisplay(line))
    .filter((line) => line.length > 0)
}

function extractAuthors(lines: string[]): string {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const match = line.match(AUTHOR_MARKER)
    if (match) {
      const inline = cleanDisplay(match[1] ?? '')
        .replace(/\s*(?:إشراف|اشراف|المشرف|لجنة المناقشة)\s*[:：].*$/u, '')
        .replace(/^[:\-–،.\s]+|[:\-–،.\s]+$/g, '')
        .trim()
      if (inline.length >= 3 && inline.length <= 100) return inline
      const next = lines[index + 1]
      if (next && next.length >= 3 && next.length <= 100) return next
    }
  }
  return ''
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
  const yearMatch = normalizeDigits(lines.join(' ')).match(/(?<!\d)(19|20)\d{2}(?!\d)/)
  const universityLine = lines.find((line) => /(جامعه|كليه|معهد)/.test(normalizeArabic(line)))
  const degree = DEGREE.exec(normalizedAll)?.[1]

  return {
    title,
    authors: extractAuthors(lines),
    year: yearMatch ? `${yearMatch[0]}م` : '',
    university: universityLine,
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
