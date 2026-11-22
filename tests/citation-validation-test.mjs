import { chromium } from 'playwright-core'
import path from 'node:path'
const root = path.resolve('muqtataf')
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 1100 } })
await page.route('https://api.deepseek.com/v1/tools/ocr', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization' } })
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ page_count: 2, pages: [
    { index: 0, text: 'جامعة بغداد\nأثر القيادة التحويلية\nإعداد الباحث: حافظ عبد الكريم الغزالي\n2012\nالعراق', finish_reason: 'stop' },
    { index: 1, text: 'القيادة التحويلية\nنص الصفحة\n12', finish_reason: 'stop' },
  ], usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } }) })
})
await page.route('https://api.deepseek.com/chat/completions', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization,content-type' } })
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ choices: [{ message: { content: 'جملة صحيحة (الغزالي، 2012: 12). وجملة أخرى (الغزالي، 2012: 99).\n\nالمراجع\nالغزالي، حافظ عبد الكريم (2012). أثر القيادة التحويلية. رسالة ماجستير، جامعة بغداد، العراق.' } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }) })
})
await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', path.join(root, 'tests/fixtures/study1.pdf'))
await page.fill('#topic', 'القيادة التحويلية')
await page.fill('.api-input input', 'sk-mock')
await page.click('button.start-button')
await page.waitForSelector('.research-card', { timeout: 60000 })
await page.fill('#research-request', 'اكتب عن القيادة التحويلية')
await page.click('.research-write')
await page.waitForSelector('.research-output', { timeout: 60000 })
console.log('validation=', (await page.locator('.research-validation').textContent())?.replace(/\s+/g,' ').trim())
await page.screenshot({ path: path.join(root, 'tests/screenshots/26-validation.png'), fullPage: false })
await browser.close()
