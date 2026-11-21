import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Download,
  FileSearch,
  FileStack,
  Files,
  Info,
  Loader2,
  Lock,
  Package,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { FileDropzone } from './components/FileDropzone'
import { ResultCard } from './components/ResultCard'
import { buildZip, downloadBlob, extractSource } from './lib/extract'
import { extractsPhrase, pagesPhrase } from './lib/format'
import { parseTopics } from './lib/text'
import type {
  FileFailure,
  FileProgress,
  ProcessingStage,
  Sensitivity,
  SourceFile,
  SourceResult,
} from './lib/types'
import { STAGE_LABELS } from './lib/types'

const MAX_FILES = 8
const MAX_SIZE = 15 * 1024 * 1024
const EXAMPLES = ['مفهوم القيادة التحويلية', 'الرضا الوظيفي', 'الالتزام التنظيمي', 'جودة الخدمة']

interface RunProgress {
  fileIndex: number
  fileCount: number
  fileName: string
  stage: ProcessingStage
  fileValue: number
  overall: number
}

interface ToastState {
  message: string
  tone: 'error' | 'warning' | 'success'
}

const STAGE_ORDER: ProcessingStage[] = ['reading', 'cover', 'searching', 'building']

function friendlyError(error: unknown): string {
  const name = (error as { name?: string } | null)?.name ?? ''
  const message = error instanceof Error ? error.message : ''
  if (/password/i.test(name) || /password|encrypted/i.test(message)) {
    return 'الملف محمي بكلمة مرور ولا يمكن فتحه. أزل الحماية ثم أعد المحاولة.'
  }
  if (/InvalidPDF/i.test(name) || /invalid pdf|structure|xref/i.test(message)) {
    return 'تعذّر قراءة الملف؛ قد يكون تالفًا أو ليس ملف PDF صالحًا.'
  }
  if (/worker|network|fetch/i.test(message)) {
    return 'تعذّر تشغيل محرّك قراءة PDF. أعد تحميل الصفحة ثم جرّب مجددًا.'
  }
  if (message && /[\u0621-\u064A]/.test(message)) return message
  return 'تعذّرت معالجة هذا الملف. تأكد من سلامته ثم أعد المحاولة.'
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 40 40" fill="none">
        <rect x="8" y="6" width="22" height="28" rx="4" fill="currentColor" opacity="0.14" />
        <rect x="12" y="4" width="22" height="28" rx="4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M17 12h12M17 17h12M17 22h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M29 25l1.4 3.1L33.5 29.5l-3.1 1.4L29 34l-1.4-3.1L24.5 29.5l3.1-1.4L29 25z" fill="#c08a3e" />
      </svg>
    </span>
  )
}

function StepHeader({ number, title, subtitle }: { number: string; title: string; subtitle: string }) {
  return (
    <div className="step-head">
      <span className="step-number">{number}</span>
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
    </div>
  )
}

