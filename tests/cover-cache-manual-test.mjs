import { chromium } from 'playwright-core'
import path from 'node:path'
const root = path.resolve('muqtataf')
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const context = await browser.newContext({ viewport: { width: 1200, height: 1000 } })
const page = await context.newPage()
let visionCalls = 0
await page.route('https://api.deepseek.com/v1/tools/ocr', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization' } })
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ page_count: 2, pages: [
    { index: 0, text: 'دور القيادة التحويلية\nجامعة بغداد\n2020', finish_reason: 'stop' },
    { index: 1, text: '112\nالقيادة التحويلية\nنص الصفحة.', finish_reason: 'stop' },
  ], usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } }) })
})
await page.route('https://api.deepseek.com/chat/completions', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization,content-type' } })
  visionCalls += 1
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ choices: [{ message: { content: '{"authors":["أحمد علي"],"year":"2024","confidence":"high"}' } }], usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 } }) })
})
async function openAndExtract() {
  await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
  await page.setInputFiles('input[type=file]', path.join(root, 'tests/fixtures/study1.pdf'))
  await page.fill('#topic', 'القيادة التحويلية')
  await page.fill('.api-input input', 'sk-mock')
  await page.click('button.start-button')
  await page.waitForSelector('.result-card', { timeout: 60000 })
}
await openAndExtract()
await page.click('.meta-edit-toggle')
await page.fill('.meta-editor-row input', 'سارة محمد')
await page.fill('.meta-year-input', '2025')
await page.click('.meta-editor-actions .button-primary')
await page.waitForTimeout(200)
console.log('EDITED=', (await page.locator('.cover-audit').textContent())?.replace(/\s+/g, ' ').trim())
await openAndExtract()
console.log('AFTER_RELOAD=', (await page.locator('.cover-audit').textContent())?.replace(/\s+/g, ' ').trim())
console.log('VISION_CALLS=', visionCalls)
await browser.close()
