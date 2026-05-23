# 项目介绍

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/guide/wiki/basic-concepts/project-introduction.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/guide/wiki/basic-concepts/project-introduction.mdx

## 页面大纲

  - 概述
    - 核心特性
  - 许可证
    - 开源许可证（AGPLv3）
    - 商业授权
    - 贡献
    - 附加条款
  - 免责声明

## 原文内容

---
title: 项目介绍
description: 了解 New API，面向合法授权场景的 AI API 网关与用量管理系统
---
import { Callout } from 'fumadocs-ui/components/callout';

<div className="my-8 text-center">
  <img
    src="../../../assets/logo.png"
    alt="New API Logo"
    className="mx-auto"
    width="120"
    height="120"
  />
  <h1 className="mt-4 mb-2 text-4xl font-bold">New API</h1>
  <img
    src="../../../assets/trendshift.svg"
    alt="NewAPI Trendshift Badge"
    className="mx-auto mt-4"
    style={{ width: '250px', height: '55px' }}
    width="250"
    height="55"
  />
</div>

## 概述

New API 是面向合法授权场景的 AI API 网关与用量管理系统，为您的 AI 应用提供统一的基础设施，默认面向自用、团队内部和企业私有化部署。

<Callout type="info">
  New API 无缝集成全球主流 AI 服务提供商，包括 OpenAI、Anthropic、Google
  Gemini、DeepSeek、Midjourney、Suno 等 30+ 模型服务。
</Callout>

### 核心特性

- **统一接口**：在合法授权的上游账号和服务范围内，提供统一 API 入口，兼容 OpenAI 标准格式
- **智能路由**：多渠道负载均衡、故障自动切换、加权随机分发
- **成本管理**：组织内成本分摊和企业客户账务管理能力
- **安全管控**：令牌权限管理、模型访问控制、API 调用审计
- **数据洞察**：实时数据看板、用量统计、成本分析
- **多租户架构**：适配自用、团队内部和企业私有化部署

## 许可证

New API 采用 **GNU AGPLv3** 开源协议，只要遵守开源协议即可免费使用。

<Callout type="warn">
  在使用 New API 之前，请阅读[项目
  LICENSE](https://github.com/QuantumNous/new-api/blob/main/LICENSE)
  中的完整许可条款。
</Callout>

### 开源许可证（AGPLv3）

在 AGPLv3 下，您可以自由地使用、修改和分发 New API。

**主要条款：**

- 可自由使用、修改和分发
- 完整许可文本：[GNU AGPLv3](https://www.gnu.org/licenses/agpl-3.0.html)
- **核心义务**：如果您修改并作为网络服务（SaaS）部署，您必须在 AGPLv3 下提供完整的源代码

### 商业授权

如果您所在的组织政策不允许使用 AGPLv3 许可的软件，或您希望规避 AGPLv3 的开源义务，请发送邮件至：[support@quantumnous.com](mailto:support@quantumnous.com)

### 贡献

所有对 New API 的贡献均在 AGPLv3 下授权。

**提交贡献即表示：**

- 您的代码在 AGPLv3 下授权给本项目和所有用户
- 您保留贡献的版权

### 附加条款

- 许可证政策可能通过官方渠道（GitHub、网站）更新
- 如有争议，请参阅正式的 [LICENSE](https://github.com/QuantumNous/new-api/blob/main/LICENSE) 文档

## 免责声明

<Callout type="error">在使用 New API 之前，请阅读并理解这些重要声明。</Callout>

**1. 合法授权与合规使用**

用户必须合法取得上游 API Key、模型服务和其他第三方服务授权，并遵守上游服务条款和平台规则。使用本项目时，应确保相关场景符合法律法规、监管要求和内容安全要求。详见[合规与可接受使用政策](/zh/docs/legal/acceptable-use)。

**2. AI 提供商服务条款**

用户必须遵守所有适用的 AI 提供商服务条款，包括 [OpenAI 使用条款](https://openai.com/policies/terms-of-use)、Anthropic 政策以及其他相关提供商协议。

**3. 教育和个人用途**

本项目主要用于个人学习和研究。不保证稳定性，开源许可证下可能不提供官方技术支持。

**4. AI 法规合规**

用户必须遵守相关 AI 法规，包括[《生成式人工智能服务管理暂行办法》](http://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm)和其他适用的 AI 治理框架。

**5. 公众服务义务**

如用户面向不特定公众提供生成式 AI 服务，应自行完成所在地法律法规要求的备案、内容安全、身份管理、日志留存、税务、支付、消费者保护及上游授权等合规义务。

**6. 地方法律法规**

用户有责任确保遵守适用于其司法管辖区和使用场景的所有地方、国家和国际法律法规。

<Callout type="warn">
  New API
  按"原样"提供，不提供任何形式的保证。开发者和维护者对使用本软件产生的任何损害或法律问题不承担责任。
</Callout>