function App() {
  const [files, setFiles] = useState<SourceFile[]>([])
  const [topicInput, setTopicInput] = useState('')
  const [sensitivity, setSensitivity] = useState<Sensitivity>('balanced')
  const [phase, setPhase] = useState<'idle' | 'processing' | 'done'>('idle')
  const [results, setResults] = useState<SourceResult[]>([])
  const [failures, setFailures] = useState<FileFailure[]>([])
  const [progress, setProgress] = useState<RunProgress | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [zipping, setZipping] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const resultsRef = useRef<SourceResult[]>([])
  const cancelRef = useRef(false)
  const resultsSectionRef = useRef<HTMLElement>(null)

  const setResultsSafe = (updater: (current: SourceResult[]) => SourceResult[]) => {
    setResults((current) => {
      const next = updater(current)
      resultsRef.current = next
      return next
    })
  }

  const showToast = (message: string, tone: ToastState['tone'] = 'error') => {
    setToast({ message, tone })
  }

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 6500)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    return () => {
      for (const result of resultsRef.current) URL.revokeObjectURL(result.outputUrl)
    }
  }, [])

  const revokeResults = (items: SourceResult[]) => {
    for (const result of items) URL.revokeObjectURL(result.outputUrl)
  }

  const clearResults = () => {
    revokeResults(resultsRef.current)
    resultsRef.current = []
    setResults([])
    setFailures([])
    setProgress(null)
    setPhase('idle')
  }

  const addFiles = (incoming: File[]) => {
    if (phase === 'processing' || incoming.length === 0) return

    const existing = new Set(
      files.map((entry) => `${entry.name}-${entry.size}-${entry.file.lastModified}`),
    )
    const accepted: SourceFile[] = []
    let tooLarge = 0
    let wrongType = 0
    let duplicate = 0
    let overflow = false

    for (const file of incoming) {
      if (files.length + accepted.length >= MAX_FILES) {
        overflow = true
        break
      }
      if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
        wrongType += 1
        continue
      }
      if (file.size === 0) {
        wrongType += 1
        continue
      }
      if (file.size > MAX_SIZE) {
        tooLarge += 1
        continue
      }
      const key = `${file.name}-${file.size}-${file.lastModified}`
      if (existing.has(key)) {
        duplicate += 1
        continue
      }
      existing.add(key)
      accepted.push({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        size: file.size,
      })
    }

    if (accepted.length > 0) {
      if (phase === 'done') clearResults()
      setFiles((current) => [...current, ...accepted])
    }

    const messages: string[] = []
    if (overflow) messages.push(`الحد الأقصى ${MAX_FILES} ملفات؛ تمت إضافة ما يتسع له الحد.`)
    if (tooLarge > 0) messages.push(`${tooLarge} ملف يتجاوز 15 م.ب ولم يُضف.`)
    if (wrongType > 0) messages.push(`${wrongType} ملف ليس PDF صالحًا ولم يُضف.`)
    if (duplicate > 0) messages.push(`${duplicate} ملف مكرر تم تجاهله.`)
    if (messages.length > 0) showToast(messages.join(' '), overflow ? 'warning' : 'error')
    else if (accepted.length > 0) showToast(`تمت إضافة ${accepted.length} ملف.`, 'success')
  }

  const removeFile = (id: string) => {
    if (phase === 'processing') return
    if (phase === 'done') clearResults()
    setFiles((current) => current.filter((entry) => entry.id !== id))
  }

  const updateTopic = (value: string) => {
    setTopicInput(value)
    if (phase === 'done') clearResults()
  }

  const updateSensitivity = (value: Sensitivity) => {
    setSensitivity(value)
    if (phase === 'done') clearResults()
  }

  const startExtraction = async () => {
    if (phase === 'processing') return
    if (files.length === 0) {
      showToast('أضف ملف PDF واحدًا على الأقل قبل البدء.')
      return
    }
    if (topicInput.trim().length < 2) {
      showToast('اكتب الموضوع المطلوب أولًا (حرفان على الأقل).')
      return
    }
    const topics = parseTopics(topicInput)
    if (topics.length === 0) {
      showToast('لم نتمكن من قراءة الموضوع. جرّب صياغة أوضح.')
      return
    }

    revokeResults(resultsRef.current)
    resultsRef.current = []
    setResults([])
    setFailures([])
    setPhase('processing')
    setCancelling(false)
    cancelRef.current = false

    for (let index = 0; index < files.length; index += 1) {
      if (cancelRef.current) break
      const entry = files[index]
      setProgress({
        fileIndex: index,
        fileCount: files.length,
        fileName: entry.name,
        stage: 'reading',
        fileValue: 0,
        overall: (index / files.length) * 100,
      })

      try {
        const result = await extractSource(entry, topics, sensitivity, (update: FileProgress) => {
          setProgress((current) =>
            current
              ? {
                  ...current,
                  stage: update.stage,
                  fileValue: update.value,
                  overall: ((index + update.value) / files.length) * 100,
                }
              : current,
          )
        })
        setResultsSafe((current) => [...current, result])
      } catch (error) {
        setFailures((current) => [
          ...current,
          { id: entry.id, fileName: entry.name, message: friendlyError(error) },
        ])
      }
    }

    setProgress(null)
    setCancelling(false)
    setPhase('done')
    if (cancelRef.current) showToast('تم إيقاف المعالجة. الملفات الجاهزة متاحة أدناه.', 'warning')
    window.setTimeout(() => {
      resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 180)
  }

  const cancelExtraction = () => {
    cancelRef.current = true
    setCancelling(true)
    showToast('سيتم الإيقاف بعد انتهاء الملف الحالي.', 'warning')
  }

  const startOver = () => {
    clearResults()
    window.setTimeout(() => {
      document.getElementById('tool')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
  }

  const resetAll = () => {
    if (phase === 'processing') return
    clearResults()
    setFiles([])
    setTopicInput('')
    window.setTimeout(() => {
      document.getElementById('tool')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
  }

  const downloadZip = async () => {
    if (results.length === 0 || zipping) return
    setZipping(true)
    try {
      const blob = await buildZip(results)
      downloadBlob(blob, `مقتطفات-${new Date().toISOString().slice(0, 10)}.zip`)
      showToast('تم تجهيز ملف ZIP.', 'success')
    } catch {
      showToast('تعذّر إنشاء ملف ZIP. جرّب تنزيل الملفات كلًا على حدة.')
    } finally {
      setZipping(false)
    }
  }

  const stats = useMemo(() => {
    const withMatches = results.filter((result) => result.matches.length > 0).length
    const pages = results.reduce((total, result) => total + result.matches.length, 0)
    return { withMatches, pages }
  }, [results])

  const canStart = files.length > 0 && topicInput.trim().length >= 2 && phase !== 'processing'
  const currentStageIndex = progress ? STAGE_ORDER.indexOf(progress.stage) : -1

  return (
    <div className="page">
      <header className="site-header">
        <div className="container header-inner">
          <a className="brand" href="#top" aria-label="مُقتطف — الصفحة الرئيسية">
            <BrandMark />
            <span className="brand-text">
              <strong>مُقتطف</strong>
              <span>MUQTATAF</span>
            </span>
          </a>
          <nav className="main-nav" aria-label="روابط رئيسية">
            <a href="#tool">الأداة</a>
            <a href="#how">كيف تعمل</a>
            <a href="#privacy">الخصوصية</a>
          </nav>
          <a className="header-privacy" href="#privacy">
            <ShieldCheck size={15} />
            معالجة محلية 100%
          </a>
        </div>
      </header>

      <main id="top">
        <section className="hero container">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="eyebrow-dot" />
              أداة بحث أكاديمي
            </span>
            <h1>
              من كل رسالة…
              <br />
              <span className="accent">الصفحات التي تهمّك فقط.</span>
            </h1>
            <p className="hero-lede">
              ارفع حتى 8 ملفات PDF، واكتب الموضوع أو المتغير المشترك. تقرأ الأداة كل مصدر على حدة،
              تلتقط الغلاف واسم الباحث والسنة، ثم تجمع لك مقتطفًا مستقلًا يضم الصفحات ذات الصلة فقط.
            </p>
            <ul className="hero-facts">
              <li>
                <Files size={16} />
                8 ملفات كحد أقصى
              </li>
              <li>
                <FileStack size={16} />
                15 م.ب للملف
              </li>
              <li>
                <Lock size={16} />
                بلا رفع إلى خادم
              </li>
            </ul>
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="art-halo" />
            <div className="source-stack">
              <div className="source-sheet sheet-back" />
              <div className="source-sheet sheet-mid" />
              <div className="source-sheet sheet-front">
                <span className="sheet-caption">رسالة ماجستير</span>
                <span className="sheet-line w-80" />
                <span className="sheet-line w-62" />
                <span className="sheet-line w-72" />
                <span className="sheet-line w-48" />
                <span className="sheet-stamp">PDF</span>
              </div>
            </div>
            <div className="art-divider">
              <span />
              <Sparkles size={18} />
              <span />
            </div>
            <div className="extract-sheet">
              <div className="extract-cover">
                <span className="extract-eyebrow">مُقتطف</span>
                <span className="extract-title-line w-78" />
                <span className="extract-title-line w-56" />
                <span className="extract-author-line" />
                <span className="extract-year-line" />
              </div>
              <div className="extract-pages">
                <span className="extract-page">
                  <b>12</b>
                  القيادة التحويلية
                </span>
                <span className="extract-page">
                  <b>35</b>
                  أبعاد القيادة
                </span>
              </div>
            </div>
            <span className="hero-float">
              <CheckCircle2 size={14} />
              الغلاف + الصفحات ذات الصلة
            </span>
          </div>
        </section>

        <section className="workbench container" id="tool">
          <div className="workbench-head">
            <div>
              <span className="section-kicker">مساحة العمل</span>
              <h2>جهّز مقتطفك في ثلاث خطوات</h2>
            </div>
            <span className="local-note">
              <Lock size={14} />
              ملفاتك لا تغادر جهازك
            </span>
          </div>

          <div className="workbench-grid">
            <div className="panel upload-panel">
              <StepHeader
                number="01"
                title="مصادرك"
                subtitle="أضف الرسائل أو الأبحاث بصيغة PDF، بحد أقصى 8 ملفات."
              />
              <FileDropzone
                files={files}
                maxFiles={MAX_FILES}
                maxSize={MAX_SIZE}
                disabled={phase === 'processing'}
                onAdd={addFiles}
                onRemove={removeFile}
              />
            </div>

            <div className="panel topic-panel">
              <StepHeader
                number="02"
                title="الموضوع المطلوب"
                subtitle="اكتب المفهوم أو المتغير الذي تبحث عنه داخل كل مصدر."
              />
              <label className="field-label" htmlFor="topic">
                الموضوع أو المحور
              </label>
              <div className="topic-field">
                <textarea
                  id="topic"
                  value={topicInput}
                  onChange={(event) => updateTopic(event.target.value)}
                  placeholder="مثال: مفهوم القيادة التحويلية"
                  rows={3}
                  maxLength={600}
                  disabled={phase === 'processing'}
                />
                <span className="char-count" dir="ltr">
                  {topicInput.length} / 600
                </span>
              </div>
              <p className="field-hint">
                <Info size={14} />
                يمكنك إدخال أكثر من موضوع، كل موضوع في سطر مستقل.
              </p>

              <div className="examples" aria-label="أمثلة سريعة">
                <span>جرّب:</span>
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    className="example-chip"
                    disabled={phase === 'processing'}
                    onClick={() => {
                      const exists = topicInput
                        .split(/\n/g)
                        .map((line) => line.trim())
                        .includes(example)
                      if (exists) return
                      updateTopic(topicInput.trim() ? `${topicInput.trim()}\n${example}` : example)
                    }}
                  >
                    {example}
                  </button>
                ))}
              </div>

              <div className="sensitivity">
                <div className="sensitivity-head">
                  <span className="field-label">دقة المطابقة</span>
                  <span className="sensitivity-help">المتوازن هو الخيار الأنسب غالبًا</span>
                </div>
                <div className="segmented" role="group" aria-label="دقة المطابقة">
                  {(
                    [
                      ['strict', 'دقيق', 'أقل صفحات، أعلى صلة'],
                      ['balanced', 'متوازن', 'توازن بين الدقة والتغطية'],
                      ['broad', 'موسّع', 'صفحات أكثر احتمالًا'],
                    ] as const
                  ).map(([value, label, description]) => (
                    <button
                      key={value}
                      type="button"
                      className={sensitivity === value ? 'is-active' : ''}
                      onClick={() => updateSensitivity(value)}
                      disabled={phase === 'processing'}
                      title={description}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="start-block">
                <StepHeader
                  number="03"
                  title="الاستخراج"
                  subtitle="لكل مصدر ملف PDF مستقل: الغلاف + الصفحات ذات الصلة."
                />
                <button
                  type="button"
                  className="start-button"
                  disabled={!canStart}
                  onClick={startExtraction}
                >
                  {phase === 'processing' ? (
                    <Loader2 size={20} className="spin" />
                  ) : (
                    <Sparkles size={20} />
                  )}
                  {phase === 'processing' ? 'جارٍ الاستخراج…' : 'ابدأ الاستخراج'}
                  <ArrowLeft size={19} />
                </button>
                <p className="privacy-line">
                  <ShieldCheck size={14} />
                  تتم القراءة والبحث وإنشاء الملفات داخل متصفحك فقط.
                </p>
              </div>
            </div>
          </div>

          {phase === 'processing' && progress && (
            <div className="processing-panel" aria-live="polite">
              <div className="processing-top">
                <span className="processing-spinner">
                  <Loader2 size={22} className="spin" />
                </span>
                <div className="processing-copy">
                  <strong>{STAGE_LABELS[progress.stage]}</strong>
                  <span dir="auto" title={progress.fileName}>
                    {progress.fileName}
                  </span>
                </div>
                <span className="processing-count">
                  الملف {progress.fileIndex + 1} من {progress.fileCount}
                </span>
                <span className="processing-percent">{Math.round(progress.overall)}%</span>
                <button
                  type="button"
                  className="button button-ghost button-small"
                  onClick={cancelExtraction}
                  disabled={cancelling}
                >
                  {cancelling ? 'جارٍ الإيقاف…' : 'إيقاف'}
                </button>
              </div>
              <div className="progress-track">
                <span style={{ width: `${Math.max(2, progress.overall)}%` }} />
              </div>
              <div className="stage-row">
                {STAGE_ORDER.map((stage, index) => (
                  <span
                    key={stage}
                    className={`stage-item ${index < currentStageIndex ? 'is-done' : ''} ${
                      index === currentStageIndex ? 'is-active' : ''
                    }`}
                  >
                    <i>{index < currentStageIndex ? '✓' : index + 1}</i>
                    {STAGE_LABELS[stage]}
                  </span>
                ))}
              </div>
            </div>
          )}

          {phase === 'done' && (
            <div className="done-banner" aria-live="polite">
              <span className="done-icon">
                <CheckCircle2 size={22} />
              </span>
              <div>
                <strong>
                  تم تجهيز {extractsPhrase(results.length)}
                  {failures.length > 0 ? ` · تعذّر ${failures.length}` : ''}
                </strong>
                <span>
                  {stats.withMatches} مصدر يحتوي صفحات مطابقة · {pagesPhrase(stats.pages)} مستخرجة
                </span>
              </div>
              <button type="button" className="button button-ghost button-small" onClick={startOver}>
                <RotateCcw size={15} />
                تعديل المدخلات
              </button>
            </div>
          )}
        </section>

        {phase === 'done' && (
          <section className="results container" id="results" ref={resultsSectionRef}>
            <div className="results-head">
              <div>
                <span className="section-kicker">النتيجة</span>
                <h2>المقتطفات الجاهزة</h2>
                <p>
                  كل ملف مستقل يبدأ بغلاف المصدر، ثم الصفحات المطابقة لموضوعك.
                  {stats.pages > 0 ? ` إجمالًا ${pagesPhrase(stats.pages)} ذات صلة.` : ''}
                </p>
              </div>
              <div className="results-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={downloadZip}
                  disabled={results.length === 0 || zipping}
                >
                  {zipping ? <Loader2 size={17} className="spin" /> : <Package size={17} />}
                  {zipping ? 'جارٍ التجهيز…' : 'تنزيل الكل ZIP'}
                </button>
                <button type="button" className="button button-ghost" onClick={resetAll}>
                  <RotateCcw size={16} />
                  جلسة جديدة
                </button>
              </div>
            </div>

            {failures.length > 0 && (
              <div className="failures">
                <div className="failures-head">
                  <AlertTriangle size={17} />
                  <strong>ملفات تعذّرت معالجتها</strong>
                </div>
                <ul>
                  {failures.map((failure) => (
                    <li key={failure.id}>
                      <span dir="auto">{failure.fileName}</span>
                      <em>{failure.message}</em>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {results.length === 0 ? (
              <div className="empty-results">
                <FileSearch size={34} />
                <h3>لم تُنتج أي مقتطفات</h3>
                <p>راجع الملفات والموضوع ثم أعد المحاولة. لا تُحفظ أي بيانات بعد إغلاق الصفحة.</p>
                <button type="button" className="button button-secondary" onClick={startOver}>
                  المحاولة من جديد
                </button>
              </div>
            ) : (
              <div className="results-grid">
                {results.map((result, index) => (
                  <ResultCard key={result.id} result={result} index={index} />
                ))}
              </div>
            )}
          </section>
        )}

        <section className="how container" id="how">
          <div className="how-head">
            <span className="section-kicker">كيف تعمل</span>
            <h2>ثلاث خطوات، وبلا تعقيد</h2>
            <p>مصمّمة لرسائل الماجستير والدكتوراه والأبحاث الأكاديمية العربية.</p>
          </div>
          <div className="how-grid">
            <article className="how-card">
              <span className="how-number">01</span>
              <span className="how-icon">
                <Files size={23} />
              </span>
              <h3>ارفع المصادر</h3>
              <p>
                حتى 8 ملفات PDF وبحد أقصى 15 م.ب للملف. تُعالج الملفات واحدًا تلو الآخر، كلٌّ على حدة.
              </p>
            </article>
            <article className="how-card">
              <span className="how-number">02</span>
              <span className="how-icon">
                <Search size={23} />
              </span>
              <h3>حدّد الموضوع</h3>
              <p>
                اكتب المفهوم أو المتغير المشترك. تتعرّف الأداة على صيغ الكلمة المختلفة وتتجاوز
                التشكيل واختلاف الهمزات.
              </p>
            </article>
            <article className="how-card">
              <span className="how-number">03</span>
              <span className="how-icon">
                <Download size={23} />
              </span>
              <h3>نزّل المقتطفات</h3>
              <p>
                لكل مصدر ملف PDF مستقل يضم الغلاف وبيانات الباحث والسنة والصفحات ذات الصلة، مع إمكانية
                تنزيل الكل.
              </p>
            </article>
          </div>
        </section>

        <section className="privacy-band container" id="privacy">
          <div className="privacy-card">
            <span className="privacy-icon">
              <ShieldCheck size={30} />
            </span>
            <div className="privacy-copy">
              <span className="section-kicker">الخصوصية أولًا</span>
              <h2>ملفاتك تبقى عندك</h2>
              <p>
                لا يُرفع أي PDF إلى خادم، ولا يُخزَّن أي نص. تقرأ الأداة الملفات وتبحث وتُنشئ الملفات
                الجديدة داخل ذاكرة المتصفح، وتختفي كلها بمجرد إغلاق الصفحة أو بدء جلسة جديدة.
              </p>
            </div>
            <ul className="privacy-points">
              <li>
                <CheckCircle2 size={16} />
                بلا حسابات أو تسجيل دخول
              </li>
              <li>
                <CheckCircle2 size={16} />
                بلا تتبّع أو إعلانات
              </li>
              <li>
                <CheckCircle2 size={16} />
                ملفاتك تبقى داخل جهازك
              </li>
            </ul>
          </div>
          <div className="limit-note">
            <BookOpen size={18} />
            <p>
              <strong>ملاحظة أكاديمية:</strong> الملفات الممسوحة ضوئيًا بلا طبقة نص لا يمكن البحث داخل
              محتواها؛ تُضمَّن أغلفتها ويظهر تنبيه بذلك. راجع دائمًا الصفحات المستخرجة قبل الاقتباس.
            </p>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="brand footer-brand">
            <BrandMark />
            <span className="brand-text">
              <strong>مُقتطف</strong>
              <span>MUQTATAF</span>
            </span>
          </div>
          <p>أداة أكاديمية لاستخراج الصفحات ذات الصلة من الرسائل والأبحاث.</p>
          <span className="footer-note">صُنعت بعناية للباحثين العرب</span>
        </div>
      </footer>

      {toast && (
        <div className={`toast tone-${toast.tone}`} role="status" aria-live="polite">
          <span className="toast-icon">
            {toast.tone === 'success' ? (
              <CheckCircle2 size={18} />
            ) : toast.tone === 'warning' ? (
              <AlertTriangle size={18} />
            ) : (
              <AlertTriangle size={18} />
            )}
          </span>
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="إغلاق التنبيه">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

export default App

