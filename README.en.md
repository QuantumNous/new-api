<p align="right">
   <a href="./README.md">中文</a> | <strong>English</strong>
</p>
<div align="center">

![new-api](/web/public/logo.png)

# New API

🍥 Next-Generation Large Model Gateway and AI Asset Management System

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

## 📝 Project Description

> [!NOTE]  
> This is an open-source project developed based on [One API](https://github.com/songquanpeng/one-api)

> [!IMPORTANT]  
> - This project is for personal learning purposes only, with no guarantee of stability or technical support.
> - Users must comply with OpenAI's [Terms of Use](https://openai.com/policies/terms-of-use) and **applicable laws and regulations**, and must not use it for illegal purposes.
> - According to the [《Interim Measures for the Management of Generative Artificial Intelligence Services》](http://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm), please do not provide any unregistered generative AI services to the public in China.

## 📚 Documentation

For detailed documentation, please visit our official Wiki: [https://docs.newapi.pro/](https://docs.newapi.pro/)

## ✨ Key Features

New API offers a wide range of features, please refer to [Features Introduction](https://docs.newapi.pro/wiki/features-introduction) for details:

1. 🎨 Brand new UI interface
2. 🌍 Multi-language support
3. 💰 Online recharge functionality (YiPay)
4. 🔍 Support for querying usage quotas with keys (works with [neko-api-key-tool](https://github.com/Calcium-Ion/neko-api-key-tool))
5. 🔄 Compatible with the original One API database
6. 💵 Support for pay-per-use model pricing
7. ⚖️ Support for weighted random channel selection
8. 📈 Data dashboard (console)
9. 🔒 Token grouping and model restrictions
10. 🤖 Support for more authorization login methods (LinuxDO, Telegram, OIDC)
11. 🔄 Support for Rerank models (Cohere and Jina), [API Documentation](https://docs.newapi.pro/api/jinaai-rerank)
12. ⚡ Support for OpenAI Realtime API (including Azure channels), [API Documentation](https://docs.newapi.pro/api/openai-realtime)
13. ⚡ Support for Claude Messages format, [API Documentation](https://docs.newapi.pro/api/anthropic-chat)
14. Support for entering chat interface via /chat2link route
15. 🧠 Support for setting reasoning effort through model name suffixes:
    1. OpenAI o-series models
        - Add `-high` suffix for high reasoning effort (e.g.: `o3-mini-high`)
        - Add `-medium` suffix for medium reasoning effort (e.g.: `o3-mini-medium`)
        - Add `-low` suffix for low reasoning effort (e.g.: `o3-mini-low`)
    2. Claude thinking models
        - Add `-thinking` suffix to enable thinking mode (e.g.: `claude-3-7-sonnet-20250219-thinking`)
16. 🔄 Thinking-to-content functionality
17. 🔄 Model rate limiting for users
18. 💰 Cache billing support, which allows billing at a set ratio when cache is hit:
    1. Set the `Prompt Cache Ratio` option in `System Settings-Operation Settings`
    2. Set `Prompt Cache Ratio` in the channel, range 0-1, e.g., setting to 0.5 means billing at 50% when cache is hit
    3. Supported channels:
        - [x] OpenAI
        - [x] Azure
        - [x] DeepSeek
        - [x] Claude

## Model Support

This version supports multiple models, please refer to [API Documentation-Relay Interface](https://docs.newapi.pro/api) for details:

1. Third-party models **gpts** (gpt-4-gizmo-*)
2. Third-party channel [Midjourney-Proxy(Plus)](https://github.com/novicezk/midjourney-proxy) interface, [API Documentation](https://docs.newapi.pro/api/midjourney-proxy-image)
3. Third-party channel [Suno API](https://github.com/Suno-API/Suno-API) interface, [API Documentation](https://docs.newapi.pro/api/suno-music)
4. Custom channels, supporting full call address input
5. Rerank models ([Cohere](https://cohere.ai/) and [Jina](https://jina.ai/)), [API Documentation](https://docs.newapi.pro/api/jinaai-rerank)
6. Claude Messages format, [API Documentation](https://docs.newapi.pro/api/anthropic-chat)
7. Dify, currently only supports chatflow

## Environment Variable Configuration

For detailed configuration instructions, please refer to [Installation Guide-Environment Variables Configuration](https://docs.newapi.pro/installation/environment-variables):

- `GENERATE_DEFAULT_TOKEN`: Whether to generate initial tokens for newly registered users, default is `false`
- `STREAMING_TIMEOUT`: Streaming response timeout, default is 60 seconds
- `DIFY_DEBUG`: Whether to output workflow and node information for Dify channels, default is `true`
- `FORCE_STREAM_OPTION`: Whether to override client stream_options parameter, default is `true`
- `GET_MEDIA_TOKEN`: Whether to count image tokens, default is `true`
- `GET_MEDIA_TOKEN_NOT_STREAM`: Whether to count image tokens in non-streaming cases, default is `true`
- `UPDATE_TASK`: Whether to update asynchronous tasks (Midjourney, Suno), default is `true`
- `COHERE_SAFETY_SETTING`: Cohere model safety settings, options are `NONE`, `CONTEXTUAL`, `STRICT`, default is `NONE`
- `GEMINI_VISION_MAX_IMAGE_NUM`: Maximum number of images for Gemini models, default is `16`
- `MAX_FILE_DOWNLOAD_MB`: Maximum file download size in MB, default is `20`
- `CRYPTO_SECRET`: Encryption key used for encrypting database content
- `AZURE_DEFAULT_API_VERSION`: Azure channel default API version, default is `2025-04-01-preview`
- `NOTIFICATION_LIMIT_DURATION_MINUTE`: Notification limit duration, default is `10` minutes
- `NOTIFY_LIMIT_COUNT`: Maximum number of user notifications within the specified duration, default is `2`

## Deployment

For detailed deployment guides, please refer to [Installation Guide-Deployment Methods](https://docs.newapi.pro/installation):

> [!TIP]
> Latest Docker image: `calciumion/new-api:latest`

### Multi-machine Deployment Considerations
- Environment variable `SESSION_SECRET` must be set, otherwise login status will be inconsistent across multiple machines
- If sharing Redis, `CRYPTO_SECRET` must be set, otherwise Redis content cannot be accessed across multiple machines

### Deployment Requirements
- Local database (default): SQLite (Docker deployment must mount the `/data` directory)
- Remote database: MySQL version >= 5.7.8, PgSQL version >= 9.6

### Deployment Methods

#### Using BaoTa Panel Docker Feature
Install BaoTa Panel (version **9.2.0** or above), find **New-API** in the application store and install it.
[Tutorial with images](./docs/BT.md)

#### Using Docker Compose (Recommended)
```shell
# Download the project
git clone https://github.com/Calcium-Ion/new-api.git
cd new-api
# Edit docker-compose.yml as needed
# Start
docker-compose up -d
```

#### Using Docker Image Directly
```shell
# Using SQLite
docker run --name new-api -d --restart always -p 3000:3000 -e TZ=Asia/Shanghai -v /home/ubuntu/data/new-api:/data calciumion/new-api:latest

# Using MySQL
docker run --name new-api -d --restart always -p 3000:3000 -e SQL_DSN="root:123456@tcp(localhost:3306)/oneapi" -e TZ=Asia/Shanghai -v /home/ubuntu/data/new-api:/data calciumion/new-api:latest
```

## Channel Retry and Cache
Channel retry functionality has been implemented, you can set the number of retries in `Settings->Operation Settings->General Settings`. It is **recommended to enable caching**.

### Cache Configuration Method
1. `REDIS_CONN_STRING`: Set Redis as cache
2. `MEMORY_CACHE_ENABLED`: Enable memory cache (no need to set manually if Redis is set)

## API Documentation

For detailed API documentation, please refer to [API Documentation](https://docs.newapi.pro/api):

- [Chat API](https://docs.newapi.pro/api/openai-chat)
- [Image API](https://docs.newapi.pro/api/openai-image)
- [Rerank API](https://docs.newapi.pro/api/jinaai-rerank)
- [Realtime API](https://docs.newapi.pro/api/openai-realtime)
- [Claude Chat API (messages)](https://docs.newapi.pro/api/anthropic-chat)

## Related Projects
- [One API](https://github.com/songquanpeng/one-api): Original project
- [Midjourney-Proxy](https://github.com/novicezk/midjourney-proxy): Midjourney interface support
- [chatnio](https://github.com/Deeptrain-Community/chatnio): Next-generation AI one-stop B/C-end solution
- [neko-api-key-tool](https://github.com/Calcium-Ion/neko-api-key-tool): Query usage quota with key

Other projects based on New API:
- [new-api-horizon](https://github.com/Calcium-Ion/new-api-horizon): High-performance optimized version of New API
- [VoAPI](https://github.com/VoAPI/VoAPI): Frontend beautified version based on New API

## Help and Support

If you have any questions, please refer to [Help and Support](https://docs.newapi.pro/support):
- [Community Interaction](https://docs.newapi.pro/support/community-interaction)
- [Issue Feedback](https://docs.newapi.pro/support/feedback-issues)
- [FAQ](https://docs.newapi.pro/support/faq)

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Calcium-Ion/new-api&type=Date)](https://star-history.com/#Calcium-Ion/new-api&Date)
