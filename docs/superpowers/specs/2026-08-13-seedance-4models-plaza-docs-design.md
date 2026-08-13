# Seedance 多模型 API 文档对齐模型大厅

日期：2026-08-13  
状态：已批准并落地

## 目标

按现网模型大厅（`/api/pricing`）重写对外文档 `seedance-4models.md`，只保留大厅在售模型；不同步改调试页与后端。

## 已确认决策

| 项 | 决策 |
|----|------|
| 范围 | 仅文档（default + classic `public/docs/seedance-4models.md`） |
| 旧模型 | 全部移除（含 MegaByAI / doubao-seedance-2.0 / sd2-431 等） |
| `seedance2.0-431` | **暂不写**（渠道归属未确认，且用户明确排除） |
| 结构 | 按协议族分章 + 顶部一览表 |

## 覆盖模型（现网）

1. `doubao-seedance-2.0` → `/v1/video/generations`（已替换原 `guanzhuan-*`）
2. `seedance2.0` / `seedance-2-mini-720p` → `/v1/videos`
3. `mingiz-sd2` / `mingiz-sd2-fast` → `/v1/videos`（含 multipart）
4. `seedance2.0-yk-special` → `/v1/video/generations`
5. `h3-zz` → `/v1/videos`（成片 `/content`）
6. `seedance2.0-431` 仍不写（渠道归属未确认）

## 交付路径

- `web/default/public/docs/seedance-4models.md`
- `web/classic/public/docs/seedance-4models.md`（与 default 同步）
- 线上：`https://996k.cn/docs/seedance-4models.md`（部署后生效）

## 非目标

- 不改 `seedance-debug.html`
- 不改渠道适配器 / 模型重定向
- 不把文档单价当作报价契约（注明以大厅为准）
