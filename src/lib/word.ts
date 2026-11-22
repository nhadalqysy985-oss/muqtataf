import {
  AlignmentType,
  Document,
  Footer,
  Packer,
  Paragraph,
  SectionType,
  TextRun,
} from 'docx'
import type { ISectionOptions } from 'docx'
import type { PageText } from './pdf'
import { lineRepeatKey } from './pdf'
import type { CoverInfo } from './types'
import { cleanDisplay, normalizeArabic, normalizeDigits } from './text'

export interface WordBuildInput {
  fileName: string
  cover: CoverInfo
  pages: PageText[]
  pageNumbers: number[]
  repeatedEdgeLines: Set<string>
  topicLabels: string[]
  filterRepeatedTitle?: boolean
}

interface TextLine {
  text: string
  y: number
  size: number
  x: number
  width: number
  column: number
}

interface WordParagraph {
  text: string
  size: number
  bold: boolean
  alignment: (typeof AlignmentType)[keyof typeof AlignmentType]
  before: number
}

function median(values: number[]): number {
  if (values.length === 0) return 11
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 11
}

function isMostlyLatin(text: string): boolean {
  const latin = (text.match(/[A-Za-z]/g) ?? []).length
  const arabic = (text.match(/[\u0621-\u064A]/g) ?? []).length
  return latin > 0 && latin > arabic
}

function detectPrintedPageNumber(
  lines: TextLine[],
  pageHeight: number,
): { label?: string; remove: Set<number> } {
  const remove = new Set<number>()
  const candidates: Array<{ label: string; index: number; bottom: boolean }> = []

  lines.forEach((line, index) => {
    const isEdge = line.y < pageHeight * 0.13 || line.y > pageHeight * 0.9
    if (!isEdge) return
    const plain = normalizeDigits(cleanDisplay(line.text))
    const match = plain.match(
      /^(?:[-–—:.]*\s*)?(?:صفحة|صفحه|page)?\s*([0-9]{1,4})\s*(?:[-–—:.]*)$/i,
    )
    if (!match) return
    const value = Number(match[1])
    if (value >= 1900 && value <= 2100) return
    candidates.push({
      label: match[1],
      index,
      bottom: line.y < pageHeight * 0.2,
    })
  })

  if (candidates.length === 0) return { remove }
  const chosen = candidates.find((candidate) => candidate.bottom) ?? candidates[0]
  remove.add(chosen.index)
  return { label: chosen.label, remove }
}

function lineAlignment(
  line: TextLine,
  pageWidth: number,
): (typeof AlignmentType)[keyof typeof AlignmentType] {
  if (isMostlyLatin(line.text)) return AlignmentType.LEFT
  const center = line.x + line.width / 2
  if (
    line.width < pageWidth * 0.55 &&
    Math.abs(center - pageWidth / 2) < pageWidth * 0.05
  ) {
    return AlignmentType.CENTER
  }
  return AlignmentType.RIGHT
}

function buildBodyParagraphs(
  lines: TextLine[],
  pageWidth: number,
  isCover: boolean,
): WordParagraph[] {
  if (lines.length === 0) return []

  const bodySizes = lines.filter((line) => line.size < 30).map((line) => line.size)
  const pageMedian = median(bodySizes.length > 0 ? bodySizes : lines.map((line) => line.size))
  const paragraphs: WordParagraph[] = []

  if (isCover) {
    for (const line of lines) {
      const bold =
        line.size >= pageMedian * 1.18 ||
        line.size >= Math.max(...lines.map((entry) => entry.size)) - 0.2
      paragraphs.push({
        text: line.text,
        size: line.size,
        bold,
        alignment: AlignmentType.CENTER,
        before: 80,
      })
    }
    return paragraphs
  }

  let current: WordParagraph | null = null
  let previous: TextLine | null = null

  for (const line of lines) {
    const heading = line.size >= pageMedian * 1.24
    const alignment = lineAlignment(line, pageWidth)
    const gap = previous ? previous.y - line.y : 0
    const canMerge =
      current !== null &&
      !heading &&
      !current.bold &&
      Math.abs(current.size - line.size) <= 1.4 &&
      gap <= Math.max(18, line.size * 1.55) &&
      previous?.column === line.column &&
      Math.abs(line.x - (previous?.x ?? line.x)) < 14 &&
      current.alignment !== AlignmentType.CENTER

    if (canMerge && current) {
      current.text = `${current.text} ${line.text}`.replace(/\s+/g, ' ').trim()
      current.size = Math.max(current.size, line.size)
    } else {
      if (current) paragraphs.push(current)
      current = {
        text: line.text,
        size: line.size,
        bold: heading,
        alignment,
        before: heading ? 220 : paragraphGap(previous, line),
      }
    }
    previous = line
  }

  if (current) paragraphs.push(current)
  return paragraphs
}

