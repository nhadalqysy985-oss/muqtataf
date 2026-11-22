import type { FileProgress } from './types'

export interface DeepSeekPage {
  index: number
  text: string
  finishReason: string
}

export interface DeepSeekUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export type UsageEvent =
  | { type: 'attempt' }
  | { type: 'failure' }
  | { type: 'success'; usage: DeepSeekUsage; pages: number }

export interface DeepSeekOcrResult {
  pages: DeepSeekPage[]
  pageCount: number
  usage: DeepSeekUsage
}

function stripOcrMarkup(text: string): string {
  return text
    .replace(/<｜[^｜>]*｜>/g, ' ')
    .replace(/\[\[\s*-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?)+\s*\]\]/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function friendlyApiError(status: number, message: string): string {
  if (status === 401) return 'مفتاح DeepSeek API غير صالح. تحقق من المفتاح ثم أعد المحاولة.'
  if (status === 402) return 'رصيد حساب DeepSeek غير كافٍ لتنفيذ العملية.'
  if (status === 413) return 'حجم الملف يتجاوز الحد المسموح في DeepSeek (100 م.ب).'
  if (status === 429) return 'طلبات كثيرة أو معالجات كثيرة قيد التنفيذ. انتظر قليلًا ثم أعد المحاولة.'
  if (status === 408) return 'انتهت مهلة رفع الملف إلى DeepSeek. جرّب ملفًا أصغر أو اتصالًا أسرع.'
  if (status === 504) return 'استغرق OCR وقتًا أطول من الحد في DeepSeek. جرّب نطاق صفحات أقل.'
  if (status >= 500) return 'خدمة DeepSeek غير متاحة مؤقتًا. أعد المحاولة بعد قليل.'
  return message || `تعذّر إكمال OCR عبر DeepSeek (رمز ${status}).`
}

export async function ocrWithDeepSeek(
  file: File,
  apiKey: string,
  onProgress: (progress: FileProgress) => void,
  onUsage?: (event: UsageEvent) => void,
): Promise<DeepSeekOcrResult> {
  if (!apiKey.trim()) throw new Error('أدخل مفتاح DeepSeek API أولًا.')
  if (file.size > 100 * 1024 * 1024) throw new Error('حجم الملف يتجاوز 100 م.ب.')

  onProgress({ stage: 'ocr', value: 0.08 })

  const form = new FormData()
  form.append('purpose', 'text_recognition')
  form.append('file', file, file.name)

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 200_000)
  let pulse = 0.1
  const heartbeat = window.setInterval(() => {
    pulse = Math.min(0.26, pulse + 0.012)
    onProgress({ stage: 'ocr', value: pulse })
  }, 2500)

  onUsage?.({ type: 'attempt' })

  let response: Response
  try {
    response = await fetch('https://api.deepseek.com/v1/tools/ocr', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
      body: form,
      signal: controller.signal,
    })
  } catch (error) {
    onUsage?.({ type: 'failure' })
    if ((error as Error).name === 'AbortError') {
      throw new Error('انتهت مهلة الاتصال بـ DeepSeek. جرّب ملفًا أصغر أو أعد المحاولة.')
    }
    throw new Error('تعذّر الاتصال بـ DeepSeek. تحقق من الإنترنت ومن سياسة CORS ثم أعد المحاولة.')
  } finally {
    window.clearTimeout(timeout)
    window.clearInterval(heartbeat)
  }

  onProgress({ stage: 'ocr', value: 0.28 })

  const fail = (message: string): never => {
    onUsage?.({ type: 'failure' })
    throw new Error(message)
  }

  const raw = await response.text().catch(() =>
    fail('انقطع الاتصال أثناء قراءة استجابة DeepSeek. أعد المحاولة.'),
  )
  let data: {
    pages?: Array<{ index?: number; text?: string; finish_reason?: string }>
    page_count?: number
    usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number }
    error?: { message?: string }
  }
  try {
    data = JSON.parse(raw)
  } catch {
    return fail(friendlyApiError(response.status, raw.slice(0, 200)))
  }

  if (!response.ok || data.error) {
    return fail(friendlyApiError(response.status, data.error?.message ?? ''))
  }
  if (!Array.isArray(data.pages) || data.pages.length === 0) {
    return fail('لم يعُد DeepSeek بأي صفحات نصية لهذا الملف.')
  }

  const pages = data.pages
    .map((page, index) => ({
      index: typeof page.index === 'number' ? page.index : index,
      text: stripOcrMarkup(page.text ?? ''),
      finishReason: page.finish_reason ?? 'stop',
    }))
    .sort((a, b) => a.index - b.index)

  const pageCount = data.page_count ?? pages.length
  const inputTokens = Number(data.usage?.input_tokens) || 0
  const outputTokens = Number(data.usage?.output_tokens) || 0
  const totalTokens = Number(data.usage?.total_tokens) || inputTokens + outputTokens
  const usage: DeepSeekUsage = { inputTokens, outputTokens, totalTokens }

  onProgress({ stage: 'ocr', value: 0.72 })
  onUsage?.({ type: 'success', usage, pages: pageCount })

  return {
    pages,
    pageCount,
    usage,
  }
}
