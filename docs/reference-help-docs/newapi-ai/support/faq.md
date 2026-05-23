# 常见问题

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/support/faq.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/support/faq.mdx

## 页面大纲

  - 💰 额度相关问题
  - 🔧 渠道配置问题
  - 🌐 部署与连接问题
  - 📦 数据库与升级问题
  - ❓ 没有找到您的问题？

## 原文内容

---
title: 常见问题
---
import { Accordions, Accordion } from 'fumadocs-ui/components/accordion';

## 💰 额度相关问题

<Accordions>
  <Accordion title="额度是什么？怎么计算的？">
    额度计算公式如下：

    ```
    额度 = 分组倍率 * 模型倍率 * （提示 token 数 + 补全 token 数 * 补全倍率）
    ```

    **补全倍率说明：**
    - GPT3.5：固定为 1.33
    - GPT4：固定为 2（与官方保持一致）

    **注意事项：**
    - 非流模式下，官方接口会返回消耗的总 token，但提示和补全的消耗倍率不同
    - New API 的默认倍率与官方倍率一致，已经过调整
  </Accordion>

  <Accordion title="账户额度足够为什么提示额度不足？">
    这是因为令牌额度和账户额度是分开的：

    - 令牌额度仅用于设置最大使用量限制
    - 用户可以自由设置令牌额度
    - 请检查您的令牌额度是否充足
  </Accordion>
</Accordions>

## 🔧 渠道配置问题

<Accordions>
  <Accordion title="渠道中的权重和优先级是什么？">
    权重和优先级是控制渠道使用顺序和分配的两个重要参数：

    - **优先级（Priority）**：数字越大优先级越高，优先级高的渠道会优先被使用
    - **权重（Weight）**：在同优先级的渠道中，按权重比例分配请求

    **例如：**
    - 优先级为 2 的渠道会优先于优先级为 1 的渠道被使用
    - 同为优先级 1 的两个渠道，权重比为 2:1 时，请求会按照 2:1 的比例分配
  </Accordion>

  <Accordion title="提示无可用渠道？">
    请检查以下设置：

    1. 用户分组设置
    2. 渠道分组设置
    3. 渠道的模型设置
  </Accordion>

  <Accordion title="渠道测试报错：invalid character '<' looking for beginning of value">
    此错误表示返回值不是合法的 JSON，而是一个 HTML 页面。

    最可能的原因是：您的部署站的 IP 或代理节点被 CloudFlare 封禁。
  </Accordion>

  <Accordion title="渠道测试报错：倍率或价格未配置，请联系管理员设置">
    请检查是否在「系统设置 - 运营设置 - 模型倍率设置」中配置了倍率或价格。

    或者在「系统设置 - 运营设置」开启「自用模式」。
  </Accordion>
</Accordions>

## 🌐 部署与连接问题

<Accordions>
  <Accordion title="ChatGPT Next Web 报错：Failed to fetch">
    请检查以下几点：

    1. 部署时不要设置 `BASE_URL`
    2. 确认接口地址和 API Key 填写正确
    3. 检查是否启用了 HTTPS（浏览器会拦截 HTTPS 域名下的 HTTP 请求）
  </Accordion>

  <Accordion title="报错：当前分组负载已饱和，请稍后再试">
    这表示上游渠道出现了 429 错误（请求过多）。
  </Accordion>
</Accordions>

## 📦 数据库与升级问题

<Accordions>
  <Accordion title="升级之后我的数据会丢失吗？">
    根据数据库类型有所不同：

    - **MySQL**：数据不会丢失
    - **SQLite**：需要按照部署命令挂载 volume 来持久化 `one-api.db` 数据库文件，否则容器重启后数据会丢失
  </Accordion>

  <Accordion title="升级之前数据库需要做变更吗？">
    一般情况下不需要，系统会在初始化时自动调整。

    如需特殊处理，会在更新日志中说明并提供相应脚本。
  </Accordion>

  <Accordion title="手动修改数据库后报错：数据库一致性已被破坏，请联系管理员？">
    此错误表示在 `ability` 表中检测到无效的渠道 ID 记录。常见原因：

    - 删除 `channel` 表记录时未同步清理 `ability` 表中的无效渠道
    - 每个渠道支持的模型都需要在 `ability` 表中有对应记录
  </Accordion>
</Accordions>

## ❓ 没有找到您的问题？

如果这里没有解答您的问题，欢迎：

1. 查看 [安装部署文档](/zh/docs/installation)
2. 在 [GitHub 上提交 issue](/zh/docs/support/feedback-issues)
3. 加入 [QQ 交流群寻求帮助](/zh/docs/support/community-interaction)
