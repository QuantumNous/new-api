<p align="right">
   <strong>中文</strong> | <a href="./README.en.md">English</a>
</p>
<div align="center">

![new-api](/web/public/logo.png)

# New API

🍥新一代大模型网关与AI资产管理系统

<a href="https://trendshift.io/repositories/8227" target="_blank"><img src="https://trendshift.io/api/badge/repositories/8227" alt="Calcium-Ion%2Fnew-api | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>

<p align="center">
  <a href="https://raw.githubusercontent.com/Calcium-Ion/new-api/main/LICENSE">
    <img src="https://img.shields.io/github/license/Calcium-Ion/new-api?color=brightgreen" alt="license">
  </a>
  <a href="https://github.com/Calcium-Ion/new-api/releases/latest">
    <img src="https://img.shields.io/github/v/release/Calcium-Ion/new-api?color=brightgreen&include_prereleases" alt="release">
  </a>
  <a href="https://github.com/users/Calcium-Ion/packages/container/package/new-api">
    <img src="https://img.shields.io/badge/docker-ghcr.io-blue" alt="docker">
  </a>
  <a href="https://hub.docker.com/r/CalciumIon/new-api">
    <img src="https://img.shields.io/badge/docker-dockerHub-blue" alt="docker">
  </a>
  <a href="https://goreportcard.com/report/github.com/Calcium-Ion/new-api">
    <img src="https://goreportcard.com/badge/github.com/Calcium-Ion/new-api" alt="GoReportCard">
  </a>
</p>
</div>

## 📝 项目说明

