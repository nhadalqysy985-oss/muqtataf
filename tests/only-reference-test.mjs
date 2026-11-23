import { chromium } from 'playwright-core'
import path from 'node:path'
const root = path.resolve('muqtataf')
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
let chatCalls = 0
await page.route('https://api.deepseek.com/v1/tools/ocr', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization' } })
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ page_count: 2, pages: [
    { index: 0, text: 'جامعة بغداد\nالقيادة التحويلية\nإعداد الطالب: محمد العواودة\n2017\nالعراق', finish_reason: 'stop' },
    { index: 1, text: '48\nقائمة المصادر والمراجع\nالعواودة، محمد (2017). القيادة التحويلية.', finish_reason: 'stop' },
  ], usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } }) })
})
await page.route('https://api.deepseek.com/chat/completions', async (route) => { chatCalls += 1; await route.fulfill({ status: 500, body: '{}' }) })
await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', path.join(root, 'tests/fixtures/study1.pdf'))
await page.fill('#topic', 'القيادة التحويلية')
await page.fill('.api-input input', 'sk-mock')
await page.click('button.start-button')
await page.waitForSelector('.research-card', { timeout: 60000 })
console.log('COUNTS=', (await page.locator('.research-sources').textContent())?.replace(/\s+/g, ' ').trim())
console.log('EMPTY=', (await page.locator('.research-empty').textContent())?.replace(/\s+/g, ' ').trim())
console.log('CHAT_CALLS=', chatCalls)
await browser.close()
