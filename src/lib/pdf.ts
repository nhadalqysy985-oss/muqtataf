import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {
  arabicScore,
  cleanDisplay,
  normalizeArabic,
  normalizeDigits,
  visualToLogical,
} from './text'
import type { CoverInfo } from './types'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const assetBase = new URL('pdfjs/', document.baseURI).href

export interface CoverLine {
  text: string
  y: number
  size: number
}

export interface PageText {
  pageNumber: number
  width: number
  height: number
  rawText: string
  logicalText: string
  lines: string[]
  coverLines: CoverLine[]
}

export interface LoadedPdf {
  doc: PDFDocumentProxy
  bytes: Uint8Array
  pageCount: number
}

export async function loadPdf(bytes: Uint8Array): Promise<LoadedPdf> {
  const copy = new Uint8Array(bytes)
  const doc = await pdfjs.getDocument({
    data: copy,
    cMapUrl: `${assetBase}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${assetBase}standard_fonts/`,
    useSystemFonts: true,
  }).promise
  return { doc, bytes, pageCount: doc.numPages }
}

export async function readPageText(page: PDFPageProxy, pageNumber: number): Promise<PageText> {
  const viewport = page.getViewport({ scale: 1 })
  const textContent = await page.getTextContent()
  const rows: Array<{
    y: number
    items: Array<{ x: number; str: string; size: number; width: number; dir?: string }>
  }> = []

  for (const item of textContent.items) {
    if (!('str' in item)) continue
    const str = item.str
    if (!str) continue
    const transform = item.transform
    const y = transform[5]
    const x = transform[4]
    const size = Math.abs(item.height) || Math.hypot(transform[2], transform[3]) || 10
    let row = rows.find((entry) => Math.abs(entry.y - y) <= 2.4)
    if (!row) {
      row = { y, items: [] }
      rows.push(row)
    }
    row.items.push({
      x,
      str,
      size,
      width: Math.abs(item.width) || 0,
      dir: 'dir' in item ? item.dir : undefined,
    })
  }

  rows.sort((a, b) => b.y - a.y)
  const descLines: string[] = []
  const ascLines: string[] = []
  const coverLines: CoverLine[] = []

  for (const row of rows) {
    const desc = joinRowItems(row.items, 'desc')
    const asc = joinRowItems(row.items, 'asc')
    if (!desc.trim() && !asc.trim()) continue
    descLines.push(desc)
    ascLines.push(asc)
    coverLines.push({
      text: desc,
      y: row.y,
      size: Math.max(...row.items.map((item) => item.size), 8),
    })
  }

  const rawText = descLines.join('\n')
  const flippedLines = ascLines.map((line) => visualToLogical(line))
  const flippedText = flippedLines.join('\n')
  const rawScore = arabicScore(rawText)
  const flippedScore = arabicScore(flippedText)
  const reversed = flippedScore > rawScore + Math.max(1, rawScore * 0.15)

  const logicalLines = reversed
    ? ascLines.map((line, index) =>
        latinRatio(line) > 0.6 ? line : flippedLines[index],
      )
    : descLines
  const logicalText = logicalLines.join('\n')

  return {
    pageNumber,
    width: viewport.width,
    height: viewport.height,
    rawText,
    logicalText,
    lines: logicalLines,
    coverLines: coverLines.map((line, index) => ({ ...line, text: logicalLines[index] })),
  }
}

const COMBINING_MARKS = /^[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]+$/

function joinRowItems(
  items: Array<{ x: number; str: string; size: number; width: number }>,
  direction: 'asc' | 'desc',
): string {
  const sorted = [...items].sort((a, b) => (direction === 'asc' ? a.x - b.x : b.x - a.x))
  let output = ''
  let previousEdge: number | undefined

  for (const item of sorted) {
    const str = item.str
    if (!str) continue
    if (/^\s+$/.test(str)) {
      if (output && !output.endsWith(' ')) output += ' '
      previousEdge = direction === 'asc' ? item.x + item.width : item.x
      continue
    }
    if (COMBINING_MARKS.test(str)) {
      output += str
      continue
    }
    if (previousEdge !== undefined && output && !output.endsWith(' ')) {
      const gap =
        direction === 'asc' ? item.x - previousEdge : previousEdge - (item.x + item.width)
      const threshold = Math.max(1.6, item.size * 0.14)
      if (gap > threshold) output += ' '
    }
    output += str
    previousEdge = direction === 'asc' ? item.x + item.width : item.x
  }

  return cleanDisplay(output)
}

