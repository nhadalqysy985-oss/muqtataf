import { chromium } from 'playwright-core'
import path from 'node:path'
const root = path.resolve('muqtataf')
const raw = `يُعدّ الإبداع التنظيمي من المفاهيم التي تعتمد على توليد الأفكار الجديدة وتطبيقها (علي، 2026: 112). ويتحقق الإبداع من خلال الأصالة والمرونة والمخاطرة (علي، 2026: 112).\n\nالمراجع\nعلي، أحمد (2026). مفهوم الإبداع التنظيمي. رسالة ماجستير، جامعة بغداد، العراق.`
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 1100 } })
let chatPayload = null
page.on('pageerror', (e) => console.log('PAGE_ERROR=', e.message))
await page.route('https://api.deepseek.com/v1/tools/ocr', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization' } })
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ page_count: 2, pages: [
    { index: 0, text: 'مفهوم الإبداع التنظيمي\nأحمد علي\nجامعة بغداد\nكلية الإدارة والاقتصاد\n2026\nالعراق', finish_reason: 'stop' },
    { index: 1, text: '112\nالإبداع التنظيمي\nيعتمد الإبداع التنظيمي على توليد الأفكار الجديدة وتطبيقها، ويتحقق من خلال الأصالة والمرونة والمخاطرة.', finish_reason: 'stop' },
  ], usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } }) })
})
await page.route('https://api.deepseek.com/chat/completions', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization,content-type' } })
  chatPayload = route.request().postDataJSON()
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ choices: [{ message: { content: raw }, finish_reason: 'stop' }], usage: { prompt_tokens: 800, completion_tokens: 100, total_tokens: 900 } }) })
})
await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', path.join(root, 'tests/fixtures/study1.pdf'))
await page.fill('#topic', 'مفهوم الإبداع التنظيمي')
await page.fill('.api-input input', 'sk-mock')
await page.click('button.start-button')
await page.waitForSelector('.research-card', { timeout: 60000 })
console.log('AUDIT=', (await page.locator('.cover-audit').textContent())?.replace(/\s+/g, ' ').trim())
console.log('SOURCES=', (await page.locator('.research-citations').textContent())?.replace(/\s+/g, ' ').trim())
await page.fill('#research-request', 'اكتب عن مفهوم الإبداع التنظيمي')
await page.click('.research-write')
await page.waitForSelector('.research-output', { timeout: 60000 })
console.log('OUTPUT=', (await page.locator('.research-output').textContent())?.replace(/\s+/g, ' ').trim())
const system = chatPayload?.messages?.[0]?.content || ''
const userContent = chatPayload?.messages?.[1]?.content || []
console.log('PROMPT_NO_MARKER_RULE=', system.includes('لا تشترط وجود كلمة "إعداد"'))
console.log('PROMPT_SUPERVISOR_RULE=', system.includes('المشرفين (بإشراف)'))
console.log('SYSTEM_HAS_112=', system.includes('الصفحة المطبوعة: 112'))
console.log('IMAGE_LABELS=', userContent.filter((p) => p.type === 'text').map((p) => p.text).filter((t) => t.includes('صورة من المصدر')))
await browser.close()
