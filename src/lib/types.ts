export type Sensitivity = 'strict' | 'balanced' | 'broad'

export interface SourceFile {
  id: string
  file: File
  name: string
  size: number
}

export interface Topic {
  raw: string
  display: string
  normalized: string
  terms: string[]
  termVariants: string[][]
  phrase: string
  phraseNoAl: string
}

export interface PageMatch {
  pageNumber: number
  score: number
  topics: string[]
  snippet: string
}

export interface CoverInfo {
  title: string
  authors: string
  year: string
  hijriYear?: string
  university?: string
  degree?: string
  coverReadable: boolean
  titleSource: 'cover' | 'metadata' | 'filename'
}

export interface SourceResult {
  id: string
  fileName: string
  fileSize: number
  pageCount: number
  cover: CoverInfo
  matches: PageMatch[]
  matchedTopics: string[]
  outputBlob: Blob
  outputUrl: string
  outputName: string
  ocrPageCount: number
  thumbnailUrl?: string
  warning?: string
}

export interface FileFailure {
  id: string
  fileName: string
  message: string
}

export type ProcessingStage =
  | 'reading'
  | 'ocr'
  | 'cover'
  | 'searching'
  | 'building'
  | 'done'

export interface FileProgress {
  stage: ProcessingStage
  value: number
}

export const STAGE_LABELS: Record<ProcessingStage, string> = {
  reading: 'قراءة الملف',
  ocr: 'OCR عبر DeepSeek',
  cover: 'تحليل الغلاف',
  searching: 'البحث في الصفحات',
  building: 'تجميع الملف',
  done: 'اكتمل',
}
