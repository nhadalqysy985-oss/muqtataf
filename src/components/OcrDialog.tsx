import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Download, FileText, Loader2, ScanText, X } from 'lucide-react'
import { ocrPdfToWord } from '../lib/ocr'
import type { OcrProgress } from '../lib/ocr'
import { downloadBlob } from '../lib/extract'
import { parseTopics } from '../lib/text'

interface OcrDialogProps {
  open: boolean
  onClose: () => void
}

interface OcrReady {
  blob: Blob
  name: string
  pdfBlob: Blob
  pdfName: string
  pageCount: number
  totalPages: number
  matchedPages: number[]
  topic: string
  text: string
  url: string
  pdfUrl: string
}

function parsePageRange(value: string): number[] | null {
  const input = value.trim()
  if (!input) return null
  const pages = new Set<number>()
  for (const part of input.split(/[،,;]+/)) {
    const piece = part.trim()
    if (!piece) continue
    const range = piece.match(/^(\d+)\s*[-–]\s*(\d+)$/)
    if (range) {
      const start = Number(range[1])
      const end = Number(range[2])
      for (let page = Math.min(start, end); page <= Math.max(start, end); page += 1) {
        pages.add(page)
      }
      continue
    }
    if (/^\d+$/.test(piece)) pages.add(Number(piece))
  }
  return pages.size > 0 ? [...pages].sort((a, b) => a - b) : null
}

