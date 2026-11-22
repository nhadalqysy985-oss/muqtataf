import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.click('.ocr-link')
await page.waitForSelector('.ocr-modal')
console.log('overflow=', await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth))
await page.screenshot({ path: 'muqtataf/tests/screenshots/21-ocr-mobile.png', fullPage: false })
await browser.close()
