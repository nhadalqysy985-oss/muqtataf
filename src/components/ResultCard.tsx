import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Download,
  Eye,
  FileQuestion,
  FileText,
  GraduationCap,
  Quote,
  Users,
} from 'lucide-react'
import type { SourceResult } from '../lib/types'
import { pagesPhrase, relatedPagesPhrase } from '../lib/format'

interface ResultCardProps {
  result: SourceResult
  index: number
}

export function ResultCard({ result, index }: ResultCardProps) {
  const matchedPages = result.matches.length
  const hasMatches = matchedPages > 0
  const visiblePages = result.matches.slice(0, 16)
  const remainingPages = matchedPages - visiblePages.length
  const snippet = result.matches.find((match) => match.snippet)?.snippet

  return (
    <article className="result-card">
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
            <span>
              <CalendarDays size={14} />
              {result.cover.year || 'السنة غير واضحة'}
              {result.cover.hijriYear ? ` / ${result.cover.hijriYear}` : ''}
            </span>
            <span>
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
        {result.wordUrl && result.wordName && (
          <a className="button button-word button-small" href={result.wordUrl} download={result.wordName}>
            <FileText size={16} />
            نسخة Word
          </a>
        )}
        <a
          className="button button-ghost button-small"
          href={result.outputUrl}
          target="_blank"
          rel="noreferrer"
        >
          <Eye size={16} />
          معاينة
        </a>
        <span className="result-file-note">
          {hasMatches ? `الغلاف + ${pagesPhrase(matchedPages)}` : 'ملف PDF مستقل'}
        </span>
      </div>
    </article>
  )
}
