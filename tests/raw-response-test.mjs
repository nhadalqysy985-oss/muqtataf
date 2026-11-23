import { chromium } from 'playwright-core'
import path from 'node:path'
const root = path.resolve('muqtataf')
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 1100 } })
const raw = `يُعدّ تقدير الذات من المفاهيم المركزية في علم النفس، إذ يعكس التقييم العام الذي يضعه الفرد لذاته ومدى ثقته بقدراته (شريط، 2022: ب). ويتأثر هذا التقييم بالتفاعلات الاجتماعية والخبرات الحياتية التي يمر بها الفرد، وقد يزداد تأثرًا في البيئات الرقمية التي تفرض مقارنات مستمرة (شريط، 2022: ب).

وترى الدراسة أن ضعف تقدير الذات لا ينفصل عن الضغوط النفسية والاجتماعية المحيطة، وأن تعزيزه يحتاج إلى تدخلات تربوية وأسرية متكاملة، لا إلى علاج فردي معزول (شريط، 2022: ب). ويستدعي ذلك إعادة النظر في الأدوار التربوية والإعلامية التي تشكّل صورة الفرد عن نفسه (شريط، 2022: ب).

المراجع
شريط، سليمة (2022). أثر تقدير الذات على الصحة النفسية. رسالة ماجستير، جامعة بغداد، العراق.`
await page.route('https://api.deepseek.com/v1/tools/ocr', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization' } })
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ page_count: 2, pages: [
    { index: 0, text: 'جامعة بغداد\nأثر تقدير الذات على الصحة النفسية\nإعداد الطالب: سليمةشريط\nالسنة الجامعية: 2021/2022\nالعراق', finish_reason: 'stop' },
    { index: 1, text: 'ب\nيتناول البحث موضوع تقدير الذات وأثره في الصحة النفسية.', finish_reason: 'stop' },
  ], usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 } }) })
})
await page.route('https://api.deepseek.com/chat/completions', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization,content-type' } })
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ choices: [{ message: { content: raw }, finish_reason: 'stop' }], usage: { prompt_tokens: 2200, completion_tokens: 300, total_tokens: 2500 } }) })
})
await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', path.join(root, 'tests/fixtures/study1.pdf'))
await page.fill('#topic', 'تقدير الذات')
await page.fill('.api-input input', 'sk-mock')
await page.click('button.start-button')
await page.waitForSelector('.research-card', { timeout: 60000 })
await page.fill('#research-request', 'اكتب عن تقدير الذات')
await page.click('.research-write')
await page.waitForSelector('.research-output', { timeout: 60000 })
console.log('RAW_START')
console.log(await page.locator('.research-output').textContent())
console.log('RAW_END')
console.log('STATS=', (await page.locator('.research-stats').textContent())?.replace(/\s+/g, ' ').trim())
console.log('VALIDATION=', (await page.locator('.research-validation').textContent())?.replace(/\s+/g, ' ').trim())
console.log('AUDIT=', (await page.locator('.cover-audit').textContent())?.replace(/\s+/g, ' ').trim())
await page.screenshot({ path: path.join(root, 'tests/screenshots/28-raw-response.png'), fullPage: false })
await browser.close()
