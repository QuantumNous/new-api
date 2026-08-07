import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const [data, config, types, navGroup, zh, consoleInjection] = await Promise.all(
  [
    readFile(new URL('src/hooks/use-sidebar-data.ts', root), 'utf8'),
    readFile(new URL('src/hooks/use-sidebar-config.ts', root), 'utf8'),
    readFile(new URL('src/components/layout/types.ts', root), 'utf8'),
    readFile(
      new URL('src/components/layout/components/nav-group.tsx', root),
      'utf8'
    ),
    readFile(new URL('src/i18n/locales/zh.json', root), 'utf8'),
    readFile(new URL('../../.deploy/landing/chimera-console.js', root), 'utf8'),
  ]
)
const zhTranslations = JSON.parse(zh).translation

for (const [key, label, url] of [
  ['Creative Studio', '创作 Studio', '/studio/'],
  ['Agent Management', '代理管理', '/agent/admin'],
  ['User Activity', '用户活跃', '/agent/active'],
  ['Regional Access', '地域访问', '/geo-admin/'],
  ['Image Routing', '图片路由', '/geo-admin/image-routing'],
]) {
  assert.ok(data.includes(`title: t('${key}')`), `${key} must use i18n`)
  assert.ok(
    data.includes(`url: '${url}'`),
    `${url} must be in native sidebar data`
  )
  assert.equal(zhTranslations[key], label)
  assert.ok(
    config.includes(`'${url}'`),
    `${url} must honor sidebar configuration`
  )
}

assert.match(types, /reloadDocument\?: boolean/)
assert.match(navGroup, /item\.reloadDocument/)
assert.match(data, /requiredRole: ROLE\.ADMIN/)
assert.match(consoleInjection, /\/api\/user\/auth\/refresh/)
assert.match(consoleInjection, /Authorization/)
assert.doesNotMatch(consoleInjection, /New-Api-User/)

console.log('native Chimera sidebar contract: ok')
