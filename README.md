<div align="center">

# AIKanHub

**给开发者的视频生成 API 平台，一个 key 调用所有主流模型。**

[English](./README.en.md) · [License](./LICENSE) · [Acknowledgments](./NOTICE.md)

</div>

---

## 这是什么

AIKanHub 是一个聚合视频生成模型 API 的网关。开发者用统一的 key 和接口，就能调用 Seedance、Pixverse 等主流视频生成模型，不用一家家上游对接、管 key、对账单。

## 当前支持

| 模型 | 状态 |
|---|---|
| 字节跳动 Seedance 2.0 / 2.0 fast | ✅ 已支持（文生视频、图生视频、首尾帧、多模态参考、有声视频） |
| Pixverse v5.5 | 🚧 占位中，规划中 |
| 更多视频模型 | 按需求加 |

## 快速开始（本地）

需要 Docker 和一个 Neon Postgres 实例（[free 层够用](https://console.neon.tech)）。

```bash
# 1. 克隆
git clone git@github.com:NekoAIKan/aikanhub.git
cd aikanhub

# 2. 准备环境变量
cp .env.local.example .env.local
# 编辑 .env.local，填入 Neon 的 direct connection string

# 3. 启动（首次会 build 镜像，约 5-10 分钟）
docker compose -f docker-compose.local.yml --env-file .env.local up -d

# 4. 访问
open http://localhost:3000
```

## 协议

[AGPL-3.0](./LICENSE)。如果你用 AIKanHub 对外提供网络服务，必须向用户开放完整源码（包括你的修改）。如需闭源商用，请联系上游 [QuantumNous](mailto:support@quantumnous.com)。

## 致谢

AIKanHub 基于 [Calcium-Ion/new-api](https://github.com/Calcium-Ion/new-api) fork 而来，详见 [NOTICE.md](./NOTICE.md)。
