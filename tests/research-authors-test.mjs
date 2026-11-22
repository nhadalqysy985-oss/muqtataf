import { chromium } from 'playwright-core'
import path from 'node:path'
const root = path.resolve('muqtataf')
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
let payload = null
await page.route('https://api.deepseek.com/v1/tools/ocr', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization' } })
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({
    page_count: 2,
    pages: [
      { index: 0, text: 'جامعة بغداد\nأثر القيادة التحويلية\nإعداد الطالبان: حافظ عبد الكريم الغزالي و سعيد علي الجبوري\n2012\nالعراق', finish_reason: 'stop' },
      { index: 1, text: 'القيادة التحويلية\nنص الصفحة\n12', finish_reason: 'stop' },
    ],
    usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
  }) })
})
await page.route('https://api.deepseek.com/chat/completions', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization,content-type' } })
  payload = route.request().postDataJSON()
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ choices: [{ message: { content: 'نص (الغزالي والجبوري، 2012: 12).' } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }) })
})
await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', path.join(root, 'tests/fixtures/study1.pdf'))
await page.fill('#topic', 'القيادة التحويلية')
await page.fill('.api-input input', 'sk-mock')
await page.click('button.start-button')
await page.waitForSelector('.research-card', { timeout: 60000 })
console.log('chips=', await page.locator('.research-citation').allTextContents())
await page.fill('#research-request', 'اكتب عن القيادة التحويلية')
await page.click('.research-write')
await page.waitForSelector('.research-output', { timeout: 60000 })
const system = payload?.messages?.[0]?.content || ''
console.log('label=', system.includes('(الغزالي والجبوري، 2012)'))
console.log('ref=', system.includes('الغزالي، حافظ عبد الكريم؛ الجبوري، سعيد علي'))
await browser.close()
