import { chromium } from 'playwright-core'
import path from 'node:path'
const root = path.resolve('muqtataf')
const raw = `لم أجد في الصفحة المرفقة تعريفاً لمفهوم القيادة التحويلية؛ فالصفحة (48) مخصصة لقائمة المصادر والمراجع.

تُعرّف القيادة التحويلية بأنها عملية تأثير متبادل بين القائد والأتباع، تقوم على الإلهام والتحفيز الفكري والاهتمام الفردي (العواودة، 2017: 49). وتركز على تحويل القيم والاتجاهات والسلوكيات نحو أداء يتجاوز التوقعات (العواودة، 2017: 49).

المراجع
العواودة، محمد (2017). القيادة التحويلية. رسالة ماجستير، جامعة بغداد، العراق.`

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 1100 } })
let chatPayload = null
let chatCalls = 0
page.on('pageerror', (e) => console.log('PAGE_ERROR=', e.message))
await page.route('https://api.deepseek.com/v1/tools/ocr', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization' } })
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ page_count: 3, pages: [
    { index: 0, text: 'جامعة بغداد\nالقيادة التحويلية\nإعداد الطالب: محمد العواودة\n2017\nالعراق', finish_reason: 'stop' },
    { index: 1, text: '48\nقائمة المصادر والمراجع\nالعواودة، محمد (2017). القيادة التحويلية. رسالة ماجستير، جامعة بغداد.\nكتاب القيادة التحويلية (2015).\nدراسة القيادة التحويلية (2014).', finish_reason: 'stop' },
    { index: 2, text: '49\nتعريف القيادة التحويلية\nتُعرّف القيادة التحويلية بأنها عملية تأثير متبادل بين القائد والأتباع، تقوم على الإلهام والتحفيز الفكري والاهتمام الفردي، وتركز على تحويل القيم والاتجاهات والسلوكيات نحو أداء يتجاوز التوقعات.', finish_reason: 'stop' },
  ], usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 } }) })
})
await page.route('https://api.deepseek.com/chat/completions', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization,content-type' } })
  chatCalls += 1
  chatPayload = route.request().postDataJSON()
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ choices: [{ message: { content: raw }, finish_reason: 'stop' }], usage: { prompt_tokens: 2000, completion_tokens: 500, total_tokens: 2500 } }) })
})
await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', path.join(root, 'tests/fixtures/study1.pdf'))
await page.fill('#topic', 'القيادة التحويلية')
await page.fill('.api-input input', 'sk-mock')
await page.click('button.start-button')
await page.waitForSelector('.research-card', { timeout: 60000 })
console.log('SOURCES=', (await page.locator('.research-citations').textContent())?.replace(/\s+/g, ' ').trim())
await page.fill('#research-request', 'اكتب تعريفات القيادة التحويلية')
await page.click('.research-write')
await page.waitForSelector('.research-output', { timeout: 60000 })
console.log('RAW_START'); console.log(raw); console.log('RAW_END')
console.log('CLEANED_START'); console.log(await page.locator('.research-output').textContent()); console.log('CLEANED_END')
console.log('STATS=', (await page.locator('.research-stats').textContent())?.replace(/\s+/g, ' ').trim())
console.log('WARNINGS=', (await page.locator('.research-content-warning').count()) > 0 ? (await page.locator('.research-content-warning').textContent())?.replace(/\s+/g, ' ').trim() : 'none')
const system = chatPayload?.messages?.[0]?.content || ''
const userContent = chatPayload?.messages?.[1]?.content || []
console.log('SYSTEM_HAS_REFERENCE_PAGE=', system.includes('قائمة المصادر والمراجع'))
console.log('SYSTEM_HAS_CONTENT_49=', system.includes('عملية تأثير متبادل'))
console.log('IMAGE_COUNT=', userContent.filter((p) => p.type === 'image_url').length)
console.log('IMAGE_LABELS=', userContent.filter((p) => p.type === 'text').map((p) => p.text).filter((t) => t.includes('صورة من المصدر')))
console.log('CHAT_CALLS=', chatCalls)
await page.screenshot({ path: path.join(root, 'tests/screenshots/30-references-fix.png'), fullPage: false })
await browser.close()
