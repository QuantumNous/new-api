# Hardy 主机部署与网络变更保护

目标：`140.245.89.202` / `a1-ubuntu-free`。2026-09-08 安装。此工具不修改业务代码，也不提供第二台服务器容灾。

## 普通应用部署

本机 SSH 别名 `hardy-app` 使用独立 `hardy-deploy` 账号和独立密钥。该账号不在 sudo、docker、lxd 组，只允许 sudo 执行根用户维护的 `/usr/local/sbin/hardy-app-deploy`。它不能修改网卡、路由、Netplan、系统服务或部署策略，也不能上传 Dockerfile 让 root 执行。

```powershell
ssh hardy-app 'sudo -n /usr/local/sbin/hardy-app-deploy status'

# 先完成代码、测试、Linux ARM64 编译和原有隔离验收，再发布。
$artifact = 'C:/absolute/path/new-api-arm64'
$digest = (Get-FileHash -Algorithm SHA256 $artifact).Hash.ToLowerInvariant()
$version = '本次编译时写入的实际版本号'
scp $artifact "hardy-app:incoming/$digest"
ssh hardy-app "sudo -n /usr/local/sbin/hardy-app-deploy build $version $digest"
# build 仅生成候选镜像，不影响线上。
ssh hardy-app "sudo -n /usr/local/sbin/hardy-app-deploy activate $version $digest"
```

构建只接受所属账号的普通文件、匹配的 SHA256 和 ARM64 ELF 文件头，最多 256 MiB；禁止符号链接。Dockerfile、基础镜像、容器环境、挂载、端口和网络由 root 固定，构建不联网。容器继续只挂载应用的 data/logs，不能访问宿主网络配置或 Docker socket。

受限入口后续激活的应用固定以独立的非 root `hardy-app-runtime` 身份运行，移除额外 Linux capabilities，并设置 `no-new-privileges`，防止借应用部署在宿主可写挂载中制造 root 权限入口。激活前仅调整固定 data/logs 目录归属，遍历不跟随符号链接。当前生产容器未因安装工具而重建，其运行用户将在首次受限激活时切换；需在实际发布前完成对应功能验收。

部署固定配置保存在 `/etc/hardy-ops/app-compose.json`，策略在 `/etc/hardy-ops/policy.json`，均仅 root 可读写。只更新 new-api，使用 `--no-deps`，不重建隧道、数据库或 Redis。健康检查失败时重新应用上一镜像配置；数据库迁移仍需独立备份与兼容性评估，不能假定换回镜像能撤销数据迁移。

`restart` 仅重启 new-api。管理员从旧流程改变线上镜像后，受限入口会拒绝继续发布，须先由管理员核对并同步策略，禁止静默覆盖别的任务的变更。

## 网络维护（管理员专用）

原 `ubuntu` 管理账号保留作为救援入口。普通部署不得退回该账号绕过拒绝。网络维护必须有明确任务授权，不能包含在生图、余额查询、IPv6“顺手优化”或其他应用发布中。

1. 确认云控制台救援方式可用，准备一个**完整的**候选 Netplan 目录（现有全部 `.yaml` 加本次最小改动），而不是只有新增文件。
2. 管理员运行 `sudo -n /usr/local/sbin/hardy-network-guard begin /绝对路径/候选目录`。
3. 工具先在隔离根目录执行 `netplan generate` 校验；随后备份、持久化待回退记录，才更换配置并应用。返回变更 ID。
4. **180 秒内**从本机运行 `./Confirm-NetworkChange.ps1 -ChangeId 返回的ID`。它强制建立新的 SSH 连接、校验配置未被其他任务改动，并验证公网 `/api/status` 是 Hardy 的有效 JSON，最后确认。任一步失败都不要强行确认。
5. 如需立即撤销，管理员运行 `hardy-network-guard rollback ID`；查看状态用 `hardy-network-guard status`。

`hardy-network-rollback.timer` 已开机启用，每 15 秒检查一次。未确认变更在 180 秒期限后恢复原 YAML、移除候选新增文件并重新应用；正常情况下约三分钟到三分十五秒开始回退，命令执行和网络重连另需时间。记录位于 `/var/lib/hardy-network-guard/`，断开 SSH 不影响计时；主机重启后也会检查过期事务。恢复失败保留待回退记录，后续定时器继续尝试，错误记录在 systemd journal。它不依赖公网可达性才触发，因此不会因 Cloudflare 单独故障而重置网络。

```sh
sudo /usr/local/sbin/hardy-network-guard status
sudo systemctl status hardy-network-rollback.timer
sudo journalctl -u hardy-network-rollback.service --since today
```

这是受控变更入口的保护，不能阻止具有完整 root 权限的管理员绕过入口直接改网络；本机全局 AGENTS.md 已明确普通任务使用受限账号，网络维护不得绕过回退入口。永久消除管理员误用还需将救援凭据保管在日常自动化无法访问的位置，本次未撤销现有救援密钥。

## 本次验证与边界

- 受限账号可以查询健康状态；普通 sudo、Docker socket、Netplan 写入均被拒绝。
- 7 项网络事务测试覆盖超时恢复、新增文件清理、验证后确认、非法配置不生效、过期确认拒绝、回退失败重试以及定时器未启动时拒绝变更。
- 3 项部署边界测试覆盖符号链接、哈希不符和发布健康检查失败时恢复固定配置。
- 实际 Netplan 在隔离文件系统根目录成功校验当前配置。
- 真实 systemd 临时定时器调用同一份回退代码，恢复隔离目录中的模拟坏配置；网络命令使用桩，**没有人为切断生产网络，也没有执行生产网卡重载**。安装前后的生产 Netplan 文件哈希一致。
- 使用当前线上同一份二进制，通过新账号成功构建候选镜像，未激活该候选；没有为验收重启生产应用。实际生产切换步骤尚未演练，不将此项记为通过。
- 当前二进制在无网络、只读根目录、非 root、清空 capabilities 和 no-new-privileges 的隔离容器中成功执行版本检查；这不等于完整业务功能验收。
- 正式回退 timer 已 enabled/active，当前无待回退事务。

这些保护减少配置误操作的影响，不保证服务器、云网络、存储或 Cloudflare 永不故障。

## 后续实施记录

2026-09-08，受限部署入口完成首次实际发布 `hardy-http-guard-20260908-152518`。应用已以 `995:985` 身份运行，capabilities 全部移除，no-new-privileges 生效；健康检查、图片目录和日志目录写权限检查通过。该发布未重载主网卡。原先“尚未实际切换”的记录描述安装工具时的验证范围，现已补充发布证据。

本站客户端 HTML/非 JSON 处理已发布，外部客户程序仍待接入；独立服务器容灾仍待提供备用主机。详见 [非 JSON 响应保护](../../docs/non-json-response-protection.md) 和 [容灾准备](../disaster-recovery/README.md)。