export function OcrDialog({ open, onClose }: OcrDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [topicInput, setTopicInput] = useState('')
  const [rangeMode, setRangeMode] = useState<'all' | 'custom'>('all')
  const [rangeText, setRangeText] = useState('')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<OcrProgress | null>(null)
  const [error, setError] = useState('')
  const [ready, setReady] = useState<OcrReady | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelRef = useRef(false)
  const readyRef = useRef<OcrReady | null>(null)

  useEffect(() => {
    return () => {
      if (readyRef.current) {
        URL.revokeObjectURL(readyRef.current.url)
        URL.revokeObjectURL(readyRef.current.pdfUrl)
      }
    }
  }, [])

  if (!open) return null

  const setReadySafe = (value: OcrReady | null) => {
    if (readyRef.current) {
      URL.revokeObjectURL(readyRef.current.url)
      URL.revokeObjectURL(readyRef.current.pdfUrl)
    }
    readyRef.current = value
    setReady(value)
  }

  const close = () => {
    if (running) return
    setError('')
    onClose()
  }

  const cancel = () => {
    cancelRef.current = true
    setError('سيتم إيقاف OCR بعد انتهاء الصفحة الحالية…')
  }

  const start = async () => {
    if (!file) {
      setError('اختر ملف PDF أولًا.')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('حجم الملف يتجاوز 15 م.ب.')
      return
    }
    const customPages = rangeMode === 'custom' ? parsePageRange(rangeText) : null
    if (rangeMode === 'custom' && !customPages) {
      setError('اكتب نطاقًا صحيحًا، مثل: 1-3 أو 1،4،7.')
      return
    }

    setError('')
    setReadySafe(null)
    setRunning(true)
    cancelRef.current = false
    setProgress({ phase: 'loading', page: 0, total: customPages?.length ?? 0, percent: 1, label: 'بدء OCR…' })

    try {
      const result = await ocrPdfToWord(
        file,
        customPages,
        (update) => setProgress(update),
        () => cancelRef.current,
        parseTopics(topicInput),
      )
      const url = URL.createObjectURL(result.blob)
      const pdfUrl = URL.createObjectURL(result.pdfBlob)
      setReadySafe({ ...result, url, pdfUrl })
      setProgress({ phase: 'done', page: result.pageCount, total: result.pageCount, percent: 100, label: 'الملف جاهز' })
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : ''
      if (message === 'cancelled') {
        setError('تم إيقاف OCR.')
      } else {
        setError(
          message && /[\u0621-\u064A]/.test(message)
            ? message
            : 'تعذّر تشغيل OCR. تأكد من اتصال الإنترنت عند أول استخدام (لتحميل نموذج اللغة)، ثم أعد المحاولة.',
        )
      }
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={close}>
      <div className="ocr-modal" role="dialog" aria-modal="true" aria-labelledby="ocr-title" onClick={(event) => event.stopPropagation()}>
        <div className="ocr-head">
          <span className="ocr-icon">
            <ScanText size={21} />
          </span>
          <div>
            <h2 id="ocr-title">تحويل Word بالتعرف الضوئي (OCR)</h2>
            <p>للملفات التي يظهر نصها مقلوبًا أو بحروف ناقصة أو ترميز خط تالف.</p>
          </div>
          <button type="button" className="icon-button" onClick={close} disabled={running} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        <div className="ocr-body">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="visually-hidden"
            onChange={(event) => {
              const selected = event.target.files?.[0] ?? null
              setFile(selected)
              setReadySafe(null)
              setError('')
              event.target.value = ''
            }}
          />
          <button type="button" className="ocr-file" onClick={() => inputRef.current?.click()} disabled={running}>
            <FileText size={18} />
            <span dir="auto">{file ? file.name : 'اختر ملف PDF واحدًا'}</span>
            <em>{file ? `${(file.size / (1024 * 1024)).toFixed(1)} م.ب` : 'حتى 15 م.ب'}</em>
          </button>

          <div className="ocr-topic-field">
            <label className="field-label" htmlFor="ocr-topic">
              الموضوع المطلوب <span>(اختياري)</span>
            </label>
            <input
              id="ocr-topic"
              type="text"
              className="ocr-range-input ocr-topic-input"
              placeholder="مثال: تقدير الذات"
              value={topicInput}
              onChange={(event) => setTopicInput(event.target.value)}
              disabled={running}
            />
            <p>إذا كتبت موضوعًا، تُطابق الصفحات بعد OCR ويُصدَّر المطابق فقط.</p>
          </div>

          <div className="ocr-range">
            <span className="field-label">الصفحات</span>
            <div className="segmented segmented-mini" role="group" aria-label="نطاق صفحات OCR">
              <button
                type="button"
                className={rangeMode === 'all' ? 'is-active' : ''}
                onClick={() => setRangeMode('all')}
                disabled={running}
              >
                كل الصفحات
              </button>
              <button
                type="button"
                className={rangeMode === 'custom' ? 'is-active' : ''}
                onClick={() => setRangeMode('custom')}
                disabled={running}
              >
                صفحات محددة
              </button>
            </div>
            {rangeMode === 'custom' && (
              <input
                type="text"
                dir="ltr"
                className="ocr-range-input"
                placeholder="1-3, 5, 8"
                value={rangeText}
                onChange={(event) => setRangeText(event.target.value)}
                disabled={running}
              />
            )}
          </div>

          <div className="ocr-note">
            <AlertTriangle size={15} />
            <p>
              OCR تجريبي ويعمل داخل المتصفح. قد يستغرق عدة دقائق في أول استخدام لتحميل نموذج
              اللغة العربية، ثم يصبح أسرع. الصفحات ذات العمودين قد تتداخل، راجع النص قبل الاعتماد
              عليه.
            </p>
          </div>

          {progress && (
            <div className="ocr-progress" aria-live="polite">
              <div className="ocr-progress-top">
                <span>{progress.label}</span>
                <strong>{Math.round(progress.percent)}%</strong>
              </div>
              <div className="progress-track">
                <span style={{ width: `${Math.max(2, progress.percent)}%` }} />
              </div>
              {progress.total > 0 && (
                <span className="ocr-progress-count">
                  الصفحة {Math.min(progress.page || 1, progress.total)} من {progress.total}
                </span>
              )}
            </div>
          )}

          {error && (
            <div className="ocr-error">
              <AlertTriangle size={15} />
              <span>{error}</span>
            </div>
          )}

          {ready && (
            <div className="ocr-result">
              <div>
                <strong>
                  تم إنشاء PDF وWord من {ready.pageCount} صفحة
                  {ready.topic ? ` · ${ready.totalPages} صفحة تم OCRها` : ''}
                </strong>
                <span>
                  {ready.topic
                    ? `الموضوع: ${ready.topic} — الصفحات المطابقة: ${ready.matchedPages.join('، ')}`
                    : 'راجع النص المستخرج قبل الاستخدام.'}
                </span>
              </div>
              <button
                type="button"
                className="button button-primary button-small"
                onClick={() => downloadBlob(ready.pdfBlob, ready.pdfName)}
              >
                <Download size={16} />
                تنزيل PDF
              </button>
              <button
                type="button"
                className="button button-word button-small"
                onClick={() => downloadBlob(ready.blob, ready.name)}
              >
                <Download size={16} />
                تنزيل Word
              </button>
              <pre className="ocr-preview" dir="auto">{ready.text.slice(0, 1200)}</pre>
            </div>
          )}
        </div>

        <div className="ocr-actions">
          {running ? (
            <button type="button" className="button button-ghost" onClick={cancel}>
              إيقاف
            </button>
          ) : (
            <button type="button" className="button button-ghost" onClick={close}>
              إغلاق
            </button>
          )}
          <button type="button" className="button button-primary" onClick={start} disabled={running || !file}>
            {running ? <Loader2 size={17} className="spin" /> : <ScanText size={17} />}
            {running ? 'جارٍ OCR…' : 'إنشاء Word عبر OCR'}
          </button>
        </div>
      </div>
    </div>
  )
}
