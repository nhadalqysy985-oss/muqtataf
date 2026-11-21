import { PDFDocument } from 'pdf-lib'
import JSZip from 'jszip'
import {
  extractCover,
  findRepeatedEdgeLines,
  lineRepeatKey,
  loadPdf,
  readPageText,
  renderThumbnail,
} from './pdf'
import type { PageText } from './pdf'
import { makeSnippet, normalizeArabic, scorePage } from './text'
import type {
  FileProgress,
  PageMatch,
  Sensitivity,
  SourceFile,
  SourceResult,
  Topic,
} from './types'

const sleep = (ms = 0) => new Promise<void>((resolve) => setTimeout(resolve, ms))

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
  sensitivity: Sensitivity,
  onProgress: (progress: FileProgress) => void,
): Promise<SourceResult> {
  const bytes = new Uint8Array(await source.file.arrayBuffer())
  const loaded = await loadPdf(bytes)
  const { doc, pageCount } = loaded
  if (pageCount < 1) throw new Error('الملف لا يحتوي على صفحات.')

  onProgress({ stage: 'reading', value: 0.04 })

  let coverPageText: PageText
  let thumbnailUrl: string | undefined
  const matches: PageMatch[] = []
  let pagesWithoutText = 0
  let textPages = 0

  try {
    const firstPage = await doc.getPage(1)
    coverPageText = await readPageText(firstPage, 1)
    thumbnailUrl = await renderThumbnail(firstPage, 250)
    if (coverPageText.rawText.replace(/\s/g, '').length < 5) pagesWithoutText += 1
    else textPages += 1

    onProgress({ stage: 'cover', value: 0.16 })

    const cover = await extractCover(doc, coverPageText, source.name)
    const pageTexts: PageText[] = [coverPageText]

    for (let pageNumber = 2; pageNumber <= pageCount; pageNumber += 1) {
      const page = await doc.getPage(pageNumber)
      const pageText = await readPageText(page, pageNumber)
      page.cleanup()
      pageTexts.push(pageText)
      if (pageText.rawText.replace(/\s/g, '').length < 5) pagesWithoutText += 1
      else textPages += 1

      onProgress({
        stage: 'searching',
        value: 0.2 + 0.58 * (pageNumber / pageCount),
      })
      if (pageNumber % 3 === 0) await sleep(0)
    }

    const repeatedEdgeLines = findRepeatedEdgeLines(pageTexts)

    for (let index = 1; index < pageTexts.length; index += 1) {
      const pageText = pageTexts[index]
      const keptLines = pageText.coverLines.filter(
        (line) => !repeatedEdgeLines.has(lineRepeatKey(line.text)),
      )
      const searchableText = keptLines.map((line) => line.text).join('\n')
      const scored = scorePage([normalizeArabic(searchableText)], topics, sensitivity)
      if (scored.matched.length > 0) {
        const matchedTerms = scored.matched.flatMap((match) => {
          const topic = topics.find((entry) => entry.display === match.topic)
          return topic ? topic.termVariants : []
        })
        matches.push({
          pageNumber: pageText.pageNumber,
          score: scored.score,
          topics: scored.matched.map((match) => match.topic),
          snippet: makeSnippet(
            keptLines.map((line) => line.text),
            matchedTerms,
          ),
        })
      }

      if (index % 6 === 0) {
        onProgress({
          stage: 'searching',
          value: 0.8 + 0.06 * (index / pageTexts.length),
        })
        await sleep(0)
      }
    }

    onProgress({ stage: 'building', value: 0.88 })

    const output = await PDFDocument.create()
    const sourceDoc = await PDFDocument.load(bytes, { ignoreEncryption: true })
    const pageIndexes = [0, ...matches.map((match) => match.pageNumber - 1)]
    const copied = await output.copyPages(sourceDoc, pageIndexes)
    for (const page of copied) output.addPage(page)

    output.setTitle(`${cover.title} — مقتطف`)
    if (cover.authors) output.setAuthor(cover.authors)
    output.setSubject(
      `مقتطف من: ${source.name} — الموضوع: ${topics.map((topic) => topic.display).join('، ')}`,
    )
    output.setKeywords(topics.map((topic) => topic.display))
    output.setCreator('مُقتطف — أداة استخراج أكاديمية')
    output.setProducer('مُقتطف')
    const outputBytes = await output.save()
    const outputBlob = new Blob([outputBytes as BlobPart], { type: 'application/pdf' })

    const base = sanitizeFilename(source.name.replace(/\.pdf$/i, '')) || 'مصدر'
    const matchedTopics = [...new Set(matches.flatMap((match) => match.topics))]

    let warning: string | undefined
    if (textPages === 0) {
      warning = 'هذا الملف يبدو ممسوحًا ضوئيًا ولا يحتوي على نص قابل للبحث؛ أُرفق الغلاف فقط. يمكن البحث يدويًا في صفحاته.'
    } else if (!cover.coverReadable) {
      warning = 'تعذّرت قراءة بيانات الغلاف؛ قد تكون الصفحة الأولى صورة ممسوحة. تم تضمين الغلاف كما هو.'
    } else if (pagesWithoutText > 0) {
      warning = `عدد الصفحات بدون طبقة نص (صور ممسوحة) ولم يُبحث داخلها: ${pagesWithoutText}.`
    }

    if (matches.length === 0 && textPages > 0) {
      warning = warning
        ? `${warning} لم تُعثر صفحات مطابقة في النص المتاح.`
        : 'لم تُعثر صفحات مطابقة للموضوع؛ الملف الناتج يضم الغلاف فقط.'
    }

    onProgress({ stage: 'done', value: 1 })

    return {
      id: source.id,
      fileName: source.name,
      fileSize: source.size,
      pageCount,
      cover,
      matches,
      matchedTopics,
      outputBlob,
      outputUrl: URL.createObjectURL(outputBlob),
      outputName: `${base} — مقتطف.pdf`,
      thumbnailUrl,
      warning,
    }
  } finally {
    await doc.destroy().catch(() => undefined)
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
