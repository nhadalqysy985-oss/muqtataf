import type { PDFDocumentProxy } from 'pdfjs-dist'
import { loadPdf } from './pdf'
import type { PageText } from './pdf'
import type { CoverInfo } from './types'
import { cleanDisplay, normalizeDigits } from './text'
import { buildWordDocument } from './word'

export interface OcrProgress {
  phase: 'loading' | 'ocr' | 'word' | 'done'
  page: number
  total: number
  percent: number
  label: string
}

export interface OcrResult {
  blob: Blob
  name: string
  pageCount: number
  text: string
}

interface OcrWorker {
  recognize(image: HTMLCanvasElement): Promise<{ data: { text: string } }>
  terminate(): Promise<unknown>
}

function pageLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => cleanDisplay(line))
    .filter((line) => line.length > 0)
}

function firstPageTitle(lines: string[], fallback: string): string {
  const candidates = lines
    .slice(0, 12)
    .filter((line) => line.length >= 12 && line.length <= 160)
    .filter((line) => !/^(?:مجلة|المجلد|العدد|doi|issn|https?)/i.test(line))
    .sort((a, b) => b.length - a.length)
  return candidates[0] ?? fallback
}

function firstPageYear(lines: string[]): string {
  for (const line of lines.slice(0, 25)) {
    const normalized = normalizeDigits(cleanDisplay(line))
    const match = normalized.match(/(?<!\d)(19|20)\d{2}(?!\d)/)
    if (match) return `${match[0]}م`
  }
  return ''
}

function makePageText(
  pageNumber: number,
  width: number,
  height: number,
  text: string,
): PageText {
  const lines = pageLines(text)
  const lineHeight = 28
  const coverLines = lines.map((line, index) => ({
    text: line,
    y: height - (index + 1) * lineHeight,
    size: 12,
    x: 20,
    width: Math.max(1, width - 40),
    column: 0,
  }))
  return {
    pageNumber,
    width,
    height,
    rawText: lines.join('\n'),
    logicalText: lines.join('\n'),
    lines,
    coverLines,
  }
}

async function renderPageToCanvas(
  doc: PDFDocumentProxy,
  pageNumber: number,
  scale = 2,
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('تعذّر تهيئة الرسم في المتصفح.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: context, viewport, canvas } as Parameters<typeof page.render>[0]).promise
  page.cleanup()
  return { canvas, width: viewport.width / scale, height: viewport.height / scale }
}

export async function ocrPdfToWord(
  file: File,
  pageNumbers: number[] | null,
  onProgress: (progress: OcrProgress) => void,
  isCancelled: () => boolean = () => false,
): Promise<OcrResult> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const loaded = await loadPdf(bytes)
  const { doc } = loaded
  const selected = pageNumbers
    ? pageNumbers.filter((n) => n >= 1 && n <= doc.numPages)
    : Array.from({ length: doc.numPages }, (_, i) => i + 1)
  const total = selected.length

  onProgress({
    phase: 'loading',
    page: 0,
    total,
    percent: 2,
    label: 'تحميل محرك OCR ونموذج اللغة…',
  })

  let worker: OcrWorker | undefined
  let currentPageIndex = 0
  try {
    const { createWorker } = await import('tesseract.js')
    worker = (await createWorker('ara', 1, {
      logger: (message) => {
        if (message.status === 'recognizing text') {
          onProgress({
            phase: 'ocr',
            page: currentPageIndex + 1,
            total,
            percent:
              8 +
              ((currentPageIndex + (message.progress ?? 0)) / Math.max(1, total)) * 82,
            label: 'التعرّف على النص العربي…',
          })
        }
      },
    })) as unknown as OcrWorker

    const pages: PageText[] = []
    for (let index = 0; index < selected.length; index += 1) {
      if (isCancelled()) throw new Error('cancelled')
      currentPageIndex = index
      const pageNumber = selected[index]
      const progressBase = 8 + (index / Math.max(1, total)) * 82
      onProgress({
        phase: 'ocr',
        page: index + 1,
        total,
        percent: progressBase,
        label: `قراءة الصفحة ${pageNumber} بالتعرف الضوئي…`,
      })

      const { canvas, width, height } = await renderPageToCanvas(doc, pageNumber)
      const result = await worker.recognize(canvas)
      pages.push(makePageText(pageNumber, width, height, result.data.text))
      canvas.width = 0
      canvas.height = 0

      onProgress({
        phase: 'ocr',
        page: index + 1,
        total,
        percent: 8 + ((index + 1) / Math.max(1, total)) * 82,
        label: `اكتملت الصفحة ${pageNumber}`,
      })
    }

    if (isCancelled()) throw new Error('cancelled')

    onProgress({
      phase: 'word',
      page: total,
      total,
      percent: 94,
      label: 'إنشاء ملف Word…',
    })

    const base = file.name.replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|]/g, ' ').trim() || 'مستند'
    const firstPage = pages.find((page) => page.pageNumber === 1) ?? pages[0]
    const firstLines = firstPage?.lines ?? []
    const cover: CoverInfo = {
      title: firstPageTitle(firstLines, base),
      authors: '',
      year: firstPageYear(firstLines),
      coverReadable: firstLines.length > 0,
      titleSource: 'filename',
    }

    const blob = await buildWordDocument({
      fileName: file.name,
      cover,
      pages,
      pageNumbers: pages.map((page) => page.pageNumber),
      repeatedEdgeLines: new Set(),
      topicLabels: ['نسخة OCR'],
      filterRepeatedTitle: false,
    })
    const name = `${base} — OCR.docx`
    onProgress({ phase: 'done', page: total, total, percent: 100, label: 'الملف جاهز' })
    return {
      blob,
      name,
      pageCount: pages.length,
      text: pages.map((page) => page.logicalText).join('\n\n'),
    }
  } finally {
    await worker?.terminate().catch(() => undefined)
    await doc.destroy().catch(() => undefined)
  }
}
