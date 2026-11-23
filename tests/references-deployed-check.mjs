import { chromium } from 'playwright-core'
import path from 'node:path'
const root = path.resolve('muqtataf')
const raw = `Ù„Ù… Ø£Ø¬Ø¯ ÙÙŠ Ø§Ù„ØµÙØ­Ø© Ø§Ù„Ù…Ø±ÙÙ‚Ø© ØªØ¹Ø±ÙŠÙØ§Ù‹ Ù„Ù…ÙÙ‡ÙˆÙ… Ø§Ù„Ù‚ÙŠØ§Ø¯Ø© Ø§Ù„ØªØ­ÙˆÙŠÙ„ÙŠØ©Ø› ÙØ§Ù„ØµÙØ­Ø© (48) Ù…Ø®ØµØµØ© Ù„Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ù…ØµØ§Ø¯Ø± ÙˆØ§Ù„Ù…Ø±Ø§Ø¬Ø¹.

ØªÙØ¹Ø±Ù‘Ù Ø§Ù„Ù‚ÙŠØ§Ø¯Ø© Ø§Ù„ØªØ­ÙˆÙŠÙ„ÙŠØ© Ø¨Ø£Ù†Ù‡Ø§ Ø¹Ù…Ù„ÙŠØ© ØªØ£Ø«ÙŠØ± Ù…ØªØ¨Ø§Ø¯Ù„ Ø¨ÙŠÙ† Ø§Ù„Ù‚Ø§Ø¦Ø¯ ÙˆØ§Ù„Ø£ØªØ¨Ø§Ø¹ØŒ ØªÙ‚ÙˆÙ… Ø¹Ù„Ù‰ Ø§Ù„Ø¥Ù„Ù‡Ø§Ù… ÙˆØ§Ù„ØªØ­ÙÙŠØ² Ø§Ù„ÙÙƒØ±ÙŠ ÙˆØ§Ù„Ø§Ù‡ØªÙ…Ø§Ù… Ø§Ù„ÙØ±Ø¯ÙŠ (Ø§Ù„Ø¹ÙˆØ§ÙˆØ¯Ø©ØŒ 2017: 49). ÙˆØªØ±ÙƒØ² Ø¹Ù„Ù‰ ØªØ­ÙˆÙŠÙ„ Ø§Ù„Ù‚ÙŠÙ… ÙˆØ§Ù„Ø§ØªØ¬Ø§Ù‡Ø§Øª ÙˆØ§Ù„Ø³Ù„ÙˆÙƒÙŠØ§Øª Ù†Ø­Ùˆ Ø£Ø¯Ø§Ø¡ ÙŠØªØ¬Ø§ÙˆØ² Ø§Ù„ØªÙˆÙ‚Ø¹Ø§Øª (Ø§Ù„Ø¹ÙˆØ§ÙˆØ¯Ø©ØŒ 2017: 49).

Ø§Ù„Ù…Ø±Ø§Ø¬Ø¹
Ø§Ù„Ø¹ÙˆØ§ÙˆØ¯Ø©ØŒ Ù…Ø­Ù…Ø¯ (2017). Ø§Ù„Ù‚ÙŠØ§Ø¯Ø© Ø§Ù„ØªØ­ÙˆÙŠÙ„ÙŠØ©. Ø±Ø³Ø§Ù„Ø© Ù…Ø§Ø¬Ø³ØªÙŠØ±ØŒ Ø¬Ø§Ù…Ø¹Ø© Ø¨ØºØ¯Ø§Ø¯ØŒ Ø§Ù„Ø¹Ø±Ø§Ù‚.`

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 1100 } })
let chatPayload = null
let chatCalls = 0
page.on('pageerror', (e) => console.log('PAGE_ERROR=', e.message))
await page.route('https://api.deepseek.com/v1/tools/ocr', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization' } })
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ page_count: 3, pages: [
    { index: 0, text: 'Ø¬Ø§Ù…Ø¹Ø© Ø¨ØºØ¯Ø§Ø¯\nØ§Ù„Ù‚ÙŠØ§Ø¯Ø© Ø§Ù„ØªØ­ÙˆÙŠÙ„ÙŠØ©\nØ¥Ø¹Ø¯Ø§Ø¯ Ø§Ù„Ø·Ø§Ù„Ø¨: Ù…Ø­Ù…Ø¯ Ø§Ù„Ø¹ÙˆØ§ÙˆØ¯Ø©\n2017\nØ§Ù„Ø¹Ø±Ø§Ù‚', finish_reason: 'stop' },
    { index: 1, text: '48\nÙ‚Ø§Ø¦Ù…Ø© Ø§Ù„Ù…ØµØ§Ø¯Ø± ÙˆØ§Ù„Ù…Ø±Ø§Ø¬Ø¹\nØ§Ù„Ø¹ÙˆØ§ÙˆØ¯Ø©ØŒ Ù…Ø­Ù…Ø¯ (2017). Ø§Ù„Ù‚ÙŠØ§Ø¯Ø© Ø§Ù„ØªØ­ÙˆÙŠÙ„ÙŠØ©. Ø±Ø³Ø§Ù„Ø© Ù…Ø§Ø¬Ø³ØªÙŠØ±ØŒ Ø¬Ø§Ù…Ø¹Ø© Ø¨ØºØ¯Ø§Ø¯.\nÙƒØªØ§Ø¨ Ø§Ù„Ù‚ÙŠØ§Ø¯Ø© Ø§Ù„ØªØ­ÙˆÙŠÙ„ÙŠØ© (2015).\nØ¯Ø±Ø§Ø³Ø© Ø§Ù„Ù‚ÙŠØ§Ø¯Ø© Ø§Ù„ØªØ­ÙˆÙŠÙ„ÙŠØ© (2014).', finish_reason: 'stop' },
    { index: 2, text: '49\nØªØ¹Ø±ÙŠÙ Ø§Ù„Ù‚ÙŠØ§Ø¯Ø© Ø§Ù„ØªØ­ÙˆÙŠÙ„ÙŠØ©\nØªÙØ¹Ø±Ù‘Ù Ø§Ù„Ù‚ÙŠØ§Ø¯Ø© Ø§Ù„ØªØ­ÙˆÙŠÙ„ÙŠØ© Ø¨Ø£Ù†Ù‡Ø§ Ø¹Ù…Ù„ÙŠØ© ØªØ£Ø«ÙŠØ± Ù…ØªØ¨Ø§Ø¯Ù„ Ø¨ÙŠÙ† Ø§Ù„Ù‚Ø§Ø¦Ø¯ ÙˆØ§Ù„Ø£ØªØ¨Ø§Ø¹ØŒ ØªÙ‚ÙˆÙ… Ø¹Ù„Ù‰ Ø§Ù„Ø¥Ù„Ù‡Ø§Ù… ÙˆØ§Ù„ØªØ­ÙÙŠØ² Ø§Ù„ÙÙƒØ±ÙŠ ÙˆØ§Ù„Ø§Ù‡ØªÙ…Ø§Ù… Ø§Ù„ÙØ±Ø¯ÙŠØŒ ÙˆØªØ±ÙƒØ² Ø¹Ù„Ù‰ ØªØ­ÙˆÙŠÙ„ Ø§Ù„Ù‚ÙŠÙ… ÙˆØ§Ù„Ø§ØªØ¬Ø§Ù‡Ø§Øª ÙˆØ§Ù„Ø³Ù„ÙˆÙƒÙŠØ§Øª Ù†Ø­Ùˆ Ø£Ø¯Ø§Ø¡ ÙŠØªØ¬Ø§ÙˆØ² Ø§Ù„ØªÙˆÙ‚Ø¹Ø§Øª.', finish_reason: 'stop' },
  ], usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 } }) })
})
await page.route('https://api.deepseek.com/chat/completions', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization,content-type' } })
  chatCalls += 1
  chatPayload = route.request().postDataJSON()
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ choices: [{ message: { content: raw }, finish_reason: 'stop' }], usage: { prompt_tokens: 2000, completion_tokens: 500, total_tokens: 2500 } }) })
})
await page.goto('https://nhadalqysy985-oss.github.io/muqtataf/', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', path.join(root, 'tests/fixtures/study1.pdf'))
await page.fill('#topic', 'Ø§Ù„Ù‚ÙŠØ§Ø¯Ø© Ø§Ù„ØªØ­ÙˆÙŠÙ„ÙŠØ©')
await page.fill('.api-input input', 'sk-mock')
await page.click('button.start-button')
await page.waitForSelector('.research-card', { timeout: 60000 })
console.log('SOURCES=', (await page.locator('.research-citations').textContent())?.replace(/\s+/g, ' ').trim())
await page.fill('#research-request', 'Ø§ÙƒØªØ¨ ØªØ¹Ø±ÙŠÙØ§Øª Ø§Ù„Ù‚ÙŠØ§Ø¯Ø© Ø§Ù„ØªØ­ÙˆÙŠÙ„ÙŠØ©')
await page.click('.research-write')
await page.waitForSelector('.research-output', { timeout: 60000 })
console.log('RAW_START'); console.log(raw); console.log('RAW_END')
console.log('CLEANED_START'); console.log(await page.locator('.research-output').textContent()); console.log('CLEANED_END')
console.log('STATS=', (await page.locator('.research-stats').textContent())?.replace(/\s+/g, ' ').trim())
console.log('WARNINGS=', (await page.locator('.research-content-warning').count()) > 0 ? (await page.locator('.research-content-warning').textContent())?.replace(/\s+/g, ' ').trim() : 'none')
const system = chatPayload?.messages?.[0]?.content || ''
const userContent = chatPayload?.messages?.[1]?.content || []
console.log('SYSTEM_HAS_REFERENCE_PAGE=', system.includes('Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ù…ØµØ§Ø¯Ø± ÙˆØ§Ù„Ù…Ø±Ø§Ø¬Ø¹'))
console.log('SYSTEM_HAS_CONTENT_49=', system.includes('Ø¹Ù…Ù„ÙŠØ© ØªØ£Ø«ÙŠØ± Ù…ØªØ¨Ø§Ø¯Ù„'))
console.log('IMAGE_COUNT=', userContent.filter((p) => p.type === 'image_url').length)
console.log('IMAGE_LABELS=', userContent.filter((p) => p.type === 'text').map((p) => p.text).filter((t) => t.includes('ØµÙˆØ±Ø© Ù…Ù† Ø§Ù„Ù…ØµØ¯Ø±')))
console.log('CHAT_CALLS=', chatCalls)
await page.screenshot({ path: path.join(root, 'tests/screenshots/30-references-fix.png'), fullPage: false })
await browser.close()

