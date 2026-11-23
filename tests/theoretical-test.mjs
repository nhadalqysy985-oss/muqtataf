import { chromium } from 'playwright-core'
import path from 'node:path'
const root = path.resolve('muqtataf')
const raw = `يُعدّ الإبداع التنظيمي من المفاهيم التي تعتمد على توليد الأفكار الجديدة وتطبيقها (علي وآخرون، 2026: 112). وبلغ معامل ألفا كرونباخ 0.85، والمتوسط الحسابي 3.7 (علي وآخرون، 2026: 112). ويشير الإطار النظري إلى أن الإبداع يتحقق عبر الأصالة والمرونة (علي وآخرون، 2026: 112).`

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 1100 } })
let chatPayload = null
page.on('pageerror', (e) => console.log('PAGE_ERROR=', e.message))
await page.route('https://api.deepseek.com/v1/tools/ocr', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization' } })
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ page_count: 2, pages: [
    { index: 0, text: 'مفهوم الإبداع التنظيمي\nإعداد الطلاب: عبدالله فاضل علي، خالد جاسم محمد، رقية عبدالله محمد\nجامعة بغداد\n2026\nالعراق', finish_reason: 'stop' },
    { index: 1, text: '112\nالإبداع التنظيمي\nيعتمد الإبداع التنظيمي على توليد الأفكار الجديدة وتطبيقها، ويتحقق عبر الأصالة والمرونة.', finish_reason: 'stop' },
  ], usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } }) })
})
await page.route('https://api.deepseek.com/chat/completions', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization,content-type' } })
  chatPayload = route.request().postDataJSON()
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ choices: [{ message: { content: raw }, finish_reason: 'stop' }], usage: { prompt_tokens: 1000, completion_tokens: 200, total_tokens: 1200 } }) })
})
await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', path.join(root, 'tests/fixtures/study1.pdf'))
await page.fill('#topic', 'مفهوم الإبداع التنظيمي')
await page.fill('.api-input input', 'sk-mock')
await page.click('button.start-button')
await page.waitForSelector('.research-card', { timeout: 60000 })
console.log('CITATION=', (await page.locator('.research-citation').textContent())?.replace(/\s+/g, ' ').trim())
await page.fill('#research-request', 'اكتب عن مفهوم الإبداع التنظيمي')
await page.click('.research-write')
await page.waitForSelector('.research-output', { timeout: 60000 })
console.log('THEORY_OUTPUT=', (await page.locator('.research-output').textContent())?.replace(/\s+/g, ' ').trim())
console.log('THEORY_WARNINGS=', (await page.locator('.research-content-warning').textContent())?.replace(/\s+/g, ' ').trim())
let system = chatPayload?.messages?.[0]?.content || ''
console.log('PROMPT_THEORY_PRIORITY=', system.includes('قاعدة الأولوية النظرية'))
console.log('PROMPT_NO_PRACTICAL_SUFFIX=', system.includes('المستخدم لم يطلب نتائج ميدانية'))
console.log('PROMPT_TWO_AUTHOR_EXAMPLE=', system.includes('(علي وجاسم'))
console.log('PROMPT_THREE_AUTHOR_EXAMPLE=', system.includes('(علي وآخرون'))
await page.waitForFunction(() => !document.querySelector('.research-write')?.hasAttribute('disabled'))
await page.fill('#research-request', 'اعرض نتائج الدراسة الميدانية')
await page.waitForTimeout(100)
await page.click('.research-write')
await page.waitForTimeout(800)
console.log('PRACTICAL_OUTPUT_HAS_ALPHA=', (await page.locator('.research-output').textContent())?.includes('ألفا كرونباخ'))
system = chatPayload?.messages?.[0]?.content || ''
console.log('PROMPT_PRACTICAL_SUFFIX=', system.includes('طلب المستخدم صراحةً نتائج ميدانية'))
await page.screenshot({ path: path.join(root, 'tests/screenshots/32-theoretical.png'), fullPage: false })
await browser.close()

