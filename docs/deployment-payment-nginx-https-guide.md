# new-api 支付功能与 Nginx / HTTPS 部署技术文档

## 文档目的

本文记录本次 `new-api` 项目的实际部署与排查过程，重点说明两部分内容：

1. 如何开通并配置支付功能
2. 如何完成域名接入、Nginx 反向代理与 HTTPS

本文偏实践落地，适合已经拿到服务器、域名和项目代码，准备把站点正式跑起来的场景。

## 一、支付功能开通说明

### 1. 支付能力在项目中的作用

`new-api` 中的支付相关功能主要分为两类：

1. 钱包充值
2. 订阅购买

钱包充值用于给用户账户增加额度。
订阅购买用于购买套餐，并在支付成功后生成用户订阅。

项目当前支持的主要支付网关包括：

- Stripe
- 易支付（EPay）
- Creem
- Waffo

本次梳理后，建议优先级如下：

- 海外或通用支付场景：优先使用 `Stripe`
- 国内聚合支付场景：优先使用 `易支付`

### 2. Stripe 开通与配置

#### 2.1 适用场景

Stripe 更适合先跑通充值功能，配置路径清晰，项目内支持也比较完整。

#### 2.2 需要准备的信息

在 Stripe 后台需要准备：

- `API Secret`
- `Webhook Secret`
- `Price ID`

在项目后台需要填写：

- `ServerAddress`
- `StripeApiSecret`
- `StripeWebhookSecret`
- `StripePriceId`
- `StripeUnitPrice`
- `StripeMinTopUp`

#### 2.3 Webhook 配置

项目要求将 Stripe Webhook 指向：

```text
https://你的域名/api/stripe/webhook
```

至少订阅以下事件：

- `checkout.session.completed`
- `checkout.session.expired`

#### 2.4 结论

Stripe 是本项目中最适合优先开通的支付方式之一，适合先把充值链路跑通。

额外确认结果：

- Stripe 平台支持支付宝
- Stripe 平台支持微信支付

但需要注意：

- 微信支付不适合 Stripe 订阅自动续费场景
- 如果重点是订阅自动续费，微信支付不是首选方案

### 3. 易支付（EPay）开通与配置

#### 3.1 适用场景

如果项目主要面向国内用户，且需要支付宝、微信等聚合支付能力，易支付更合适。

#### 3.2 `PayAddress` 应该怎么填

本次确认后，项目中的 `PayAddress` 应填写网关基础地址，而不是填写项目自己的回调地址。

对于当前使用的支付网关，建议填写：

```text
https://zhifu.api888.yunqi.ink/
```

不要直接把 `PayAddress` 写成：

- 回调地址
- 项目域名
- 业务通知地址

#### 3.3 回调地址如何生成

回调地址由项目根据 `ServerAddress` 自动生成。

主要包括：

钱包充值异步回调：

```text
/api/user/epay/notify
```

订阅异步回调：

```text
/api/subscription/epay/notify
```

订阅同步返回：

```text
/api/subscription/epay/return
```

因此，支付功能能否正常工作，强依赖 `ServerAddress` 是否配置正确。

### 4. 支付功能落地建议

本次部署结论如下：

- 如果要最快开通支付，优先 Stripe
- 如果要国内聚合支付，优先易支付
- 先保证域名、Nginx、HTTPS 和 `ServerAddress` 配对正确
- 再配置支付回调

推荐落地顺序：

1. 先把域名和 HTTPS 配好
2. 在后台配置 `ServerAddress`
3. 再配置 Stripe 或易支付
4. 最后测试支付回调和订单状态变化

## 二、Nginx 域名接入说明

### 1. 目标

让 `superelite.studio` 正常访问部署在服务器上的 `new-api` 服务。

### 2. DNS 处理结果

本次实际排查中，`superelite.studio` 最终直接解析到源站 IP：

```text
43.103.51.147
```

在 Cloudflare 中，相关 `A` 记录设置为：

- `Type`: `A`
- `Name`: `superelite.studio`
- `Content`: `43.103.51.147`
- `Proxy status`: `DNS only`

在切换为 `DNS only` 后，公网 DNS 查询已确认生效。

### 3. Ubuntu 安装 Nginx

在 Ubuntu 上安装 Nginx：

```bash
sudo apt update
sudo apt install -y nginx
```

启动并设置开机自启：

```bash
sudo systemctl enable --now nginx
```

### 4. Nginx 反向代理配置

实际部署中，需要让 Nginx 把域名请求转发到本机的 `new-api` 服务，通常是 `127.0.0.1:3000`。

示例配置：

```nginx
server {
    listen 80;
    server_name superelite.studio www.superelite.studio;

    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }
}
```

配置文件通常放在：

```text
/etc/nginx/sites-available/new-api
```

然后创建软链接：

```bash
sudo ln -s /etc/nginx/sites-available/new-api /etc/nginx/sites-enabled/new-api
```

如果默认站点仍然存在，可能会导致访问命中 Nginx 欢迎页，因此通常需要移除默认站点：

```bash
sudo rm /etc/nginx/sites-enabled/default
```

检查配置并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 5. 实际结果

完成 DNS、Nginx 和站点配置后，`http://superelite.studio` 已可正常访问 `new-api`，不再返回 Nginx 欢迎页。

## 三、HTTPS 完成说明

### 1. 推荐方案

在 Ubuntu 上推荐直接使用 `certbot + nginx` 完成 HTTPS。

安装命令：

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
```

### 2. 申请证书

单域名：

```bash
sudo certbot --nginx -d superelite.studio
```

主域名加 `www`：

```bash
sudo certbot --nginx -d superelite.studio -d www.superelite.studio
```

Certbot 会自动完成：

- 申请 Let’s Encrypt 证书
- 修改 Nginx 配置
- 开启 443
- 处理 HTTP 到 HTTPS 的跳转

### 3. 验证方式

执行：

```bash
sudo nginx -t
sudo systemctl reload nginx
curl -I https://superelite.studio
```

### 4. 注意事项

如果仍使用 Cloudflare，建议：

- 先把源站 HTTPS 配好
- 再决定是否重新开启 Cloudflare 代理
- 不要使用 `Flexible SSL`

对于 `new-api` 这类项目，支付回调、Webhook、流式接口较多，Cloudflare 代理需要谨慎启用。

## 四、项目后台的关键配置

完成域名和 HTTPS 后，必须同步更新项目后台中的：

```text
ServerAddress = https://superelite.studio
```

这一项会影响：

- Stripe Webhook
- 易支付回调
- 页面跳转地址
- 支付完成后的返回路径

如果 `ServerAddress` 配错，支付系统大概率无法稳定工作。

## 五、最终完成情况

本次已完成：

1. 支付功能方案确认
2. Stripe 配置路径确认
3. 易支付配置方式确认
4. 域名解析与 Nginx 反向代理完成
5. HTTP 访问恢复正常
6. HTTPS 配置方案确认并完成接入

## 六、后续建议

建议接下来继续处理以下事项：

1. 修改数据库默认密码，避免继续使用初始密码
2. 做数据库备份方案
3. 梳理上游 token 来源，方便后续渠道管理与迁移
