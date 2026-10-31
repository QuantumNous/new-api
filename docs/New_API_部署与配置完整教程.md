**解决：** 登录易支付商户后台，在域名管理中添加你的域名，等待审核通过。


### Q5：SSH 连接超时/被拒绝


**原因：** 可能触发了服务器的 fail2ban 防护，或 SSH 服务异常。


**解决：**
- 等待一段时间（通常 10-30 分钟自动解封）
- 通过云服务商的 VNC/控制台登录服务器
- 检查 fail2ban 状态：`fail2ban-client status sshd`
- 解封 IP：`fail2ban-client set sshd unbanip 你的IP`


### Q6：流式输出卡顿或中断


**原因：** Nginx 缓冲或超时设置问题。


**解决：** 在 Nginx 配置中添加：
```nginx
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 300s;
```


### Q7：数据库锁定（SQLite busy）


**原因：** SQLite 并发写入限制，用户量较大时容易出现。


**解决：** 切换到 MySQL 数据库，在 docker-compose.yml 中添加 SQL_DSN 环境变量。


### Q8：忘记管理员密码

New API 镜像未提供密码重置命令行参数，需直接修改 SQLite 数据库中的密码哈希。

**解决：**
```bash
# 进入容器
docker exec -it new-api bash

# 用 sqlite3 将 root 密码重置为 123456
# 下面的哈希值是 "123456" 的 bcrypt 哈希（cost=10）
sqlite3 /data/one-api.db "UPDATE users SET password='$2b$10$AQK.o3B9HyAKbNCEbPSYO.AVum1WW8dbGyzbKSPEXWJMUpx8nE4Oi' WHERE username='root';"

# 验证是否更新成功（应返回 1）
sqlite3 /data/one-api.db "SELECT changes();"

# 退出容器
exit

# 重启容器使密码生效
docker restart new-api
```

> **提示：** 重置后请使用 `root / 123456` 登录，并立即在「个人设置」中修改为强密码。
>
> 如需设置其他密码，可在本地用 Python 生成 bcrypt 哈希：
> ```bash
> python3 -c "import bcrypt; print(bcrypt.hashpw(b'你的密码', bcrypt.gensalt(rounds=10)).decode())"
> ```


---


## 进阶配置


### 使用 MySQL 数据库


当用户量较大时，建议使用 MySQL 替代 SQLite：


1. 安装 MySQL 并创建数据库
2. 在 docker-compose.yml 中添加环境变量：
```yaml
environment:
  - SQL_DSN=用户名:密码@tcp(127.0.0.1:3306)/数据库名?charset=utf8mb4&parseTime=True&loc=Local
```
3. 重启容器


### 配置内容审核
