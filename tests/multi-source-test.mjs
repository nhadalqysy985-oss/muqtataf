import { chromium } from 'playwright-core'
import path from 'node:path'
const root = path.resolve('muqtataf')
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
let finalSystem = ''
let visionCalls = 0
await page.route('https://api.deepseek.com/v1/tools/ocr', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization' } })
  const body = route.request().postDataBuffer()?.toString('utf8') || ''
  const first = body.includes('study1.pdf')
  const second = body.includes('study2.pdf')
  const author = first ? 'أحمد علي' : second ? 'سارة محمد' : 'خالد جاسم'
  const year = first ? '2024' : second ? '2025' : '2023'
  const pageNo = first ? '10' : second ? '20' : '30'
  const longText = first ? ('القيادة التحويلية ' + 'نص نظري طويل. '.repeat(9000)) : 'القيادة التحويلية مفهوم نظري وأبعاد ومقارنات.'
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ page_count: 2, pages: [
    { index: 0, text: `دور القيادة التحويلية\nإعداد الطالب: ${author}\nجامعة بغداد\n${year}\nالعراق`, finish_reason: 'stop' },
    { index: 1, text: `${pageNo}\n${longText}`, finish_reason: 'stop' },
  ], usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } }) })
})
await page.route('https://api.deepseek.com/chat/completions', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization,content-type' } })
  const payload = route.request().postDataJSON()
  const user = payload?.messages?.[1]?.content
  const systemPrompt = payload?.messages?.[0]?.content || ''
  const isVision = systemPrompt.includes('صفحة غلاف')
  if (isVision) {
    visionCalls += 1
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ choices: [{ message: { content: '{"authors":[],"year":""}' } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }) })
    return
  }
  finalSystem = payload?.messages?.[0]?.content || ''
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ choices: [{ message: { content: 'نص علمي (أحمد علي، 2024: 10).' }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }) })
})
await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', [path.join(root, 'tests/fixtures/study1.pdf'), path.join(root, 'tests/fixtures/study2.pdf'), path.join(root, 'tests/fixtures/soltani.pdf')])
await page.fill('#topic', 'القيادة التحويلية')
await page.fill('.api-input input', 'sk-mock')
await page.click('button.start-button')
await page.waitForSelector('.research-card', { timeout: 60000 })
console.log('SOURCES=', (await page.locator('.research-citations').textContent())?.replace(/\s+/g, ' ').trim())
await page.fill('#research-request', 'اكتب عن مفهوم القيادة التحويلية')
await page.click('.research-write')
await page.waitForSelector('.research-output', { timeout: 60000 })
console.log('VISION_CALLS=', visionCalls)
console.log('HAS_AHMED=', finalSystem.includes('أحمد علي'))
console.log('HAS_SARA=', finalSystem.includes('سارة محمد'))
console.log('HAS_KHALED=', finalSystem.includes('خالد جاسم'))
console.log('HAS_PAGE10=', finalSystem.includes('الصفحة المطبوعة: 10'))
console.log('HAS_PAGE20=', finalSystem.includes('الصفحة المطبوعة: 20'))
console.log('HAS_PAGE30=', finalSystem.includes('الصفحة المطبوعة: 30'))
console.log('HAS_DIVERSITY_RULE=', finalSystem.includes('وزّع الفقرات والتوثيق'))
console.log('HAS_REFERENCE_RULE=', finalSystem.includes('فقط المصادر التي اعتمدت عليها'))
await browser.close()

