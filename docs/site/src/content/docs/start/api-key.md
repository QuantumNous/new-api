---
title: 创建 API Key
description: 创建一把可用于首次调用的密钥，并设置消费上限。
---

## 第 1 步：打开创建页面

登录控制台，进入 [API 密钥](https://{{API_HOST}}/keys)，点击右上角 **创建 API 密钥**。

## 第 2 步：填写配置

首次测试可使用以下配置；正式使用时再调整预算和有效期。

| 配置项 | 示例值 | 说明 |
|---|---|---|
| 名称 | `quickstart-demo` | 用来识别这把密钥的用途 |
| 分组 | `ChatGPT` | 对应[快速接入](/start/quickstart/)中的文本模型 |
| 过期时间 | 点击 **1 天** | 测试完成后自动失效 |
| 数量 | `1` | 创建一把密钥 |
| 无限配额 | 关闭 | 开启后不设密钥消费上限，不代表免费 |
| 额度 (USD) | `1` | 这把密钥最多使用 $1 的额度 |

<figure class="tutorial-figure">
  <a href="/images/tutorials/start/key-create.webp" target="_blank" rel="noreferrer">
    <img src="/images/tutorials/start/key-create.webp" alt="创建 API 密钥：名称 quickstart-demo、ChatGPT 分组、1 天有效期和 1 美元额度" width="1240" height="1880" loading="lazy" />
  </a>
  <figcaption>配置示例。填写完成后点击底部「保存更改」。</figcaption>
</figure>

**密钥额度不是账户余额。** 设置 $1 上限不会给账户充值，调用仍需账户有可用额度。余额可在[钱包](https://{{API_HOST}}/wallet)查看；有兑换码时，先按[兑换码充值](/start/redeem/)教程增加账户额度。

使用其他模型时，按模型详情选择分组；需要跨分组使用时可选 `auto`，详见[模型广场与分组](/start/models/)。模型与 IP 访问限制在 **高级设置** 中配置。

## 第 3 步：复制密钥

保存后找到对应记录，点击密钥右侧的复制图标，或打开 **`···` → 复制密钥**。复制的是完整密钥，不是列表中带星号的隐藏文本。

<figure class="tutorial-figure">
  <a href="/images/tutorials/start/key-copy.webp" target="_blank" rel="noreferrer">
    <img src="/images/tutorials/start/key-copy.webp" alt="API 密钥列表：复制图标与操作菜单中的复制密钥入口" width="1600" height="430" loading="lazy" />
  </a>
  <figcaption>复制密钥入口。密钥及账户字段已隐藏。</figcaption>
</figure>

不要将密钥放入浏览器前端、公开仓库或截图。泄露后立即在列表中禁用或删除。

下一步：[发送首次请求](/start/quickstart/)，或[导入 CC Switch](/clients/cc-switch/)。