function latinRatio(text: string): number {
  const latin = (text.match(/[A-Za-z]/g) ?? []).length
  const arabic = (text.match(/[\u0621-\u064A]/g) ?? []).length
  if (latin + arabic === 0) return 0
  return latin / (latin + arabic)
}

const STOP_BLOCK =
  /(اشراف|المشرف|المشرفه|لجنه المناقشه|اعضاء اللجنه|رئيس اللجنه|عضو اللجنه|المناقش|تاريخ المناقشه)|^(?:جامعه|كليه|قسم|معهد|مركز)/

const DEGREE = /(ماجستير|دكتوراه|دبلوم|بكالوريوس)/

function isBoilerplateText(text: string): boolean {
  const normalized = normalizeArabic(text)
  if (
    /(رساله|اطروحه|ماجستير|دكتوراه|دبلوم|اعداد|اشراف|المشرف|المشرفه|لجنه|المناقش|بسم الله|الرحمن|الرحيم|شكر وتقدير|الاهداء|وزاره|الجمهوريه)/.test(
      normalized,
    )
  ) {
    return true
  }
  return /^(?:ال)?(?:جامعه|كليه|قسم|معهد|مركز|وزاره|الجمهوريه)/.test(normalized)
}

const AUTHOR_MARKER =
  /(?:^|\s)(?:من\s+|قام\s+ب)?(?:إعداد|اعداد|أعداد)\s*(?:الطالبات|الطالب(?:ة|\/ة)?|الطلبة|الباحث(?:ة|\/ة)?|الباحثين)?\s*[:\-–]?\s*(.*)$/u

const AUTHOR_LABEL = /^\s*(?:اسم\s+)?(?:الباحثة|الطالبة|الطالبات|الباحثين|الباحث|الطالب)\s*[:\-–]\s*(.+)$/u

function isLikelyName(text: string): boolean {
  const clean = cleanDisplay(text).replace(/^[:\-–،.\s]+|[:\-–،.\s]+$/g, '')
  if (!clean || clean.length < 3 || clean.length > 90) return false
  if (/\d/.test(clean)) return false
  if (isBoilerplateText(clean)) return false
  const words = clean.split(/\s+/)
  if (words.length > 8) return false
  return /[\u0621-\u064A]/.test(clean)
}

function cleanName(text: string): string {
  return cleanDisplay(text)
    .replace(/\s*(?:إشراف|اشراف|المشرف|المشرفة|لجنة المناقشة|أعضاء اللجنة)\s*[:：].*$/u, '')
    .replace(/^(?:الطالب|الطالبة|الباحث|الباحثة|الطلبة)\s*[:\-–]?\s*/u, '')
    .replace(/^ة\s*[:\-–]?\s*/u, '')
    .replace(/^[:\-–،.\s]+|[:\-–،.\s]+$/g, '')
    .trim()
}

function extractAuthors(
  lines: CoverLine[],
  metaAuthor: string | undefined,
  authorBlock: Set<number>,
): string {
  for (let index = 0; index < lines.length; index += 1) {
    const text = cleanDisplay(lines[index].text)
    const normalized = normalizeArabic(text)
    if (STOP_BLOCK.test(normalized) && !AUTHOR_MARKER.test(text)) continue

    let inline = ''
    const marker = text.match(AUTHOR_MARKER)
    if (marker) {
      inline = cleanName(marker[1] ?? '')
      authorBlock.add(index)
    } else {
      const label = text.match(AUTHOR_LABEL)
      if (label) {
        inline = cleanName(label[1] ?? '')
        authorBlock.add(index)
      }
    }
    if (!marker && !inline) continue

    if (inline && isLikelyName(inline)) {
      return inline.replace(/\s+/g, ' ')
    }

    const parts: string[] = []
    for (let next = index + 1; next < Math.min(index + 4, lines.length); next += 1) {
      const candidate = cleanDisplay(lines[next].text)
      const candidateNorm = normalizeArabic(candidate)
      if (STOP_BLOCK.test(candidateNorm)) break
      if (!isLikelyName(candidate)) break
      parts.push(cleanName(candidate))
      authorBlock.add(next)
      if (parts.join(' ').length > 80) break
    }
    if (parts.length > 0) return parts.join(' و ').replace(/\s+/g, ' ')
  }

  if (metaAuthor) {
    const clean = cleanDisplay(metaAuthor)
    if (
      clean.length >= 3 &&
      clean.length <= 90 &&
      !/^(user|administrator|admin|unknown|hp|microsoft|owner|pc)$/i.test(clean) &&
      /[\u0621-\u064A]/.test(clean)
    ) {
      return clean
    }
  }
  return ''
}

