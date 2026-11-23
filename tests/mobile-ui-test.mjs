import { chromium } from 'playwright-core'
import path from 'node:path'
const root = path.resolve('muqtataf')
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 1600 }, isMobile: true })
await page.route('https://api.deepseek.com/v1/tools/ocr', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization' } })
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ page_count: 2, pages: [
    { index: 0, text: 'دور القيادة التحويلية في الأداء المؤسسي\nإعداد الطالب: أحمد علي\nجامعة بغداد\nكلية الإدارة والاقتصاد\n2026\nالعراق', finish_reason: 'stop' },
    { index: 1, text: '112\nالقيادة التحويلية\nيعتمد الإبداع التنظيمي على توليد الأفكار الجديدة وتطبيقها، ويتحقق عبر الأصالة والمرونة.', finish_reason: 'stop' },
  ], usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } }) })
})
await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', [path.join(root, 'tests/fixtures/study1.pdf'), path.join(root, 'tests/fixtures/study2.pdf'), path.join(root, 'tests/fixtures/soltani.pdf')])
await page.waitForTimeout(300)
console.log('FILE_ROWS=', await page.locator('.file-row').count())
console.log('COLLAPSED=', await page.locator('.file-list-collapsed').count())
await page.fill('#topic', 'القيادة التحويلية')
await page.fill('.api-input input', 'sk-mock')
await page.click('button.start-button')
await page.waitForSelector('.result-card', { timeout: 60000 })
await page.waitForTimeout(500)
console.log('CARDS=', await page.locator('.result-card').count())
console.log('BADGE_BOX=', await page.locator('.result-badge').first().boundingBox())
console.log('TITLE_BOX=', await page.locator('.result-ident h3').first().boundingBox())
console.log('AUDIT_OPEN=', await page.locator('.cover-audit').first().evaluate((el) => el.hasAttribute('open')))
await page.screenshot({ path: path.join(root, 'tests/screenshots/33-mobile-ui.png'), fullPage: false })
await page.locator('.result-card').first().scrollIntoViewIfNeeded()
await page.screenshot({ path: path.join(root, 'tests/screenshots/34-mobile-card.png'), fullPage: false })
await browser.close()
