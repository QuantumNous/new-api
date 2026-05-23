# Hapi 进阶配置：Cloudflare 优选 IP 高速穿透

> 来源：https://docs.ikuncode.cc/zh/apps/hapi-advanced
>
> 抓取时间：2026-05-23T07:09:46.142Z

## 页面大纲

- Hapi 进阶配置：Cloudflare 优选 IP 高速穿透
  - 📺 视频教程
  - 🎯 你正在解决什么问题？
    - 默认 Tunnel 的痛点
    - 优选 IP 方案的优势
  - 🔍 原理解析
    - 流量走向链路
    - 核心技术要点
  - 🛠️ 配置步骤
    - 前置准备
    - 第一步：配置 Cloudflare Tunnel（辅助域名）
    - 第二步：启用 Cloudflare for SaaS（辅助域名）
    - 第三步：配置 DNS 解析（主力域名）
    - 第四步：配置回退源（辅助域名）
    - 第五步：等待 SSL 证书生效
  - ✅ 验证配置
    - 测试访问
    - 测试速度提升
  - 🎓 角色分配总结
  - 🔧 故障排查
    - SSL 证书一直显示 Pending？
    - 访问显示 526 错误？
    - 访问仍然很慢？
  - 🚀 进阶优化
    - 自建优选 IP 服务
    - 多运营商优化
  - 📚 相关资源
  - ⚠️ 安全提醒
  - 💡 总结

## 原文内容

# Hapi 进阶配置：Cloudflare 优选 IP 高速穿透

**没有公网 IP？使用 Cloudflare 优选 IP，打造高速内网穿透通道**

