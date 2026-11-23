import { chromium } from 'playwright-core'
import path from 'node:path'
const root = path.resolve('muqtataf')
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } })
const errors = []
let chatPayload = null
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.route('https://api.deepseek.com/v1/tools/ocr', async (route) => {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization' } })
    return
  }
  const body = {
    id: 'ocr-test', object: 'ocr.result', purpose: 'text_recognition', page_count: 2,
    pages: [
      { index: 0, text: 'جامعة بغداد\nكلية الإدارة والاقتصاد\nأثر القيادة التحويلية في الأداء المؤسسي\nإعداد الباحث: حافظ عبد الكريم الغزالي\nإشراف: أ.د. محمد صالح\nبغداد - العراق\n2012', finish_reason: 'stop' },
      { index: 1, text: 'القيادة التحويلية\nتُعد القيادة التحويلية من المفاهيم الحديثة في الإدارة.\n12', finish_reason: 'stop' },
    ],
    usage: { input_tokens: 800, output_tokens: 200, total_tokens: 1000 },
  }
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) })
})
await page.route('https://api.deepseek.com/chat/completions', async (route) => {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization,content-type' } })
    return
  }
  chatPayload = route.request().postDataJSON()
  const body = {
    id: 'chat-test', object: 'chat.completion',
    choices: [{ index: 0, message: { role: 'assistant', content: 'تُعدّ القيادة التحويلية من المفاهيم الحديثة في الإدارة (الغزالي، 2012: 12).\n\nالمراجع\nالغزالي، حافظ عبد الكريم (2012). أثر القيادة التحويلية في الأداء المؤسسي. رسالة ماجستير، جامعة بغداد، العراق.' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 3000, completion_tokens: 400, total_tokens: 3400 },
  }
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) })
})

await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', path.join(root, 'tests/fixtures/study1.pdf'))
await page.fill('#topic', 'القيادة التحويلية')
await page.fill('.api-input input', 'sk-mock-test')
await page.click('button.start-button')
await page.waitForSelector('.research-card', { timeout: 60000 })
console.log('citation chips=', await page.locator('.research-citation').allTextContents())
await page.fill('#research-request', 'اكتب عن مفهوم القيادة التحويلية')
await page.click('.research-write')
await page.waitForSelector('.research-output', { timeout: 60000 })
console.log('output=', (await page.locator('.research-output').textContent())?.slice(0, 300))
console.log('chat model=', chatPayload?.model)
const userContent = chatPayload?.messages?.[1]?.content
console.log(
  'image blocks=',
  Array.isArray(userContent) ? userContent.filter((part) => part.type === 'image_url').length : 0,
)
console.log(
  'image labels=',
  Array.isArray(userContent)
    ? userContent
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .filter((text) => text.includes('صورة من المصدر'))
        .slice(0, 2)
    : [],
)
const system = chatPayload?.messages?.[0]?.content || ''
console.log('has page 12=', system.includes('الصفحة المطبوعة: 12'))
console.log('has citation=', system.includes('(الغزالي، 2012)'))
console.log('has country=', system.includes('العراق'))
console.log('usage=', (await page.locator('.usage-panel').textContent())?.replace(/\s+/g,' ').trim())
await page.screenshot({ path: path.join(root, 'tests/screenshots/25-research.png'), fullPage: false })
console.log('errors=', errors)
await browser.close()
