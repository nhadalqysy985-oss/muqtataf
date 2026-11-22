import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BookOpenCheck,
  Check,
  Copy,
  Loader2,
  PenLine,
  Sparkles,
} from 'lucide-react'
import type { SourceResult } from '../lib/types'
import type { UsageEvent } from '../lib/deepseek'
import { pagesPhrase } from '../lib/format'
import {
  askResearcher,
  collectResearchSources,
  validateResearchCitations,
} from '../lib/research'

interface ResearchPanelProps {
  results: SourceResult[]
  apiKey: string
  onUsage: (event: UsageEvent) => void
}

const RESEARCH_EXAMPLES = [
  'اكتب عن مفهوم القيادة التحويلية',
  'لخّص أثر وسائل التواصل على تقدير الذات',
  'قارن بين تعريفات الباحثين للمفهوم',
]

export function ResearchPanel({ results, apiKey, onUsage }: ResearchPanelProps) {
  const [request, setRequest] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const sources = useMemo(() => collectResearchSources(results), [results])
  const availablePages = sources.reduce((total, source) => total + source.pages.length, 0)
  const canWrite = sources.length > 0 && request.trim().length >= 3
  const validation = useMemo(
    () => (output ? validateResearchCitations(output, sources) : null),
    [output, sources],
  )

  useEffect(() => {
    setOutput('')
    setError('')
    setCopied(false)
  }, [results])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2200)
    return () => window.clearTimeout(timer)
  }, [copied])

  const write = async () => {
    if (loading) return
    if (!request.trim()) {
      setError('اكتب طلبك البحثي أولًا.')
      return
    }
    if (sources.length === 0) {
      setError('لا توجد صفحات مستخرجة يمكن الاعتماد عليها.')
      return
    }
    setLoading(true)
    setError('')
    setOutput('')
    setCopied(false)
    try {
      const text = await askResearcher(apiKey, request, sources, onUsage)
      setOutput(text)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'تعذّرت الكتابة عبر DeepSeek. أعد المحاولة.',
      )
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
    } catch {
      setError('تعذّر نسخ النص. يمكنك تحديده ونسخه يدويًا.')
    }
  }

  return (
    <section className="research-section container" id="researcher">
      <div className="research-card">
        <div className="research-head">
          <span className="research-icon">
            <BookOpenCheck size={25} />
          </span>
          <div>
            <span className="section-kicker">الخطوة الثانية</span>
            <h2>الباحث العلمي</h2>
            <p>
              اطلب كتابة نص بحثي اعتمادًا على الصفحات المستخرجة فقط، مع توثيق أسماء الباحثين
              والسنوات وأرقام الصفحات المطبوعة.
            </p>
          </div>
          <div className="research-sources">
            <strong>{sources.length}</strong>
            <span>مصادر</span>
            <i />
            <strong>{availablePages}</strong>
            <span>صفحات</span>
          </div>
        </div>

        {sources.length === 0 ? (
          <div className="research-empty">
            <AlertTriangle size={18} />
            <p>
              لا توجد صفحات مطابقة يمكن للباحث الاعتماد عليها. غيّر الموضوع أو جرّب نطاقًا أوسع
              للاستخراج أولًا.
            </p>
          </div>
        ) : (
          <>
            <div className="research-citations">
              {sources.map((source) => (
                <span className="research-citation" key={source.fileName} title={source.citation.reference}>
                  {source.citation.label}
                  <em>{pagesPhrase(source.pages.length)}</em>
                </span>
              ))}
            </div>

            <div className="research-request">
              <label className="field-label" htmlFor="research-request">
                ماذا تريد أن تكتب؟
              </label>
              <textarea
                id="research-request"
                value={request}
                onChange={(event) => {
                  setRequest(event.target.value)
                  if (error) setError('')
                }}
                placeholder="مثال: اكتب عن مفهوم القيادة التحويلية بالاعتماد على المصادر المرفقة."
                rows={3}
                maxLength={2000}
                disabled={loading}
              />
              <div className="research-examples">
                {RESEARCH_EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setRequest(example)}
                    disabled={loading}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            <div className="research-actions">
              <p>
                <Sparkles size={14} />
                سيلتزم الباحث بقواعد التوثيق، ولن يخترع مصادر أو أرقام صفحات.
              </p>
              <button
                type="button"
                className="button button-primary research-write"
                onClick={write}
                disabled={!canWrite || loading}
              >
                {loading ? <Loader2 size={18} className="spin" /> : <PenLine size={18} />}
                {loading ? 'جارٍ الكتابة والتحقق…' : 'اكتب النص العلمي'}
              </button>
            </div>

            {error && (
              <div className="research-error">
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            {output && (
              <div className="research-result">
                <div className="research-result-head">
                  <span>
                    <Check size={15} />
                    النص العلمي
                  </span>
                  <button type="button" className="button button-ghost button-small" onClick={copy}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'تم النسخ' : 'نسخ النص'}
                  </button>
                </div>
                <div className="research-output" dir="auto">
                  {output}
                </div>
                {validation && (
                  <div
                    className={`research-validation ${
                      validation.issues.length > 0 || validation.checked === 0
                        ? 'has-issues'
                        : 'is-valid'
                    }`}
                  >
                    {validation.issues.length > 0 ? (
                      <>
                        <strong>
                          تحقق آلي: {validation.issues.length} ملاحظة على الاقتباسات
                        </strong>
                        <ul>
                          {validation.issues.map((issue, index) => (
                            <li key={`${issue.citation}-${index}`}>
                              <code>{issue.citation}</code>
                              <span>{issue.message}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : validation.checked === 0 ? (
                      <strong>
                        تحقق آلي: لم أجد اقتباسات بالصيغة المطلوبة. راجع النص يدويًا.
                      </strong>
                    ) : (
                      <strong>
                        تحقق آلي: {validation.valid} اقتباسًا تشير إلى مصادر وصفحات موجودة في
                        المقاطع.
                      </strong>
                    )}
                    <em>
                      هذا فحص تقريبي لوجود المصدر والصفحة، ولا يثبت صحة كل عبارة منسوبة.
                    </em>
                  </div>
                )}
                <p className="research-footnote">
                  راجع الاقتباسات وأرقام الصفحات قبل الاستخدام النهائي؛ الذكاء الاصطناعي قد يخطئ.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
