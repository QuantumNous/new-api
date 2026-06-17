import { chromium } from 'playwright'

const BASE = 'http://localhost:17231'
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

const results = []
const log = (label, pass, detail='') => {
  results.push({ label, pass, detail })
  console.log(`${pass ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
}

// ── 1. Auth protection ──────────────────────────────────────────────────────
await page.goto(BASE, { waitUntil: 'networkidle' })
log('Home page loads', (await page.title()).length > 0, await page.title())

await page.goto(`${BASE}/skills`, { waitUntil: 'networkidle' })
log('/skills → sign-in when unauthenticated', page.url().includes('sign-in'), page.url())

await page.goto(`${BASE}/skills/my`, { waitUntil: 'networkidle' })
log('/skills/my → sign-in when unauthenticated', page.url().includes('sign-in'), page.url())

// ── 2. Login ────────────────────────────────────────────────────────────────
await page.goto(`${BASE}/sign-in`, { waitUntil: 'networkidle' })
await page.locator('input').nth(0).fill('root')
await page.locator('input[type="password"]').first().fill('12345678')
await page.locator('button:has-text("Sign in"), button[type="submit"]').first().click()
await page.waitForURL(u => !u.includes('sign-in'), { timeout: 10000 }).catch(() => {})
await page.waitForLoadState('networkidle')
await page.waitForTimeout(1500)
log('Login succeeded', !page.url().includes('sign-in'), page.url())

// ── 3. Sidebar order: PERSONAL before MARKETPLACE (CSS uppercase) ────────────
const bodyText = await page.evaluate(() => document.body.innerText.toUpperCase())
const personalIdx = bodyText.indexOf('PERSONAL')
const marketIdx = bodyText.indexOf('MARKETPLACE')
log('Sidebar: PERSONAL before MARKETPLACE',
  personalIdx >= 0 && marketIdx >= 0 && personalIdx < marketIdx,
  `personal@${personalIdx} marketplace@${marketIdx}`)

// ── 4. Sidebar nav links ────────────────────────────────────────────────────
const skillsLink = page.locator('a[href="/skills"]').first()
const mySkillsLink = page.locator('a[href="/skills/my"]').first()
log('Sidebar has Skills link', await skillsLink.isVisible().catch(() => false))
log('Sidebar has My Skills link', await mySkillsLink.isVisible().catch(() => false))

// ── 5. /skills page — sidebar stays, content renders ───────────────────────
await skillsLink.click()
await page.waitForLoadState('networkidle')
await page.screenshot({ path: '/tmp/04-skills-page.png' })
log('/skills URL correct', page.url().includes('/skills') && !page.url().includes('/skills/my'), page.url())
log('Sidebar stays on /skills (auth layout fix)', await page.locator('a[href="/skills"]').first().isVisible())
const skillsText = await page.evaluate(() => document.body.innerText)
log('/skills page shows Marketplace content', skillsText.includes('Marketplace') || skillsText.includes('Skill'), skillsText.substring(0,80))

// ── 6. /skills/my page ──────────────────────────────────────────────────────
await mySkillsLink.click()
await page.waitForLoadState('networkidle')
await page.screenshot({ path: '/tmp/05-my-skills.png' })
log('/skills/my URL correct', page.url().includes('/skills/my'), page.url())
log('Sidebar stays on /skills/my', await page.locator('a[href="/skills/my"]').first().isVisible())
const myText = await page.evaluate(() => document.body.innerText)
log('/skills/my shows My Skills content', myText.includes('My Skills'), '')

// ── 7. Cmd+K ────────────────────────────────────────────────────────────────
await page.keyboard.press('Control+k')
await page.waitForTimeout(1000)
await page.screenshot({ path: '/tmp/06-cmd-k.png' })
const dialog = page.locator('[role="dialog"]').first()
const cmdOpen = await dialog.isVisible().catch(() => false)
log('Cmd+K palette opens', cmdOpen)
if (cmdOpen) {
  const cmdText = await dialog.textContent().catch(() => '')
  log('Cmd+K shows Skills', cmdText.includes('Skills'), '')
  log('Cmd+K shows My Skills', cmdText.includes('My Skills'), '')
  log('Cmd+K shows Admin (root is admin, expected)', cmdText.includes('Channels') || cmdText.includes('Models'), '')
  await page.keyboard.press('Escape')
}

// ── 8. Admin → System Settings → Sidebar Modules config ─────────────────────
// SidebarModulesSection in /system-settings/site/sidebar-modules always shows
// all sections regardless of user permissions — correct place to verify DR-60
// added the marketplace group to the admin config.
const sysSettingsLink = page.locator('a[href*="system-settings"]').first()
await sysSettingsLink.click()
await page.waitForLoadState('networkidle')
await page.waitForTimeout(800)
await page.goto(`${BASE}/system-settings/site/sidebar-modules`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.screenshot({ path: '/tmp/07-sidebar-modules-admin.png' })
const adminText = await page.evaluate(() => document.body.innerText)
log('Admin Sidebar Modules has Marketplace Area section', adminText.includes('Marketplace Area'), '')
log('Admin Sidebar Modules has Skills entry', adminText.includes('Skills'), '')
log('Admin Sidebar Modules has My Skills entry', adminText.includes('My Skills'), '')

await browser.close()

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('\n── SUMMARY ──')
const passed = results.filter(r => r.pass).length
const failed = results.filter(r => !r.pass).length
console.log(`${passed} passed / ${failed} failed out of ${results.length} checks`)
if (failed > 0) {
  console.log('\nFailed:')
  results.filter(r => !r.pass).forEach(r => console.log(`  ❌ ${r.label}: ${r.detail}`))
}
process.exit(failed > 0 ? 1 : 0)
