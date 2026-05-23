# 快速开始

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/index.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/index.mdx

## 页面大纲

  - 部署方式选择
  - 浏览我们的文档

## 原文内容

---
title: 快速开始
description: 选择最适合您需求的部署方式
---
import {
  Server,
  Network,
  Code2,
  Headphones,
  Bot,
  Handshake,
  Container,
  Boxes,
} from 'lucide-react';

## 部署方式选择

根据您的环境和技术要求选择合适的部署方式。

<Cards>
  <Card
    icon={<Boxes />}
    title="Docker Compose 部署"
    description="使用 Docker Compose 编排多个服务，适合生产环境或需要 MySQL、Redis 等依赖的场景。"
    href="/zh/docs/installation/deployment-methods/docker-compose-installation"
  />
  <Card
    icon={<Container />}
    title="Docker 单容器部署"
    description="使用 Docker 镜像快速部署 New API，适合个人使用或小规模应用场景。"
    href="/zh/docs/installation/deployment-methods/docker-installation"
  />
  <Card
    icon={<Server />}
    title="1Panel 面板部署"
    description="通过 1Panel 面板图形化界面快速部署，适合不熟悉命令行的用户。"
    href="/zh/docs/installation/deployment-methods/1panel-installation"
  />
  <Card
    icon={<Server />}
    title="宝塔面板部署"
    description="通过宝塔面板图形化界面快速部署，适合不熟悉命令行的用户。"
    href="/zh/docs/installation/deployment-methods/bt-docker-installation"
  />
  <Card
    icon={<Network />}
    title="集群部署模式"
    description="多节点分布式部署，实现高可用、负载均衡和水平扩展，适合大规模应用和企业级场景。"
    href="/zh/docs/installation/deployment-methods/cluster-deployment"
  />
  <Card
    icon={<Code2 />}
    title="本地开发部署"
    description="适合开发者进行代码贡献和功能定制，提供完整的本地开发环境设置指南。"
    href="/zh/docs/installation/deployment-methods/local-development"
  />
</Cards>

## 浏览我们的文档

探索全面的指南和资源，充分利用 New API 的强大功能。

<Cards>
  <Card
    icon={<Code2 />}
    title="接口文档"
    description="全面的 API 接口说明和调用示例。"
    href="/zh/docs/api"
  />
  <Card
    icon={<Bot />}
    title="AI 应用"
    description="探索基于 New API 开发的各类 AI 应用示例。"
    href="/zh/docs/apps"
  />
  <Card
    icon={<Headphones />}
    title="帮助支持"
    description="常见问题解答和社区交流。"
    href="/zh/docs/support"
  />
  <Card
    icon={<Handshake />}
    title="商务合作"
    description="与我们合作，共同开拓 AI 生态与商业机会。"
    href="/zh/docs/business"
  />
</Cards>
