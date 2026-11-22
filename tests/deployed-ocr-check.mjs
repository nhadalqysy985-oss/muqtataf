import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
const failed = []
page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`) })
await page.goto('https://nhadalqysy985-oss.github.io/muqtataf/', { waitUntil: 'networkidle', timeout: 60000 })
await page.click('.ocr-link')
console.log('modal=', await page.locator('.ocr-modal').isVisible(), 'topic=', await page.locator('#ocr-topic').count(), 'pdf-download=', await page.locator('.ocr-range').count())
console.log('failed=', failed)
await browser.close()