> [!NOTE]  
> 本项目为开源项目，在[One API](https://github.com/songquanpeng/one-api)的基础上进行二次开发

> [!IMPORTANT]  
> - 本项目仅供个人学习使用，不保证稳定性，且不提供任何技术支持。
> - 使用者必须在遵循 OpenAI 的[使用条款](https://openai.com/policies/terms-of-use)以及**法律法规**的情况下使用，不得用于非法用途。
> - 根据[《生成式人工智能服务管理暂行办法》](http://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm)的要求，请勿对中国地区公众提供一切未经备案的生成式人工智能服务。

## 📚 文档

详细文档请访问我们的官方Wiki：[https://docs.newapi.pro/](https://docs.newapi.pro/)

也可访问AI生成的DeepWiki:
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/QuantumNous/new-api)

## ✨ 主要特性

New API提供了丰富的功能，详细特性请参考[特性说明](https://docs.newapi.pro/wiki/features-introduction)：

1. 🎨 全新的UI界面
2. 🌍 多语言支持
3. 💰 支持在线充值功能（易支付）
4. 🔍 支持用key查询使用额度（配合[neko-api-key-tool](https://github.com/Calcium-Ion/neko-api-key-tool)）
5. 🔄 兼容原版One API的数据库
6. 💵 支持模型按次数收费
7. ⚖️ 支持渠道加权随机
8. 📈 数据看板（控制台）
9. 🔒 令牌分组、模型限制
10. 🤖 支持更多授权登陆方式（LinuxDO,Telegram、OIDC）
11. 🔄 支持Rerank模型（Cohere和Jina），[接口文档](https://docs.newapi.pro/api/jinaai-rerank)
12. ⚡ 支持OpenAI Realtime API（包括Azure渠道），[接口文档](https://docs.newapi.pro/api/openai-realtime)
13. ⚡ 支持Claude Messages 格式，[接口文档](https://docs.newapi.pro/api/anthropic-chat)
14. 支持使用路由/chat2link进入聊天界面
15. 🧠 支持通过模型名称后缀设置 reasoning effort：
    1. OpenAI o系列模型
        - 添加后缀 `-high` 设置为 high reasoning effort (例如: `o3-mini-high`)
        - 添加后缀 `-medium` 设置为 medium reasoning effort (例如: `o3-mini-medium`)
        - 添加后缀 `-low` 设置为 low reasoning effort (例如: `o3-mini-low`)
    2. Claude 思考模型
        - 添加后缀 `-thinking` 启用思考模式 (例如: `claude-3-7-sonnet-20250219-thinking`)
16. 🔄 思考转内容功能
17. 🔄 针对用户的模型限流功能
18. 💰 缓存计费支持，开启后可以在缓存命中时按照设定的比例计费：
    1. 在 `系统设置-运营设置` 中设置 `提示缓存倍率` 选项
    2. 在渠道中设置 `提示缓存倍率`，范围 0-1，例如设置为 0.5 表示缓存命中时按照 50% 计费
    3. 支持的渠道：
        - [x] OpenAI
        - [x] Azure
        - [x] DeepSeek
        - [x] Claude

## 模型支持

此版本支持多种模型，详情请参考[接口文档-中继接口](https://docs.newapi.pro/api)：

1. 第三方模型 **gpts** （gpt-4-gizmo-*）
2. 第三方渠道[Midjourney-Proxy(Plus)](https://github.com/novicezk/midjourney-proxy)接口，[接口文档](https://docs.newapi.pro/api/midjourney-proxy-image)
3. 第三方渠道[Suno API](https://github.com/Suno-API/Suno-API)接口，[接口文档](https://docs.newapi.pro/api/suno-music)
4. 自定义渠道，支持填入完整调用地址
5. Rerank模型（[Cohere](https://cohere.ai/)和[Jina](https://jina.ai/)），[接口文档](https://docs.newapi.pro/api/jinaai-rerank)
6. Claude Messages 格式，[接口文档](https://docs.newapi.pro/api/anthropic-chat)
7. Dify，当前仅支持chatflow

## 环境变量配置

详细配置说明请参考[安装指南-环境变量配置](https://docs.newapi.pro/installation/environment-variables)：

- `GENERATE_DEFAULT_TOKEN`：是否为新注册用户生成初始令牌，默认为 `false`
- `STREAMING_TIMEOUT`：流式回复超时时间，默认120秒
- `DIFY_DEBUG`：Dify渠道是否输出工作流和节点信息，默认 `true`
- `FORCE_STREAM_OPTION`：是否覆盖客户端stream_options参数，默认 `true`
- `GET_MEDIA_TOKEN`：是否统计图片token，默认 `true`
- `GET_MEDIA_TOKEN_NOT_STREAM`：非流情况下是否统计图片token，默认 `true`
- `UPDATE_TASK`：是否更新异步任务（Midjourney、Suno），默认 `true`
- `COHERE_SAFETY_SETTING`：Cohere模型安全设置，可选值为 `NONE`, `CONTEXTUAL`, `STRICT`，默认 `NONE`
- `GEMINI_VISION_MAX_IMAGE_NUM`：Gemini模型最大图片数量，默认 `16`
- `MAX_FILE_DOWNLOAD_MB`: 最大文件下载大小，单位MB，默认 `20`
- `CRYPTO_SECRET`：加密密钥，用于加密数据库内容
- `AZURE_DEFAULT_API_VERSION`：Azure渠道默认API版本，默认 `2025-04-01-preview`
- `NOTIFICATION_LIMIT_DURATION_MINUTE`：通知限制持续时间，默认 `10`分钟
- `NOTIFY_LIMIT_COUNT`：用户通知在指定持续时间内的最大数量，默认 `2`
- `ERROR_LOG_ENABLED=true`: 是否记录并显示错误日志，默认`false`

## 部署

详细部署指南请参考[安装指南-部署方式](https://docs.newapi.pro/installation)：

> [!TIP]
> 最新版Docker镜像：`calciumion/new-api:latest`  

### 多机部署注意事项
- 必须设置环境变量 `SESSION_SECRET`，否则会导致多机部署时登录状态不一致
- 如果公用Redis，必须设置 `CRYPTO_SECRET`，否则会导致多机部署时Redis内容无法获取

### 部署要求
- 本地数据库（默认）：SQLite（Docker部署必须挂载`/data`目录）
- 远程数据库：MySQL版本 >= 5.7.8，PgSQL版本 >= 9.6

### 部署方式

#### 使用宝塔面板Docker功能部署
安装宝塔面板（**9.2.0版本**及以上），在应用商店中找到**New-API**安装即可。
[图文教程](./docs/BT.md)

#### 使用Docker Compose部署（推荐）
```shell
# 下载项目
git clone https://github.com/Calcium-Ion/new-api.git
cd new-api
# 按需编辑docker-compose.yml
# 启动
docker-compose up -d
```

#### 直接使用Docker镜像
```shell
# 使用SQLite
docker run --name new-api -d --restart always -p 3000:3000 -e TZ=Asia/Shanghai -v /home/ubuntu/data/new-api:/data calciumion/new-api:latest

# 使用MySQL
docker run --name new-api -d --restart always -p 3000:3000 -e SQL_DSN="root:123456@tcp(localhost:3306)/oneapi" -e TZ=Asia/Shanghai -v /home/ubuntu/data/new-api:/data calciumion/new-api:latest
```

## 渠道重试与缓存
渠道重试功能已经实现，可以在`设置->运营设置->通用设置`设置重试次数，**建议开启缓存**功能。

### 缓存设置方法
1. `REDIS_CONN_STRING`：设置Redis作为缓存
2. `MEMORY_CACHE_ENABLED`：启用内存缓存（设置了Redis则无需手动设置）

## 接口文档

详细接口文档请参考[接口文档](https://docs.newapi.pro/api)：

- [聊天接口（Chat）](https://docs.newapi.pro/api/openai-chat)
- [图像接口（Image）](https://docs.newapi.pro/api/openai-image)
- [重排序接口（Rerank）](https://docs.newapi.pro/api/jinaai-rerank)
- [实时对话接口（Realtime）](https://docs.newapi.pro/api/openai-realtime)
- [Claude聊天接口（messages）](https://docs.newapi.pro/api/anthropic-chat)

## 相关项目
- [One API](https://github.com/songquanpeng/one-api)：原版项目
- [Midjourney-Proxy](https://github.com/novicezk/midjourney-proxy)：Midjourney接口支持
- [chatnio](https://github.com/Deeptrain-Community/chatnio)：下一代AI一站式B/C端解决方案
- [neko-api-key-tool](https://github.com/Calcium-Ion/neko-api-key-tool)：用key查询使用额度
- [aiproxy](https://github.com/labring/aiproxy)：下一代AI网关

其他基于New API的项目：
- [new-api-horizon](https://github.com/Calcium-Ion/new-api-horizon)：New API高性能优化版

## 帮助支持

如有问题，请参考[帮助支持](https://docs.newapi.pro/support)：
- [社区交流](https://docs.newapi.pro/support/community-interaction)
- [反馈问题](https://docs.newapi.pro/support/feedback-issues)
- [常见问题](https://docs.newapi.pro/support/faq)

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Calcium-Ion/new-api&type=Date)](https://star-history.com/#Calcium-Ion/new-api&Date)
