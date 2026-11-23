import { chromium } from 'playwright-core'
import path from 'node:path'
const root = path.resolve('muqtataf')
const raw = `**مفهوم الإبداع التنظيمي**

# مقدمة
> يُعدّ الإبداع التنظيمي من المفاهيم التي تتأسس على توليد الأفكار الجديدة وتطبيقها (علي، 2023: 12).
- ويشير النص إلى أن الإبـــداع يتضمن الأصالة والمرونة والمخاطرة (علي، 2023: 12).

\`تنبيه: هذه فقرة تنبيه يجب حذفها كاملة.\`

**ملاحظة:** هذه ملاحظة يجب حذفها.

ويؤكد النص أن الإبداع لا يقتصر على الأفراد بل يمتد إلى العمليات والبيئة التنظيمية (علي، 2023: 13). ولم يُعرَّف المفهوم في الصفحة الأولى، كما أن الصفحات المرفقة لا تتضمن تفصيلاً إضافيًا (علي، 2023: 13).

المراجع
علي، أحمد (2023). مفهوم الإبداع التنظيمي. رسالة ماجستير، جامعة بغداد، العراق.`

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } })
const errors = []
let chatPayload = null
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.route('https://api.deepseek.com/v1/tools/ocr', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization' } })
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({
    page_count: 5,
    pages: [
      { index: 0, text: 'جامعة بغداد\nمفهوم الإبداع التنظيمي\nإعداد الطالب: أحمدعلي\n2023\nالعراق\nنص الغلاف يجب ألا يرسل', finish_reason: 'stop' },
      { index: 1, text: 'ب\nنص الصفحة ب يجب ألا يرسل', finish_reason: 'stop' },
      { index: 2, text: 'نص صفحة بلا رقم يجب ألا يرسل', finish_reason: 'stop' },
      { index: 3, text: '12\nيتضمن الإبداع التنظيمي الأصالة والمرونة والمخاطرة، ويقوم على توليد الأفكار الجديدة وتطبيقها.', finish_reason: 'stop' },
      { index: 4, text: '13\nويمتد الإبداع إلى العمليات والبيئة التنظيمية، ويحتاج إلى دعم القيادة وثقافة تنظيمية.', finish_reason: 'stop' },
    ],
    usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 },
  }) })
})
await page.route('https://api.deepseek.com/chat/completions', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization,content-type' } })
  chatPayload = route.request().postDataJSON()
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ choices: [{ message: { content: raw }, finish_reason: 'stop' }], usage: { prompt_tokens: 2000, completion_tokens: 500, total_tokens: 2500 } }) })
})

await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', path.join(root, 'tests/fixtures/study1.pdf'))
await page.fill('#topic', 'مفهوم الإبداع التنظيمي')
await page.fill('.api-input input', 'sk-mock')
await page.click('button.start-button')
await page.waitForSelector('.research-card', { timeout: 60000 })
console.log('SOURCES=', (await page.locator('.research-citations').textContent())?.replace(/\s+/g, ' ').trim())
await page.fill('#research-request', 'اكتب عن مفهوم الإبداع التنظيمي')
await page.click('.research-write')
await page.waitForSelector('.research-output', { timeout: 60000 })
const cleaned = await page.locator('.research-output').textContent()
console.log('RAW_START')
console.log(raw)
console.log('RAW_END')
console.log('CLEANED_START')
console.log(cleaned)
console.log('CLEANED_END')
console.log('STATS=', (await page.locator('.research-stats').textContent())?.replace(/\s+/g, ' ').trim())
console.log('WARNINGS=', (await page.locator('.research-content-warning').textContent())?.replace(/\s+/g, ' ').trim())
const system = chatPayload?.messages?.[0]?.content || ''
const userContent = chatPayload?.messages?.[1]?.content || []
console.log('SYSTEM_HAS_COVER_TEXT=', system.includes('نص الغلاف يجب ألا يرسل'))
console.log('SYSTEM_HAS_LETTER_PAGE=', system.includes('نص الصفحة ب يجب ألا يرسل'))
console.log('SYSTEM_HAS_NULL_PAGE=', system.includes('نص صفحة بلا رقم يجب ألا يرسل'))
console.log('SYSTEM_HAS_12=', system.includes('الأصالة والمرونة والمخاطرة'))
console.log('IMAGE_COUNT=', userContent.filter((p) => p.type === 'image_url').length)
console.log('IMAGE_LABELS=', userContent.filter((p) => p.type === 'text').map((p) => p.text).filter((t) => t.includes('صورة من المصدر')))
console.log('ERRORS=', errors)
await page.screenshot({ path: path.join(root, 'tests/screenshots/29-creativity.png'), fullPage: false })
await browser.close()
