# 分析工具设置指南

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/guide/wiki/basic-concepts/analytics-setup.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/guide/wiki/basic-concepts/analytics-setup.mdx

## 页面大纲

    - 概述
    - 功能特点
    - Google Analytics 4 设置
      - 1. 获取你的测量 ID
      - 2. 配置环境变量
      - 3. 重启应用
- Docker Compose
- 独立部署
- 直接重启你的应用程序
    - Umami Analytics 设置
      - 1. 获取 Umami 凭据
      - 2. 配置环境变量
      - 3. 重启应用
    - 同时使用两种分析工具
    - 验证
    - 故障排除
- 检查环境变量是否设置
    - 隐私考虑
  - 环境变量参考
  - 相关链接

## 原文内容

---
title: 分析工具设置指南
---
### 概述

New API 现在支持与流行的分析平台集成，帮助你追踪用户行为和网站性能：

- **Google Analytics 4 (GA4)**：谷歌分析平台的最新版本
- **Umami Analytics**：注重隐私的开源分析工具

两种分析工具可以同时启用，互不冲突。

### 功能特点

✅ 零代码集成 - 仅通过环境变量配置  
✅ 自动注入脚本到 Web 界面  
✅ 支持 Docker 和独立部署  
✅ 注重隐私的实现方式  
✅ 无需修改前端代码

---

### Google Analytics 4 设置

#### 1. 获取你的测量 ID

1. 访问 [Google Analytics](https://analytics.google.com/)
2. 创建新的媒体资源或选择现有的
3. 进入 **管理** → **数据流**
4. 创建或选择一个网站数据流
5. 复制你的 **测量 ID**（格式：`G-XXXXXXXXXX`）

#### 2. 配置环境变量

**使用 Docker Compose：**

编辑 `docker-compose.yml` 文件，取消注释 Google Analytics 行：

```yaml
environment:
  - GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX # 替换为你的实际测量 ID
```

**独立部署：**

添加到 `.env` 文件或设置为环境变量：

```bash
export GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
```

**使用 Docker Run：**

```bash
docker run -d \
  -e GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX \
  ...其他选项...
  calciumion/new-api:latest
```

#### 3. 重启应用

```bash
# Docker Compose
docker-compose down && docker-compose up -d

# 独立部署
# 直接重启你的应用程序
```

---

### Umami Analytics 设置

#### 1. 获取 Umami 凭据

**选项 A：使用 Umami Cloud**

1. 在 [Umami Cloud](https://cloud.umami.is/) 注册
2. 添加一个新网站
3. 复制你的 **网站 ID**（UUID 格式）

**选项 B：自托管 Umami**

1. 部署你自己的 [Umami 实例](https://umami.is/docs/install)
2. 在仪表板中创建网站
3. 复制你的 **网站 ID** 和 **脚本 URL**

#### 2. 配置环境变量

**使用 Docker Compose：**

编辑 `docker-compose.yml` 文件：

```yaml
environment:
  - UMAMI_WEBSITE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  # 可选：仅自托管实例需要
  - UMAMI_SCRIPT_URL=https://<your-umami-domain>/script.js
```

**独立部署：**

添加到 `.env` 文件：

```bash
export UMAMI_WEBSITE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
export UMAMI_SCRIPT_URL=https://<your-umami-domain>/script.js  # 可选
```

**注意：** 如果使用 Umami Cloud，不需要设置 `UMAMI_SCRIPT_URL`，因为它默认使用官方 URL。

#### 3. 重启应用

与 Google Analytics 相同 - 重启应用以应用更改。

---

### 同时使用两种分析工具

你可以同时启用 Google Analytics 和 Umami：

```yaml
environment:
  - GOOGLE_ANALYTICS_ID=G-ABC123XYZ
  - UMAMI_WEBSITE_ID=a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6
  - UMAMI_SCRIPT_URL=https://analytics.umami.is/script.js
```

---

### 验证

重启应用后：

1. 在浏览器中打开 Web 界面
2. 打开浏览器开发者工具（F12）→ **网络**标签
3. 刷新页面
4. 查找以下请求：
   - Google Analytics：`https://www.googletagmanager.com/gtag/js`
   - Umami：你配置的脚本 URL

你也可以查看页面源代码，在 `<head>` 部分查找注入的脚本。

---

### 故障排除

**分析工具无法工作？**

1. ✅ 验证环境变量设置正确
2. ✅ 更改变量后重启应用
3. ✅ 检查浏览器控制台错误
4. ✅ 确保测量 ID/网站 ID 格式正确
5. ✅ 检查广告拦截器是否干扰

**Docker 用户：**

```bash
# 检查环境变量是否设置
docker exec new-api env | grep -E "GOOGLE_ANALYTICS|UMAMI"
```

---

### 隐私考虑

- Google Analytics 根据[谷歌隐私政策](https://policies.google.com/privacy)收集用户数据
- Umami 注重隐私，不收集个人数据
- 如果使用分析工具，请考虑在网站上添加隐私政策
- 两种工具在正确配置时都符合 GDPR 要求

---

## 环境变量参考

| 变量                  | 必需 | 默认值                                 | 说明                                             |
| --------------------- | ---- | -------------------------------------- | ------------------------------------------------ |
| `GOOGLE_ANALYTICS_ID` | 否   | -                                      | Google Analytics 4 测量 ID（格式：G-XXXXXXXXXX） |
| `UMAMI_WEBSITE_ID`    | 否   | -                                      | Umami 网站 ID（UUID 格式）                       |
| `UMAMI_SCRIPT_URL`    | 否   | `https://analytics.umami.is/script.js` | Umami 脚本 URL（仅自托管需要）                   |

---

## 相关链接

- [Google Analytics](https://analytics.google.com/)
- [Umami Analytics](https://umami.is/)
- [Umami Documentation](https://umami.is/docs)
- [Google Analytics Privacy](https://support.google.com/analytics/answer/6004245)
