# 安装部署

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/installation/index.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/installation/index.mdx

## 页面大纲

  - 概述
  - 部署方式
  - 配置与维护

## 原文内容

---
title: 安装部署
description: 选择适合您的部署方式
---
import { Card, Cards } from 'fumadocs-ui/components/card';
import {
  Container,
  Boxes,
  Server,
  Network,
  Code2,
  Settings,
  RefreshCw,
  FileCode,
} from 'lucide-react';

## 概述

New API 支持多种部署方式，您可以根据自己的技术背景和使用场景选择最合适的方案。

## 部署方式

<Cards>
  <Card
    icon={<Boxes />}
    title="Docker Compose 部署"
    description="使用 Docker Compose 编排多个服务，适合生产环境。"
    href="/zh/docs/installation/deployment-methods/docker-compose-installation"
  />
  <Card
    icon={<Container />}
    title="Docker 单容器部署"
    description="使用 Docker 镜像快速部署，适合个人使用。"
    href="/zh/docs/installation/deployment-methods/docker-installation"
  />
  <Card
    icon={<Server />}
    title="1Panel 面板部署"
    description="通过 1Panel 图形化界面快速部署。"
    href="/zh/docs/installation/deployment-methods/1panel-installation"
  />
  <Card
    icon={<Server />}
    title="宝塔面板部署"
    description="通过宝塔面板图形化界面快速部署。"
    href="/zh/docs/installation/deployment-methods/bt-docker-installation"
  />
  <Card
    icon={<Network />}
    title="集群部署模式"
    description="多节点分布式部署，实现高可用和负载均衡。"
    href="/zh/docs/installation/deployment-methods/cluster-deployment"
  />
  <Card
    icon={<Code2 />}
    title="本地开发部署"
    description="适合开发者进行代码贡献和功能定制。"
    href="/zh/docs/installation/deployment-methods/local-development"
  />
</Cards>

## 配置与维护

<Cards>
  <Card
    icon={<FileCode />}
    title="docker-compose.yml 配置"
    description="详细了解 Docker Compose 配置文件的各项参数。"
    href="/zh/docs/installation/config-maintenance/docker-compose-yml"
  />
  <Card
    icon={<Settings />}
    title="环境变量配置"
    description="完整的环境变量配置说明和最佳实践。"
    href="/zh/docs/installation/config-maintenance/environment-variables"
  />
  <Card
    icon={<RefreshCw />}
    title="系统更新"
    description="了解如何安全地更新 New API 到最新版本。"
    href="/zh/docs/installation/config-maintenance/system-update"
  />
</Cards>
