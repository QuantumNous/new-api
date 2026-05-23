# Claude Code Hub (CCH)

> 来源：https://docs.ikuncode.cc/zh/tools/claude-code-hub
>
> 抓取时间：2026-05-23T07:09:46.142Z

## 页面大纲

- Claude Code Hub (CCH)
  - 🔗 相关链接
  - 🎯 工具介绍
  - ✨ 核心功能
  - 🛠️ 快速部署
    - 一键脚本部署
    - 客户端接入
  - 常见问题
    - CCH和CCS有什么区别？
    - CCH 和直接使用 API 有什么区别？

## 原文内容

# Claude Code Hub (CCH)

**团队级多供应商 AI Coding 代理调度平台**

## 🔗 相关链接

| 资源 | 地址 |
| --- | --- |
| 官网 | [claude-code-hub.app](https://claude-code-hub.app/) |
| 官方文档 | [claude-code-hub.app/docs](https://claude-code-hub.app/docs) |
| GitHub | [ding113/claude-code-hub](https://github.com/ding113/claude-code-hub) |

## 🎯 工具介绍

Claude Code Hub (CCH) 是一个服务器部署的多租户 AI Coding 工具调度平台，帮助团队统一管理 Claude、Codex、Gemini 等多家 AI 服务商，实现智能负载均衡与自动故障转移。

💡 适用场景

-   **敏捷开发团队**：多人共用 AI 工具，需要统一管理和用量追踪
-   **AI 驱动开发团队**：重度依赖 AI Coding，需要高可用和自动故障转移
-   **创业公司**：预算有限，需要精细的成本控制和多维限流
-   **中小软件公司**：需要合规审计、访问控制和完整日志

## ✨ 核心功能

-   **智能负载均衡**：权重 + 优先级 + 分组调度，内置熔断保护与最多 3 次自动故障转移
-   **多供应商管理**：同时接入 Claude、Codex、Gemini、OpenAI Compatible 等多种供应商
-   **限流与并发控制**：支持 RPM（每分钟请求数）、金额限制（5小时/周/月）、并发 Session 控制
-   **实时监控与统计**：仪表盘展示调用量、成本、活跃 Session 和供应商健康状态
-   **Session 管理**：5 分钟上下文缓存，同一会话自动路由到相同供应商，提高缓存命中率
-   **OpenAI 兼容层**：支持 `/v1/chat/completions` 端点，无缝对接现有工具链

## 🛠️ 快速部署

### 一键脚本部署

bash

```
# 使用官方部署脚本，5 分钟完成安装
curl -fsSL https://claude-code-hub.app/install.sh | bash
```

详细部署文档请参考：[脚本部署指南](https://claude-code-hub.app/docs/deployment/script)

### 客户端接入

部署完成后，将 Claude Code、Codex 等工具的 API 地址指向 CCH 代理即可使用。

详细接入文档请参考：[客户端接入指南](https://claude-code-hub.app/docs/deployment/client-setup)

## 常见问题

### CCH和CCS有什么区别？

CCH更适合团队内部使用，而CCS更适合个人用户。

### CCH 和直接使用 API 有什么区别？

CCH 提供了供应商故障自动切换、负载均衡、用量统计、Session 粘性等团队级功能，单人使用直接配 API 即可，多人协作推荐使用 CCH。
