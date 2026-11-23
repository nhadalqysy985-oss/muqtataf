import { chromium } from 'playwright-core'
import path from 'node:path'
const root = path.resolve('muqtataf')
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } })
const errors = []
let chatPayload = null
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

const longText = ('تتناول هذه الفقرة موضوع تقدير الذات وأثره في الصحة النفسية والتفاعل الاجتماعي، مع تحليل العلاقة بين المتغيرات.' + ' ').repeat(36)
const output = `${longText}\n\nجملة موثقة (شريط، 2022: ب). وجملة أخرى (شريط، 2022: 99). ونقل غير مباشر (Northouse، 2001، نقلاً عن شريط، 2022: ب).\n\nالمراجع\nشريط، سليمة (2022). أثر تقدير الذات. رسالة ماجستير، جامعة بغداد، العراق.`

await page.route('https://api.deepseek.com/v1/tools/ocr', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization' } })
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({
    page_count: 2,
    pages: [
      { index: 0, text: 'جامعة بغداد\nأثر تقدير الذات على الصحة النفسية\nإعداد الطالب: سليمةشريط\nالسنة الجامعية: 2021/2022\nالعراق', finish_reason: 'stop' },
      { index: 1, text: 'ب\nتتناول الصفحة موضوع تقدير الذات وأثره على الصحة النفسية.', finish_reason: 'stop' },
    ],
    usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 },
  }) })
})
await page.route('https://api.deepseek.com/chat/completions', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization,content-type' } })
  chatPayload = route.request().postDataJSON()
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({
    choices: [{ message: { content: output }, finish_reason: 'length' }],
    usage: { prompt_tokens: 2000, completion_tokens: 1000, total_tokens: 3000 },
  }) })
})

await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', path.join(root, 'tests/fixtures/study1.pdf'))
await page.fill('#topic', 'تقدير الذات')
await page.fill('.api-input input', 'sk-mock')
await page.click('button.start-button')
await page.waitForSelector('.research-card', { timeout: 60000 })
console.log('AUDIT=', (await page.locator('.cover-audit').textContent())?.replace(/\s+/g, ' ').trim())
await page.fill('#research-request', 'اكتب عن تقدير الذات')
await page.click('.research-write')
await page.waitForSelector('.research-output', { timeout: 60000 })
console.log('STATS=', (await page.locator('.research-stats').textContent())?.replace(/\s+/g, ' ').trim())
console.log('TRUNCATED=', (await page.locator('.research-truncated').allTextContents()).join(' | '))
console.log('VALIDATION=', (await page.locator('.research-validation').textContent())?.replace(/\s+/g, ' ').trim())
const system = chatPayload?.messages?.[0]?.content || ''
console.log('LENGTH RULE=', system.includes('500 كلمة'))
console.log('PAGE LETTER IN CONTEXT=', system.includes('الصفحة المطبوعة: ب'))
const userContent = chatPayload?.messages?.[1]?.content || []
console.log('IMAGE LABELS=', userContent.filter((p) => p.type === 'text').map((p) => p.text).filter((t) => t.includes('صورة من المصدر')))
console.log('ERRORS=', errors)
await page.screenshot({ path: path.join(root, 'tests/screenshots/27-four-changes.png'), fullPage: false })
await browser.close()