function isTitleCandidate(
  line: CoverLine,
  pageHeight: number,
  authorBlock: Set<number>,
  index: number,
): boolean {
  if (authorBlock.has(index)) return false
  if (line.size < 8 || line.text.length < 4) return false
  if (line.y < pageHeight * 0.1 || line.y > pageHeight * 0.9) return false
  if (isBoilerplateText(line.text)) return false
  if (STOP_BLOCK.test(normalizeArabic(line.text))) return false
  if (/(?:^|\s)(?:1[89]\d{2}|20\d{2})(?:\s|$)/.test(normalizeDigits(line.text))) return false
  return true
}

function extractTitle(
  lines: CoverLine[],
  pageHeight: number,
  authorBlock: Set<number>,
  metaTitle: string | undefined,
  filename: string,
): { title: string; source: CoverInfo['titleSource'] } {
  const candidates = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line, index }) => isTitleCandidate(line, pageHeight, authorBlock, index))

  if (candidates.length > 0) {
    let anchor = candidates[0]
    for (const candidate of candidates) {
      if (candidate.line.size > anchor.line.size + 0.4) {
        anchor = candidate
      } else if (
        Math.abs(candidate.line.size - anchor.line.size) <= 0.4 &&
        candidate.line.text.length > anchor.line.text.length
      ) {
        anchor = candidate
      }
    }

    const included: Array<{ line: CoverLine; index: number }> = [anchor]
    const maxGap = Math.max(anchor.line.size * 2.3, 46)
    let top = anchor.index - 1
    while (top >= 0) {
      const line = lines[top]
      const nearestY = included[0].line.y
      if (Math.abs(line.y - nearestY) > maxGap) break
      if (!isTitleCandidate(line, pageHeight, authorBlock, top)) break
      if (line.size < anchor.line.size * 0.58) break
      included.unshift({ line, index: top })
      top -= 1
    }
    let bottom = anchor.index + 1
    while (bottom < lines.length) {
      const line = lines[bottom]
      const nearestY = included[included.length - 1].line.y
      if (Math.abs(line.y - nearestY) > maxGap) break
      if (!isTitleCandidate(line, pageHeight, authorBlock, bottom)) break
      if (line.size < anchor.line.size * 0.58) break
      included.push({ line, index: bottom })
      bottom += 1
    }

    const title = included
      .map((entry) => cleanDisplay(entry.line.text))
      .join(' ')
      .replace(/\s+/g, ' ')
      .replace(/\s*[-–]\s*$/, '')
      .trim()
    if (title.length >= 6) return { title, source: 'cover' }
  }

  if (metaTitle) {
    const cleaned = cleanDisplay(metaTitle)
      .replace(/^microsoft\s+word\s*[-–:]\s*/i, '')
      .replace(/\.(docx?|pdf)$/i, '')
    if (cleaned.length >= 6 && !/^(untitled|document|بدون عنوان)$/i.test(cleaned)) {
      return { title: cleaned, source: 'metadata' }
    }
  }

  return {
    title: filename.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() || 'مصدر بدون عنوان',
    source: 'filename',
  }
}

