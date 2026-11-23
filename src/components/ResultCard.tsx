import { useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  FileQuestion,
  FileText,
  GraduationCap,
  Pencil,
  Plus,
  Quote,
  Save,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import type { SourceResult } from '../lib/types'
import { pagesPhrase, relatedPagesPhrase } from '../lib/format'
import { splitAuthorNames } from '../lib/research'
import { formatUsageNumber } from '../lib/usage'

interface ResultCardProps {
  result: SourceResult
  index: number
  onUpdateMeta: (id: string, authors: string[], year: string) => void
  onRemove: (id: string) => void
}

export function ResultCard({ result, index, onUpdateMeta, onRemove }: ResultCardProps) {
  const [editing, setEditing] = useState(false)
  const [authorDrafts, setAuthorDrafts] = useState<string[]>([''])
  const [yearDraft, setYearDraft] = useState('')

  const matchedPages = result.matches.length
  const hasMatches = matchedPages > 0
  const visiblePages = result.matches.slice(0, 16)
  const remainingPages = matchedPages - visiblePages.length
  const snippet = result.matches.find((match) => match.snippet)?.snippet
  const authorMissing =
    !result.cover.authors.trim() || result.citation.surnames.length === 0
  const yearMissing = !/^\d{4}$/.test(result.citation.year)
  const metaWarning = authorMissing || yearMissing
  const warningText =
    authorMissing && yearMissing
      ? 'تنبيه: هذا الملف يحتوي على نقص في اسم الباحث وسنة النشر.'
      : authorMissing
        ? 'تنبيه: هذا الملف يحتوي على نقص في اسم الباحث.'
        : 'تنبيه: هذا الملف يحتوي على نقص في سنة النشر.'

  const openEditor = () => {
    const names = result.cover.authorNames?.length
      ? result.cover.authorNames
      : splitAuthorNames(result.cover.authors)
    setAuthorDrafts(names.length > 0 ? names : [''])
    setYearDraft(/^\d{4}$/.test(result.citation.year) ? result.citation.year : '')
    setEditing(true)
  }

  const saveEditor = () => {
    const names = authorDrafts.map((name) => name.trim()).filter(Boolean)
    onUpdateMeta(result.id, names, yearDraft.trim())
    setEditing(false)
  }

  return (
    <article className={`result-card ${metaWarning ? 'has-meta-warning' : ''}`}>
      <div className="result-top">
        <div className="result-thumb">
          {result.thumbnailUrl ? (
            <img src={result.thumbnailUrl} alt={`غلاف ${result.cover.title}`} loading="lazy" />
          ) : (
            <FileText size={30} strokeWidth={1.3} />
          )}
        </div>

        <div className="result-ident">
          <div className="result-kicker">
            <span>مصدر {String(index + 1).padStart(2, '0')}</span>
            <span className="dot-sep" />
            <span>{pagesPhrase(result.pageCount)} في الأصل</span>
          </div>
          <h3 dir="auto">{result.cover.title}</h3>
          <div className="result-meta">
            <span className={yearMissing ? 'meta-missing' : ''}>
              <CalendarDays size={14} />
              {result.cover.year || 'السنة غير واضحة'}
              {result.cover.hijriYear ? ` / ${result.cover.hijriYear}` : ''}
            </span>
            <span className={authorMissing ? 'meta-missing' : ''}>
              <Users size={14} />
              {result.cover.authors || 'لم يُعثر على اسم الباحث'}
            </span>
          </div>
          {(result.cover.university || result.cover.degree) && (
            <div className="result-institution">
              {result.cover.degree && (
                <span className="degree-chip">
                  <GraduationCap size={13} />
                  {result.cover.degree}
                </span>
              )}
              {result.cover.university && <span dir="auto">{result.cover.university}</span>}
            </div>
          )}
          <details className="cover-audit">
            <summary className="cover-audit-title">
              بيانات الغلاف المستخرجة
              <ChevronDown size={12} className="cover-audit-chevron" />
            </summary>
            <dl>
              <div className={authorMissing ? 'meta-missing-row' : ''}>
                <dt>أسماء الباحثين</dt>
                <dd dir="auto">{result.cover.authors || 'غير واضحة'}</dd>
              </div>
              <div className={authorMissing ? 'meta-missing-row' : ''}>
                <dt>اللقب للتوثيق</dt>
                <dd dir="auto">
                  {result.citation.surnames.length > 0
                    ? result.citation.surnames.join('، ')
                    : 'غير واضح'}
                </dd>
              </div>
              <div className={yearMissing ? 'meta-missing-row' : ''}>
                <dt>السنة</dt>
                <dd>{result.citation.year}</dd>
              </div>
              <div>
                <dt>سطر أخذ الباحث</dt>
                <dd dir="auto">{result.cover.authorLine || 'غير واضح'}</dd>
              </div>
              <div>
                <dt>سطر أخذ السنة</dt>
                <dd dir="auto">{result.cover.yearLine || 'غير واضح'}</dd>
              </div>
            </dl>
            {result.cover.nameWarnings && result.cover.nameWarnings.length > 0 && (
              <div className="cover-audit-warning">
                <AlertTriangle size={13} />
                {result.cover.nameWarnings.map((warning) => (
                  <span key={warning}>{warning}</span>
                ))}
              </div>
            )}
          </details>

          {metaWarning && (
            <div className="result-meta-warning">
              <AlertTriangle size={15} />
              <span>{warningText}</span>
            </div>
          )}

          {editing ? (
            <div className="meta-editor">
              <label className="field-label">اسم الباحث أو الباحثون</label>
              <div className="meta-editor-authors">
                {authorDrafts.map((author, authorIndex) => (
                  <div className="meta-editor-row" key={`author-${authorIndex}`}>
                    <input
                      type="text"
                      value={author}
                      onChange={(event) => {
                        const next = [...authorDrafts]
                        next[authorIndex] = event.target.value
                        setAuthorDrafts(next)
                      }}
                      placeholder="الاسم الكامل للباحث"
                      dir="auto"
                    />
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() =>
                        setAuthorDrafts((current) =>
                          current.length > 1
                            ? current.filter((_, indexToKeep) => indexToKeep !== authorIndex)
                            : current,
                        )
                      }
                      disabled={authorDrafts.length === 1}
                      aria-label="حذف هذا الباحث"
                      title="حذف هذا الباحث"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="button button-ghost button-small meta-add-author"
                onClick={() => setAuthorDrafts((current) => [...current, ''])}
              >
                <Plus size={14} />
                باحث آخر
              </button>

              <label className="field-label" htmlFor={`year-${result.id}`}>
                سنة النشر
              </label>
              <input
                id={`year-${result.id}`}
                className="meta-year-input"
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={yearDraft}
                onChange={(event) =>
                  setYearDraft(event.target.value.replace(/\D/g, '').slice(0, 4))
                }
                placeholder="2026"
                dir="ltr"
              />
              <div className="meta-editor-actions">
                <button
                  type="button"
                  className="button button-primary button-small"
                  onClick={saveEditor}
                >
                  <Save size={14} />
                  حفظ
                </button>
                <button
                  type="button"
                  className="button button-ghost button-small"
                  onClick={() => setEditing(false)}
                >
                  إلغاء
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="button button-ghost button-small meta-edit-toggle"
              onClick={openEditor}
            >
              <Pencil size={14} />
              إضافة / تعديل الباحث والسنة
            </button>
          )}
        </div>

        <span className={`result-badge ${hasMatches ? 'is-success' : 'is-warn'}`}>
          {hasMatches ? <CheckCircle2 size={14} /> : <FileQuestion size={14} />}
          {hasMatches ? relatedPagesPhrase(matchedPages) : 'لا توجد صفحات مطابقة'}
        </span>
      </div>

      <div className="result-body">
        <div className="topics-line">
          <span className="mini-label">الموضوع</span>
          {result.matchedTopics.length > 0 ? (
            result.matchedTopics.map((topic) => (
              <span className="topic-tag" key={topic}>
                {topic}
              </span>
            ))
          ) : (
            <span className="muted-small">لم يُطابق أي موضوع</span>
          )}
        </div>

        <div className="pages-line">
          <span className="mini-label">الصفحات المضمّنة</span>
          <div className="page-chips">
            <span className="page-chip is-cover">الغلاف</span>
            {visiblePages.map((match) => (
              <span
                className="page-chip"
                key={match.pageNumber}
                title={`${match.topics.join('، ')} — صلة ${match.score}%`}
              >
                {match.pageNumber}
              </span>
            ))}
            {remainingPages > 0 && <span className="page-chip is-more">+{remainingPages}</span>}
            {!hasMatches && <span className="muted-small">الغلاف فقط</span>}
          </div>
        </div>

        {snippet && (
          <blockquote className="snippet" dir="auto">
            <Quote size={15} />
            <p>{snippet}</p>
          </blockquote>
        )}

        {result.warning && (
          <div className="result-warning">
            <AlertTriangle size={15} />
            <span>{result.warning}</span>
          </div>
        )}
      </div>

      <div className="result-actions">
        <a className="button button-primary button-small" href={result.outputUrl} download={result.outputName}>
          <Download size={16} />
          {hasMatches ? 'تنزيل المقتطف' : 'تنزيل الغلاف'}
        </a>
        <a
          className="button button-ghost button-small"
          href={result.outputUrl}
          target="_blank"
          rel="noreferrer"
        >
          <Eye size={16} />
          معاينة
        </a>
        <button
          type="button"
          className="button button-danger button-small"
          onClick={() => onRemove(result.id)}
        >
          <Trash2 size={15} />
          إزالة الملف
        </button>
        <span className="result-file-note">
          {hasMatches ? `الغلاف + ${pagesPhrase(matchedPages)}` : 'ملف PDF مستقل'}
          {result.usage && result.usage.totalTokens > 0
            ? ` · ${formatUsageNumber(result.usage.totalTokens)} توكن`
            : ''}
        </span>
      </div>
    </article>
  )
}
