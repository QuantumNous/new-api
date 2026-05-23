# Cherry Studio 图像生成配置教程

> 来源：https://docs.codexzh.com/ai-hub-api/nano-banana2
>
> 抓取时间：2026-05-23T07:09:46.142Z

## 页面大纲

- Cherry Studio 图像生成配置教程
  - 第一步：下载 Cherry Studio
  - 第二步：配置模型服务
    - 1. 找到 new-api 平台
    - 2. 添加图像生成模型
    - 3. 将模型类型改为图像生成
  - 第三步：开始使用
  - 遇到问题？

## 原文内容

# Cherry Studio 图像生成配置教程

在 Cherry Studio 中接入 AI HUB API，开启 AI 图像生成功能。

* * *

> **前置条件**
>
> -   已有 AI HUB API 令牌（没有？查看 [快速开始](https://docs.codexzh.com/ai-hub-api/quick-start)）
> -   令牌分组选择 **默认分组**

## 第一步：下载 Cherry Studio

前往官网下载并安装最新版本：

官方下载地址：[https://www.cherry-ai.com/download](https://www.cherry-ai.com/download)

## 第二步：配置模型服务

### 1\. 找到 new-api 平台

打开 Cherry Studio → **设置** → **模型服务** → 找到 **new-api** 平台。

![打开设置，找到 new-api 平台](https://docs.codexzh.com/assets/cherry-1.DVGHVI87.jpg)

### 2\. 添加图像生成模型

点击「管理」，在模型列表中添加图像生成模型（如 `dall-e-3`、`flux-pro` 等）。

![点击管理按钮](https://docs.codexzh.com/assets/cherry-2.61imtGj_.jpg)

![添加图像生成模型](https://docs.codexzh.com/assets/cherry-3.B1NqZFas.jpg)

### 3\. 将模型类型改为图像生成

找到刚添加的模型，点击「设置」，将**模型类型**从默认的「语言模型」改为「**图像生成**」。

![点击模型设置](https://docs.codexzh.com/assets/cherry-4.3Jt-yAMf.jpg)

![将类型改为图像生成](https://docs.codexzh.com/assets/cherry-5.UmIubE4x.jpg)

> 必须将模型类型改为「图像生成」，否则无法在画图功能中看到该模型。

## 第三步：开始使用

配置完成后，进入 Cherry Studio 的「**画图**」功能，选择刚配置的模型，即可开始生成图像。

![使用画图功能生成图像](https://docs.codexzh.com/assets/cherry-6.Dm9cQa-5.jpg)

* * *

## 遇到问题？

-   模型列表中找不到图像生成模型：确认已将模型类型改为「图像生成」
-   调用报错：检查令牌是否有效，分组是否选择「默认分组」
-   联系客服：[客服支持](https://docs.codexzh.com/ai-hub-api/support)

最后更新：2026-02-23
