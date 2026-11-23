import { chromium } from 'playwright-core'
import path from 'node:path'
const root = path.resolve('muqtataf')
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1000, height: 900 } })
await page.route('https://api.deepseek.com/v1/tools/ocr', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization' } })
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ page_count: 2, pages: [
    { index: 0, text: 'مفهوم الإبداع التنظيمي\nإعداد الطالبان: عبدالله فاضل علي، خالد محمد جاسم\nجامعة بغداد\n2026\nالعراق', finish_reason: 'stop' },
    { index: 1, text: '112\nالإبداع التنظيمي\nنص الصفحة.', finish_reason: 'stop' },
  ], usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } }) })
})
await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', path.join(root, 'tests/fixtures/study1.pdf'))
await page.fill('#topic', 'الإبداع التنظيمي')
await page.fill('.api-input input', 'sk-mock')
await page.click('button.start-button')
await page.waitForSelector('.research-card', { timeout: 60000 })
console.log('AUDIT=', (await page.locator('.cover-audit').textContent())?.replace(/\s+/g, ' ').trim())
console.log('CITATION=', (await page.locator('.research-citation').textContent())?.replace(/\s+/g, ' ').trim())
await browser.close()