> **适用场景**：已配置 Cloudflare Tunnel，但访问速度慢、延迟高 **解决方案**：利用 Cloudflare for SaaS + 优选 IP 服务，绕过拥堵节点 **前置要求**：已完成 [Hapi 基础配置](https://docs.ikuncode.cc/apps/hapi)，拥有两个域名

## 📺 视频教程

推荐观看

[没有公网IP？cloudflare优选IP，高速内网穿透 - 哔哩哔哩](https://www.bilibili.com/video/BV1PPy6YzE5C)

视频详细演示了完整的配置过程，强烈建议先观看视频再进行操作。

## 🎯 你正在解决什么问题？

### 默认 Tunnel 的痛点

当你直接使用 Cloudflare Tunnel 绑定域名时：

-   ❌ Cloudflare 分配的 Anycast IP 在国内可能被绕路（绕到美国、欧洲）
-   ❌ 运营商 QoS 限速，访问速度慢
-   ❌ 延迟高达几百毫秒，严重影响使用体验

![优选 IP 前的访问速度](https://docs.ikuncode.cc/images/apps/hapi/%E4%BC%98%E9%80%89%E5%89%8D.png)

### 优选 IP 方案的优势

通过本教程的配置：

-   ✅ 强制流量走对国内网络友好的节点（香港、新加坡等）
-   ✅ 大幅提升访问速度，延迟降低到几十毫秒
-   ✅ 完全免费，利用 Cloudflare 企业级功能
-   ✅ 稳定性高，自动切换最优路由

![优选 IP 后的访问速度](https://docs.ikuncode.cc/images/apps/hapi/%E4%BC%98%E9%80%89%E5%90%8E.png)

🚀 速度提升对比

从上面两张图可以看到，优选 IP 后访问速度得到了**显著提升**，延迟从几百毫秒降低到几十毫秒，页面加载也更加流畅！

## 🔍 原理解析

### 流量走向链路

当用户访问你的域名时，流量是这样流转的：

```
用户浏览器
    ↓
DNS 解析：hapi.justdo.xin
    ↓
CNAME → cdn.ttdk.fun
    ↓
CNAME → isp.qzz.io（优选 IP 调度器）
    ↓
返回最优 Cloudflare IP（根据用户运营商）
    ↓
Cloudflare 边缘节点（通过 Host Header 识别）
    ↓
SaaS 路由：hapi.justdo.xin → hapi.ttdk.fun
    ↓
Cloudflare Tunnel（加密隧道）
    ↓
你的本地服务器 localhost:3006
```

💡 提示

[isp.qzz.io](https://isp.qzz.io/) 在这里充当"智能交警"的角色，根据你的网络环境自动选择最优路线。

### 核心技术要点

1.  **优选 IP 调度器**：[isp.qzz.io](https://isp.qzz.io/) 会根据用户的网络环境（电信/联通/移动），返回当前速度最快、延迟最低的 Cloudflare 官方 CDN 节点 IP

2.  **Cloudflare for SaaS**：通过 Custom Hostnames 功能，把"访问域名"和"隧道域名"解耦，实现"走优选 IP 进隧道"

3.  **DNS 链式解析**：通过 CNAME 链，把用户请求引导到优选 IP，同时保持 Cloudflare 对域名的正确识别


💡 关于优选 IP 调度器

[isp.qzz.io](https://isp.qzz.io/) 是一个社区维护的 Cloudflare 优选 IP 调度服务，它会自动测速并返回对你当前网络环境最优的 Cloudflare CDN 节点。访问该网站可以查看更多信息和使用说明。

## 🛠️ 配置步骤

### 前置准备

你需要准备：

1.  **主力域名**：用于展示给用户访问（例如：`hapi.justdo.xin`）
2.  **辅助域名**：用于承载 Cloudflare Tunnel（例如：`ttdk.fun`）
3.  两个域名都需要托管在 Cloudflare

⚠️ 重要说明

-   主力域名和辅助域名**不能是同一个域名**
-   辅助域名需要是你自己拥有的，不能用别人的
-   两个域名都必须在 Cloudflare 上管理

### 第一步：配置 Cloudflare Tunnel（辅助域名）

在辅助域名（例如 `ttdk.fun`）上设置 Tunnel：

1.  登录 Cloudflare，选择辅助域名
2.  进入 **Zero Trust → Access → Tunnels**
3.  创建隧道并安装 cloudflared
4.  配置公共主机名：
    -   **子域名**：`hapi`
    -   **域名**：`ttdk.fun`
    -   **服务**：`http://localhost:3006`

完成后你应该能通过 `hapi.ttdk.fun` 访问你的 Hapi 服务。

### 第二步：启用 Cloudflare for SaaS（辅助域名）

在辅助域名（`ttdk.fun`）上启用 SaaS 功能：

1.  进入 Cloudflare 控制台
2.  选择 `ttdk.fun` 域名
3.  进入 **SSL/TLS → Custom Hostnames**
4.  点击 **Add Custom Hostname**
5.  填写：
    -   **Custom Hostname**：`hapi.justdo.xin`（主力域名）
    -   **Wildcard**：不勾选
6.  点击 **Add Custom Hostname**

💡 提示

添加后会生成 2 条 TXT 验证记录，先不着急配置，继续下一步。

### 第三步：配置 DNS 解析（主力域名）

在主力域名（`justdo.xin`）的 DNS 设置中添加以下记录：

#### 3.1 添加 SSL 验证记录

从第二步中复制 Cloudflare 生成的 2 条 TXT 记录，添加到主力域名的 DNS：

| 类型 | 名称 | 内容 | 代理状态 |
| --- | --- | --- | --- |
| TXT | `_acme-challenge.hapi` | `xxxxxxxxxx`（从 SaaS 页面复制） | 仅限 DNS |
| TXT | `_acme-challenge.hapi` | `yyyyyyyyyy`（从 SaaS 页面复制） | 仅限 DNS |

#### 3.2 添加 CNAME 记录

| 类型 | 名称 | 目标 | 代理状态 |
| --- | --- | --- | --- |
| CNAME | `cdn` | `isp.qzz.io` | 仅限 DNS ⚠️ |
| CNAME | `hapi` | `cdn.justdo.xin` | 仅限 DNS ⚠️ |

🚨 关键配置

**必须关闭小黄云（代理状态设为"仅限 DNS"）！**

如果开启代理，会导致 DNS 解析链中断，无法触发优选 IP。

### 第四步：配置回退源（辅助域名）

在辅助域名（`ttdk.fun`）的 DNS 设置中：

| 类型 | 名称 | 目标 | 代理状态 |
| --- | --- | --- | --- |
| CNAME | `hapi` | `[你的隧道ID].cfargotunnel.com` | 已代理 ✅ |

💡 提示

这条记录通常在创建 Tunnel 时自动生成。确保小黄云是**开启**状态（已代理）。

### 第五步：等待 SSL 证书生效

1.  回到辅助域名的 **SSL/TLS → Custom Hostnames** 页面
2.  查看 `hapi.justdo.xin` 的状态
3.  等待几分钟，状态变为 **Active（有效）** 即表示配置成功

⏳ 耐心等待

SSL 证书签发通常需要 5-15 分钟，请耐心等待。如果超过 30 分钟仍未生效，检查 TXT 记录是否正确添加。

## ✅ 验证配置

### 测试访问

在浏览器中访问：`https://hapi.justdo.xin`

如果能正常打开 Hapi 界面，说明配置成功！

### 测试速度提升

使用 ping 或测速工具对比：

**优化前**：

bash

```
ping hapi.ttdk.fun
# 延迟通常 200-500ms
```

**优化后**：

bash

```
ping hapi.justdo.xin
# 延迟通常 20-100ms
```

## 🎓 角色分配总结

| 角色 | 域名示例 | 作用 |
| --- | --- | --- |
| **主力域名** | `hapi.justdo.xin` | 你最终展示给用户访问的地址 |
| **辅助域名** | `hapi.ttdk.fun` | 承载 Tunnel 的"回退源"，用户不直接感知 |
| **优选 IP 调度器** | [isp.qzz.io](https://isp.qzz.io/) | 像"交警"，告诉流量该走哪条不堵的路 |
| **中转域名** | `cdn.justdo.xin` | 作为跳板，把主力域名引向优选 IP 池 |

## 🔧 故障排查

### SSL 证书一直显示 Pending？

**可能原因**：

-   TXT 记录添加错误或未生效
-   DNS 传播未完成

**解决方法**：

1.  使用 [DNS 检查工具](https://dnschecker.org/) 验证 TXT 记录
2.  等待 DNS 全球传播（最多 24 小时）
3.  重新添加 Custom Hostname

### 访问显示 526 错误？

**可能原因**：

-   辅助域名的 `hapi` 记录未开启代理（小黄云）
-   Tunnel 未正确配置

**解决方法**：

1.  确保 `hapi.ttdk.fun` 的小黄云是**开启**状态
2.  检查 Tunnel 是否正常运行

### 访问仍然很慢？

**可能原因**：

-   主力域名的 CNAME 记录开启了代理
-   DNS 解析链断裂

**解决方法**：

1.  确保 `hapi.justdo.xin` 和 `cdn.justdo.xin` 的小黄云都是**关闭**状态
2.  使用 `nslookup` 检查 DNS 解析链是否完整

## 🚀 进阶优化

### 自建优选 IP 服务

如果你追求极致稳定，可以：

1.  使用 CloudflareSpeedTest 工具本地测速
2.  手动选择最优 IP
3.  创建自己的优选域名，替代 `isp.qzz.io`

### 多运营商优化

可以针对不同运营商配置不同的优选路径：

-   电信用户：`cdn-ct.yourdomain.com`
-   联通用户：`cdn-cu.yourdomain.com`
-   移动用户：`cdn-cm.yourdomain.com`

通过 DNS 智能解析（GeoDNS），根据用户运营商返回不同的 CNAME 记录。

## 📚 相关资源

-   [Cloudflare for SaaS 官方文档](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/)
-   [Cloudflare Tunnel 文档](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
-   [isp.qzz.io - 优选 IP 调度器](https://isp.qzz.io/)
-   [视频教程：cloudflare优选IP配置](https://www.bilibili.com/video/BV1PPy6YzE5C)

## ⚠️ 安全提醒

1.  不要泄露你的 Tunnel 令牌
2.  定期检查 Custom Hostnames 配置
3.  [isp.qzz.io](https://isp.qzz.io/) 是社区维护的优选 IP 服务，虽然可靠但非官方服务，你也可以选择自建优选服务
4.  建议配合 Cloudflare Access 限制访问来源

## 💡 总结

通过这套配置，你：

-   ✅ 不花一分钱
-   ✅ 利用 Cloudflare 企业级 SaaS 功能
-   ✅ 把原本几百毫秒延迟的内网穿透，优化到接近直连的体验
-   ✅ 打造了一条"高速内网穿透通道"

这就是目前免费方案中，提升 Cloudflare 内网穿透速度的**天花板级别配置**！

* * *

**下一步**：配置完成后，你可以愉快地在任何地方高速访问你的 Hapi 服务了！🎉
