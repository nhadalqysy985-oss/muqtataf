import { chromium } from 'playwright-core'
import path from 'node:path'
const root = path.resolve('muqtataf')
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const context = await browser.newContext({ viewport: { width: 1200, height: 1000 } })
const page = await context.newPage()
let visionCalls = 0
let lastVisionBody = null
let ocrCalls = 0
await page.route('https://api.deepseek.com/v1/tools/ocr', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization' } })
  ocrCalls += 1
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ page_count: 2, pages: [
    { index: 0, text: 'دور القيادة التحويلية\nجامعة بغداد\nكلية الإدارة\n2020', finish_reason: 'stop' },
    { index: 1, text: '112\nالقيادة التحويلية\nنص الصفحة.', finish_reason: 'stop' },
  ], usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } }) })
})
await page.route('https://api.deepseek.com/chat/completions', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization,content-type' } })
  visionCalls += 1
  lastVisionBody = route.request().postDataJSON()
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ choices: [{ message: { content: '{"authors":["أحمد علي"],"year":"2024","confidence":"high"}' }, finish_reason: 'stop' }], usage: { prompt_tokens: 2000, completion_tokens: 50, total_tokens: 2050 } }) })
})
async function runExtraction() {
  await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
  await page.setInputFiles('input[type=file]', path.join(root, 'tests/fixtures/study1.pdf'))
  await page.fill('#topic', 'القيادة التحويلية')
  await page.fill('.api-input input', 'sk-mock')
  await page.click('button.start-button')
  await page.waitForSelector('.result-card', { timeout: 60000 })
  return (await page.locator('.cover-audit').textContent())?.replace(/\s+/g, ' ').trim()
}
const first = await runExtraction()
const imageBlocks = lastVisionBody?.messages?.[1]?.content?.filter((part) => part.type === 'image_url') ?? []
console.log('FIRST_AUDIT=', first)
console.log('VISION_CALLS_AFTER_FIRST=', visionCalls)
console.log('OCR_CALLS_AFTER_FIRST=', ocrCalls)
console.log('IMAGE_BLOCKS=', imageBlocks.length)
console.log('IMAGE_DATA_LENGTH=', imageBlocks[0]?.image_url?.url?.length ?? 0)
const second = await runExtraction()
console.log('SECOND_AUDIT=', second)
console.log('VISION_CALLS_AFTER_SECOND=', visionCalls)
console.log('OCR_CALLS_AFTER_SECOND=', ocrCalls)
await browser.close()
