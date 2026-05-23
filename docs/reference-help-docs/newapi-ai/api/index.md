# API 参考

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/api/index.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/api/index.mdx

## 页面大纲

  - 概述
  - AI 模型接口
  - 管理接口

## 原文内容

---
title: API 参考
description: New API 完整接口文档
---
import { Card, Cards } from 'fumadocs-ui/components/card';
import {
  List,
  MessageSquare,
  FileText,
  Database,
  Search,
  ShieldCheck,
  Headphones,
  Radio,
  Image,
  Video,
  FileQuestion,
  Server,
  SlidersHorizontal,
  UserCheck,
  Users,
  KeyRound,
  Link2,
  Network,
  Blocks,
  Key,
  Ticket,
  CreditCard,
  ScrollText,
  ChartBar,
  ListTodo,
  FolderKanban,
  Store,
  ShieldAlert,
} from 'lucide-react';

## 概述

New API 提供完整的 RESTful API 接口，分为 **AI 模型接口** 和 **管理接口** 两大类。您可以通过这些接口实现 AI 能力调用和系统管理功能。

<Callout title="在线调试">
  您可以访问 [Apifox 操练场](https://apifox.newapi.ai/) 在线测试和调试 API 接口，或浏览下方的 API 文档。
</Callout>

## AI 模型接口

AI 模型接口提供各种 AI 能力的调用，兼容 OpenAI API 格式。

<Cards>
  <Card
    icon={<List />}
    title="模型列表"
    description="获取可用的模型列表。"
    href="/zh/docs/api/ai-model/models/list/listmodels"
  />
  <Card
    icon={<MessageSquare />}
    title="聊天"
    description="对话补全接口。"
    href="/zh/docs/api/ai-model/chat/openai/createchatcompletion"
  />
  <Card
    icon={<FileText />}
    title="补全"
    description="传统文本补全接口。"
    href="/zh/docs/api/ai-model/completions/createcompletion"
  />
  <Card
    icon={<Database />}
    title="嵌入"
    description="文本嵌入向量生成接口。"
    href="/zh/docs/api/ai-model/embeddings/createembedding"
  />
  <Card
    icon={<Search />}
    title="重排序"
    description="文档重排序接口。"
    href="/zh/docs/api/ai-model/rerank/creatererank"
  />
  <Card
    icon={<ShieldCheck />}
    title="审查"
    description="内容安全审核接口。内容安全审核接口是合规工具之一，不替代部署方自身安全治理义务和上游内容政策要求。面向公众服务应建立滥用举报、日志审计和处置机制。"
    href="/zh/docs/api/ai-model/moderations/createmoderation"
  />
  <Card
    icon={<Headphones />}
    title="音频"
    description="语音识别和语音合成接口。"
    href="/zh/docs/api/ai-model/audio/openai/createspeech"
  />
  <Card
    icon={<Radio />}
    title="实时语音"
    description="实时音频流接口。"
    href="/zh/docs/api/ai-model/realtime/createrealtimesession"
  />
  <Card
    icon={<Image />}
    title="图像"
    description="AI图像生成接口。"
    href="/zh/docs/api/ai-model/images/openai/post-v1-images-generations"
  />
  <Card
    icon={<Video />}
    title="视频"
    description="AI视频生成接口。"
    href="/zh/docs/api/ai-model/videos/sora/createvideo"
  />
  <Card
    icon={<FileQuestion />}
    title="未实现"
    description="占位接口，暂未实现。"
    href="/zh/docs/api/ai-model/unimplemented/files/listfiles"
  />
</Cards>

## 管理接口

管理接口用于系统配置、用户管理、业务管理等后台操作。

<Cards>
  <Card
    icon={<Server />}
    title="系统"
    description="系统信息和状态接口。"
    href="/zh/docs/api/management/system/status-get"
  />
  <Card
    icon={<SlidersHorizontal />}
    title="系统设置"
    description="系统配置管理接口。"
    href="/zh/docs/api/management/system-settings/option-get"
  />
  <Card
    icon={<UserCheck />}
    title="用户认证"
    description="用户登录、注册、密码管理等接口。"
    href="/zh/docs/api/management/user-auth/user-login-post"
  />
  <Card
    icon={<Users />}
    title="用户管理"
    description="用户信息管理接口。"
    href="/zh/docs/api/management/user-management/user-self-get"
  />
  <Card
    icon={<KeyRound />}
    title="双因素认证"
    description="2FA 双因素认证接口。"
    href="/zh/docs/api/management/two-factor-auth/user-2fa-status-get"
  />
  <Card
    icon={<Link2 />}
    title="OAuth"
    description="第三方 OAuth 登录接口。"
    href="/zh/docs/api/management/oauth/oauth-github-get"
  />
  <Card
    icon={<Network />}
    title="渠道管理"
    description="API 渠道配置管理接口。"
    href="/zh/docs/api/management/channel-management/channel-get"
  />
  <Card
    icon={<Blocks />}
    title="模型管理"
    description="模型配置管理接口。"
    href="/zh/docs/api/management/model-management/models-get"
  />
  <Card
    icon={<Key />}
    title="令牌管理"
    description="API 令牌管理接口。"
    href="/zh/docs/api/management/token-management/token-get"
  />
  <Card
    icon={<Ticket />}
    title="兑换码"
    description="兑换码管理接口。"
    href="/zh/docs/api/management/redemption/redemption-get"
  />
  <Card
    icon={<CreditCard />}
    title="支付"
    description="支付和充值接口。"
    href="/zh/docs/api/management/payment/user-topup-info-get"
  />
  <Card
    icon={<ScrollText />}
    title="日志"
    description="使用日志查询接口。"
    href="/zh/docs/api/management/logs/log-get"
  />
  <Card
    icon={<ChartBar />}
    title="统计"
    description="数据统计接口。"
    href="/zh/docs/api/management/statistics/data-get"
  />
  <Card
    icon={<ListTodo />}
    title="任务"
    description="异步任务管理接口。"
    href="/zh/docs/api/management/tasks/task-get"
  />
  <Card
    icon={<FolderKanban />}
    title="分组"
    description="用户分组管理接口。"
    href="/zh/docs/api/management/groups/group-get"
  />
  <Card
    icon={<Store />}
    title="供应商"
    description="供应商管理接口。"
    href="/zh/docs/api/management/vendors/vendors-get"
  />
  <Card
    icon={<ShieldAlert />}
    title="安全验证"
    description="安全验证相关接口。"
    href="/zh/docs/api/management/security-verification/verify-status-get"
  />
</Cards>
