import { useRef, useState } from 'react'
import { FileText, FileUp, X } from 'lucide-react'
import type { SourceFile } from '../lib/types'

interface FileDropzoneProps {
  files: SourceFile[]
  maxFiles: number
  maxSize: number
  disabled?: boolean
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
}

export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} ك.ب`
  return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`
}

export function FileDropzone({
  files,
  maxFiles,
  maxSize,
  disabled = false,
  onAdd,
  onRemove,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const openPicker = () => {
    if (!disabled) inputRef.current?.click()
  }

  return (
    <div className="uploader">
      <div
        className={`dropzone ${dragging ? 'is-dragging' : ''} ${disabled ? 'is-disabled' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          if (disabled) return
          onAdd(Array.from(event.dataTransfer.files))
        }}
        onClick={openPicker}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openPicker()
          }
        }}
        aria-label="إضافة ملفات PDF"
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="visually-hidden"
          disabled={disabled}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            onAdd(Array.from(event.target.files ?? []))
            event.target.value = ''
          }}
        />
        <div className="dropzone-icon">
          <FileUp size={26} strokeWidth={1.7} />
        </div>
        <div className="dropzone-copy">
          <strong>اسحب ملفات PDF هنا أو اخترها</strong>
          <span>
            حتى {maxFiles} ملفات · بحد أقصى {formatSize(maxSize)} للملف الواحد
          </span>
        </div>
        <span className="dropzone-action">تصفّح الملفات</span>
      </div>

      <div className="file-list-head">
        <span>الملفات المرفقة</span>
        <span className={`file-count ${files.length >= maxFiles ? 'is-full' : ''}`} dir="ltr">
          {files.length} / {maxFiles}
        </span>
      </div>

      {files.length === 0 ? (
        <div className="file-empty">
          <FileText size={17} strokeWidth={1.7} />
          <span>لم تُضف أي مصدر بعد. ابدأ بملف واحد على الأقل.</span>
        </div>
      ) : (
        <ul className="file-list">
          {files.map((entry, index) => (
            <li key={entry.id} className="file-row">
              <span className="file-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="file-type">PDF</span>
              <span className="file-meta">
                <span className="file-name" dir="auto" title={entry.name}>
                  {entry.name}
                </span>
                <span className="file-size">{formatSize(entry.size)}</span>
              </span>
              <button
                type="button"
                className="icon-button file-remove"
                onClick={(event) => {
                  event.stopPropagation()
                  onRemove(entry.id)
                }}
                disabled={disabled}
                aria-label={`إزالة ${entry.name}`}
                title="إزالة الملف"
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