function paragraphGap(previous: TextLine | null, line: TextLine): number {
  if (!previous || previous.column !== line.column) return 0
  const gap = previous.y - line.y - line.size * 1.15
  if (gap <= 2) return 70
  return Math.min(900, Math.round(gap * 12))
}

function toParagraph(paragraph: WordParagraph): Paragraph {
  return new Paragraph({
    alignment: paragraph.alignment,
    bidirectional: true,
    spacing: {
      before: paragraph.before,
      after: 100,
      line: 340,
    },
    children: [
      new TextRun({
        text: paragraph.text,
        rightToLeft: true,
        font: 'Arial',
        size: Math.max(16, Math.min(60, Math.round(paragraph.size * 2))),
        bold: paragraph.bold,
      }),
    ],
  })
}

export async function buildWordDocument(input: WordBuildInput): Promise<Blob> {
  const selected = input.pageNumbers
    .map((pageNumber) => input.pages.find((page) => page.pageNumber === pageNumber))
    .filter((page): page is PageText => Boolean(page))
    .sort((a, b) => a.pageNumber - b.pageNumber)

  const sections: ISectionOptions[] = selected.map((page, index) => {
    const pageNumber = detectPrintedPageNumber(page.coverLines, page.height)
    const titleKey = normalizeArabic(input.cover.title)
    const isCoverPage = page.pageNumber === 1 && page.coverLines.length <= 22
    const lines = page.coverLines
      .filter((line, lineIndex) => {
        if (pageNumber.remove.has(lineIndex)) return false
        if (!isCoverPage && line.y < page.height * 0.05) return false
        if (
          !isCoverPage &&
          line.y > page.height * 0.88 &&
          line.text.replace(/\s/g, '').length <= 2
        ) {
          return false
        }
        const key = lineRepeatKey(line.text)
        if (input.repeatedEdgeLines.has(key)) return false
        const isEdge = line.y > page.height * 0.78 || line.y < page.height * 0.22
        if (
          input.filterRepeatedTitle !== false &&
          isEdge &&
          titleKey.length > 10 &&
          key.includes(titleKey)
        ) {
          return false
        }
        return true
      })
      .map((line) => ({ ...line }))

    const paragraphs = buildBodyParagraphs(lines, page.width, isCoverPage)
    const children =
      paragraphs.length > 0
        ? paragraphs.map(toParagraph)
        : [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              bidirectional: true,
              spacing: { before: 1200, after: 300 },
              children: [
                new TextRun({
                  text: 'لا يوجد نص قابل للاستخراج في هذه الصفحة.',
                  rightToLeft: true,
                  font: 'Arial',
                  size: 22,
                  color: '7A7A7A',
                }),
              ],
            }),
          ]

    const label = pageNumber.label ?? String(page.pageNumber)
    const footer = new Footer({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0 },
          children: [
            new TextRun({
              text: `الصفحة ${label}`,
              font: 'Arial',
              size: 16,
              color: '808080',
            }),
          ],
        }),
      ],
    })

    return {
      properties: {
        ...(index > 0 ? { type: SectionType.NEXT_PAGE } : {}),
        page: {
          size: {
            width: Math.round(page.width * 20),
            height: Math.round(page.height * 20),
          },
          margin: {
            top: 1080,
            bottom: 1080,
            left: 1080,
            right: 1080,
            header: 540,
            footer: 540,
          },
        },
      },
      footers: { default: footer },
      children,
    }
  })

  if (sections.length === 0) {
    sections.push({
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
        },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'لا توجد صفحات للتصدير.' })],
        }),
      ],
    })
  }

  const doc = new Document({
    creator: 'مُقتطف',
    title: `${input.cover.title} — نص`,
    subject: input.topicLabels.length
      ? `الموضوع: ${input.topicLabels.join('، ')}`
      : 'نص الصفحات المستخرجة',
    description: `نص مستخرج من ${input.fileName}`,
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 22 },
          paragraph: { spacing: { line: 340 } },
        },
      },
    },
    sections,
  })

  return Packer.toBlob(doc)
}
