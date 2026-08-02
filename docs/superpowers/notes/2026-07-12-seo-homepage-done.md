# 首页 SEO — 完成记录

**Date:** 2026-07-12  
**Status:** Done / ready for next feature

## 摘要
SPA 首页 SEO：可配置标题（完整长尾或「系统名 - 后缀」）、描述/关键词/站点 URL/OG 图、robots/sitemap、JSON-LD；default 完整实现，classic 轻量对齐。合并友好，独立模块为主。

## 文档
- Spec: `docs/superpowers/specs/2026-07-12-seo-homepage-design.md`
- Plan: `docs/superpowers/plans/2026-07-12-seo-homepage.md`

## 关键入口
- `common/seo.go` — 变量与默认长尾
- `controller/seo.go` — `/robots.txt` `/sitemap.xml`
- `web/src/lib/seo/*` — DOM meta 应用
- 设置：系统信息 SEO 字段；classic OtherSetting

## 标题配置

| 项 | 说明 |
|----|------|
| `SEO.Title` | 完整标题（长尾） |
| `SEO.TitleSuffix` | 与 SystemName 拼接 |
| 都空 | 内置默认长尾后缀 |

## 备注
- 无 SSR；首屏靠 index.html + 运行时 status 覆盖
- 合并上游时关注 option/status/main.tsx/index.html 薄 diff
