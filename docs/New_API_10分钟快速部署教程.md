# New API 10分钟快速部署教程

> 从零开始，10分钟搭建属于你自己的 AI API 中转站。本教程追求最快上手，不啰嗦。

## 准备工作

- 一台云服务器（Ubuntu 22.04，1核2G够用）
- 一个域名（已解析到服务器IP）
- 一个大模型 API Key（DeepSeek/智谱/讯飞都行，用来测试）

---

## 第一步：安装 Docker（2分钟）

SSH 登录服务器，执行：

```bash
curl -fsSL https://get.docker.com | bash
systemctl enable docker --now
```

验证：`docker --version`，看到版本号就成功了。

---

## 第二步：启动 New API（2分钟）

```bash
mkdir -p /opt/new-api/data

docker run -d \
  --name new-api \
  --restart always \
  -p 127.0.0.1:3000:3000 \
  -v /opt/new-api/data:/data \
  calciumion/new-api:latest
```

验证：`docker ps | grep new-api`，看到 Up 状态就成功了。

---

## 第三步：配置 Nginx 反代（2分钟）

```bash
apt install nginx -y
```

创建配置文件 `/etc/nginx/sites-available/new-api`：

```nginx
server {
    listen 80;
    server_name 你的域名;

    client_max_body_size 64M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
        proxy_buffering off;
    }
}
```

启用配置：

```bash
ln -s /etc/nginx/sites-available/new-api /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## 第四步：配置 HTTPS（1分钟）

```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d 你的域名
```

按提示输入邮箱，选 2（强制跳转 HTTPS）。

---

## 第五步：初始配置（2分钟）

1. 浏览器访问 `https://你的域名`
2. 用默认账号登录：用户名 `root`，密码 `123456`
3. **立即修改密码**：右上角头像 → 个人设置 → 修改密码
4. 进入管理后台 → 系统设置，修改站点名称，开启注册

---

## 第六步：添加模型渠道（1分钟）

1. 管理后台 → 渠道 → 添加渠道
2. 以 DeepSeek 为例：
   - 渠道类型：DeepSeek
   - 名称：随便起
   - 密钥：你的 DeepSeek API Key
   - 模型：deepseek-chat, deepseek-reasoner
3. 点「测试」，成功后点「提交」

---

## 第七步：配置模型价格（必做！）

⚠️ **不配置价格，模型不会显示，也无法调用！**

1. 管理后台 → 模型 → 模型定价
2. 给每个模型设置输入/输出价格（参考官方价格适当加价）
3. 保存

---

## 第八步：测试调用

1. 管理后台 → 令牌 → 添加令牌，创建一个 API Key
2. 用 curl 测试：

```bash
curl https://你的域名/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 你的APIKey" \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"你好"}],"stream":false}'
```

看到返回内容，恭喜你，部署成功！🎉

---

## 常见坑（提前避开）

| 问题 | 原因 | 解决 |
|------|------|------|
| 502 Bad Gateway | 容器没启动或Nginx配置错 | `docker ps` 检查容器，`nginx -t` 检查配置 |
| 模型列表为空 | 没配置模型价格 | 去模型定价里给所有模型设价格 |
| 调用404 | 模型名写错或渠道没加这个模型 | 检查渠道的模型列表和调用时的模型名 |
| 权限不足 | 用户角色异常 | 管理后台→用户，把角色改成普通用户 |
| SSH连不上 | 触发fail2ban | 等10分钟自动解封，或用VNC登录 |
| 流式输出卡顿 | Nginx缓冲没关 | 确认配置里有 `proxy_buffering off` |

---

## 下一步

- 配置支付（彩虹易支付）→ 参考完整教程
- 配置兑换码 → 管理后台确认合规条款后启用
- 开启注册赠送额度 → 系统设置里设置 RegisterQuota
- 配置定时备份 → 每天自动备份数据库

---

**项目地址：** https://github.com/QuantumNous/new-api
**官方文档：** https://docs.newapi.ai

> 遇到问题先看容器日志：`docker logs -f new-api`
