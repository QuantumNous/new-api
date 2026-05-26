import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  buildHelpContent,
  normalizeMarkdown,
  shouldIncludeSource,
} from './build-content.mjs'

describe('static help content builder', () => {
  test('excludes administrator reference paths', () => {
    assert.equal(shouldIncludeSource('docs/reference-help-docs/newapi-ai/guide/feature-guide/admin/channel.md'), false)
    assert.equal(shouldIncludeSource('docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-get.md'), false)
    assert.equal(shouldIncludeSource('docs/reference-help-docs/ikuncode/guide/create-key.md'), true)
  })

  test('rewrites competitor names and marks image replacement positions', () => {
    const markdown = [
      '# 注册账号',
      '',
      '登录 IKunCode 平台并打开 New API 控制台。',
      '',
      '![注册页面](https://docs.ikuncode.cc/images/tu1.png)',
    ].join('\n')

    const result = normalizeMarkdown(markdown, {
      sourceTitle: '注册账号',
      sourcePath: 'docs/reference-help-docs/ikuncode/guide/registration.md',
    })

    assert.equal(result.includes('IKunCode'), false)
    assert.equal(result.includes('New API'), false)
    assert.equal(result.includes('aiapi114 平台'), true)
    assert.match(result, /> \[图片待替换：注册页面；来源 docs\/reference-help-docs\/ikuncode\/guide\/registration.md；原图 https:\/\/doc\.aiapi114\.com\/images\/tu1\.png\]/)
  })

  test('builds content.js with selected user-facing articles', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'aiapi114-help-'))
    const sourceDir = path.join(root, 'docs', 'reference-help-docs', 'ikuncode', 'guide')
    const outputFile = path.join(root, 'web', 'help-static', 'assets', 'content.js')
    await mkdir(sourceDir, { recursive: true })
    await mkdir(path.dirname(outputFile), { recursive: true })

    await writeFile(
      path.join(sourceDir, 'registration.md'),
      [
        '# 注册账号',
        '',
        '访问 IKunCode 官网完成注册：https://docs.ikuncode.cc/guide/create-key',
        '',
        '添加 api.ikuncode.cc 到白名单，截图 https://docs.codexzh.com/assets/1.jpg',
        '',
        '运行脚本：https://raw.githubusercontent.com/example/setup.sh',
        '',
        '![注册页面](https://example.com/register.png)',
      ].join('\n'),
      'utf8',
    )

    const result = await buildHelpContent({
      projectRoot: root,
      outputFile,
      sources: [
        {
          category: 'getting-started',
          slug: 'account-registration',
          title: '账号注册',
          summary: '完成 aiapi114 账号注册。',
          sourcePath: 'docs/reference-help-docs/ikuncode/guide/registration.md',
        },
      ],
    })

    const output = await readFile(outputFile, 'utf8')
    assert.equal(result.articleCount, 1)
    assert.match(output, /window\.AIAPI114_HELP_CONTENT = /)
    assert.match(output, /account-registration/)
    assert.match(output, /图片待替换/)
    assert.equal(output.includes('IKunCode'), false)
    assert.equal(output.includes('docs.ikuncode.cc'), false)
    assert.equal(output.includes('docs.codexzh.com'), false)
    assert.equal(output.includes('api.ikuncode.cc'), false)
    assert.equal(output.includes('raw.githubusercontent.com'), false)
  })

  test('static shell references generated content and app script', async () => {
    const helpRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    const html = await readFile(path.join(helpRoot, 'index.html'), 'utf8')
    const css = await readFile(path.join(helpRoot, 'assets', 'help.css'), 'utf8')
    const js = await readFile(path.join(helpRoot, 'assets', 'help.js'), 'utf8')

    assert.match(html, /assets\/content\.js/)
    assert.match(html, /assets\/help\.js/)
    assert.match(css, /--help-accent: #007840/)
    assert.match(js, /AIAPI114_HELP_CONTENT/)
    assert.match(js, /image-placeholder/)
  })
})