function extractYear(
  lines: CoverLine[],
  pageHeight: number,
): { year: string; hijriYear?: string } {
  const gregorian: Array<{ value: number; score: number }> = []
  const hijri: Array<{ value: number; score: number }> = []

  for (const line of lines) {
    const text = normalizeDigits(cleanDisplay(line.text))
    const normalized = normalizeArabic(line.text)
    for (const match of text.matchAll(/(?<!\d)(\d{4})(?!\d)/g)) {
      const value = Number(match[1])
      let score = 0
      if (/(سنه|عام)/.test(normalized)) score += 5
      if (/(مناقشه|اجازه|جامعه)/.test(normalized)) score += 2
      if (line.y < pageHeight * 0.35) score += 2
      if (/(تاسيس|انشئ|انشأت|تأسست)/.test(normalized)) score -= 5
      if (value >= 1950 && value <= 2035) {
        gregorian.push({ value, score: score + 1 })
      } else if (value >= 1400 && value <= 1500) {
        hijri.push({ value, score })
      }
    }
  }

  const best = (list: Array<{ value: number; score: number }>) =>
    list.slice().sort((a, b) => b.score - a.score || b.value - a.value)[0]
  const g = best(gregorian)
  const h = best(hijri)
  return {
    year: g ? `${g.value}م` : h ? `${h.value}هـ` : '',
    hijriYear: g && h ? `${h.value}هـ` : undefined,
  }
}

function extractUniversity(lines: CoverLine[], pageHeight: number): string | undefined {
  const parts: string[] = []
  for (const line of lines) {
    const normalized = normalizeArabic(line.text)
    if (line.y < pageHeight * 0.55) continue
    if (/(جامعه|كليه|معهد)/.test(normalized) && line.text.length < 80) {
      const text = cleanDisplay(line.text)
      if (!parts.includes(text)) parts.push(text)
    }
  }
  return parts.slice(0, 2).join(' — ') || undefined
}

function extractDegree(lines: CoverLine[]): string | undefined {
  for (const line of lines) {
    const normalized = normalizeArabic(line.text)
    const match = normalized.match(DEGREE)
    if (match) return match[1]
  }
  return undefined
}

export async function extractCover(doc: PDFDocumentProxy, page: PageText, filename: string): Promise<CoverInfo> {
  const metadata = await doc.getMetadata().catch(() => null)
  const info = metadata?.info as { Title?: string; Author?: string; CreationDate?: string } | undefined
  const authorBlock = new Set<number>()
  const authors = extractAuthors(page.coverLines, info?.Author, authorBlock)
  const title = extractTitle(
    page.coverLines,
    page.height,
    authorBlock,
    info?.Title,
    filename,
  )
  const year = extractYear(page.coverLines, page.height)
  return {
    title: title.title,
    authors,
    year: year.year,
    hijriYear: year.hijriYear,
    university: extractUniversity(page.coverLines, page.height),
    degree: extractDegree(page.coverLines),
    coverReadable: page.rawText.replace(/\s/g, '').length > 20,
    titleSource: title.source,
  }
}

export async function renderThumbnail(page: PDFPageProxy, maxWidth = 240): Promise<string | undefined> {
  try {
    const base = page.getViewport({ scale: 1 })
    const scale = Math.min(1.2, maxWidth / base.width)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const context = canvas.getContext('2d')
    if (!context) return undefined
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: context, viewport, canvas } as Parameters<PDFPageProxy['render']>[0]).promise
    return canvas.toDataURL('image/jpeg', 0.82)
  } catch {
    return undefined
  }
}

export function lineRepeatKey(text: string): string {
  return normalizeArabic(text)
    .replace(/\b\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Running headers and footers repeat on most pages and can make every page
 * look relevant when the thesis title contains the searched topic. Repeated
 * edge lines are excluded from the relevance search.
 */
export function findRepeatedEdgeLines(pages: PageText[]): Set<string> {
  const counts = new Map<string, number>()
  for (const page of pages) {
    const seen = new Set<string>()
    for (const line of page.coverLines) {
      const isEdge = line.y > page.height * 0.78 || line.y < page.height * 0.22
      if (!isEdge) continue
      const key = lineRepeatKey(line.text)
      if (key.length < 4 || /^\d+$/.test(key) || seen.has(key)) continue
      seen.add(key)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  const threshold = Math.max(2, Math.ceil(pages.length * 0.3))
  const repeated = new Set<string>()
  for (const [key, count] of counts) {
    if (count >= threshold) repeated.add(key)
  }
  return repeated
}
