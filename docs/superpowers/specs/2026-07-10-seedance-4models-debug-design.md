# Seedance 四模型统一文档 + 调试页

日期：2026-07-10  
状态：已批准（方案 1 + 图床上传 + token 默认值 A）

## 目标

一次部署，对齐现网 4 个对外模型；本地文件经可配置图床转公网 URL；调试页按模型自动构建请求。

## 交付

| 路径 | 部署 URL |
|------|----------|
| `web/default/public/seedance-debug.html` | `/seedance-debug.html` |
| `web/default/public/docs/seedance-4models.md` | `/docs/seedance-4models.md` |

## 模型协议

| 模型 | 创建 | 查询 | 素材 |
|------|------|------|------|
| `37:seedance-2.0` / `37:seedance-2.0-fast` | `POST /v1/video/generations` | `GET /v1/video/generations/{id}` | 图床 URL → `images`（文生为主） |
| `doubao-seedance-2.0` | 同上 | 同上 | `content[]` 多模态 |
| `mingiz-sd2` | `POST /v1/videos` | `GET /v1/videos/{id}` | multipart 直传或 JSON `images` |

## 图床

- 默认 URL：`https://imageproxy.zhongzhuan.chat/api/upload`
- 默认 Token：页面内置（用户选 A）；可改，存 localStorage
- 响应：`{ "url": "...", "created": ... }`

## API Base

默认同源，页面可改。
