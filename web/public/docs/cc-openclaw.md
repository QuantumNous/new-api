# OpenClaw 最新版自定义中转站配置教程

通过 `openclaw.json` 接入 61kj。

## 第一步：安装与基础初始化

首先确保你已经安装了 Node.js 环境，然后在终端执行：

### 1. 全局安装

```bash
npm install -g openclaw@latest
```

### 2. 执行初始化引导

```bash
openclaw onboard
```

根据提示完成基础初始化后，再继续修改配置文件。

## 第二步：修改主配置文件 `openclaw.json`

OpenClaw 不能直接靠环境变量去改自定义中转地址，一般需要通过 `providers` 的方式配置自定义 Provider。

打开下面路径中的文件：

### Windows

```bash
C:\Users\你的用户名\.openclaw\openclaw.json
```

### macOS / Linux

```bash
~/.openclaw/openclaw.json
```

如果你的本地目录结构略有不同，以实际安装目录为准。

添加以下内容：

```json
"providers": {
  "61kj": {
    "baseUrl": "http://61kj.top/v1",
    "apiKey": "sk-xxx",
    "api": "openai-completions",
    "headers": {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json"
    },
    "models": [
      {
        "id": "gpt-5.4",
        "name": "gpt-5.4",
        "reasoning": true,
        "input": [
          "text",
          "image"
        ],
        "cost": {
          "input": 0,
          "output": 0,
          "cacheRead": 0,
          "cacheWrite": 0
        },
        "contextWindow": 200000,
        "maxTokens": 32768
      }
    ]
  }
},
"agents": {
  "defaults": {
    "model": {
      "primary": "61kj/gpt-5.4"
    }
  }
}
```

如果你想换成其他模型，把 `models` 里的内容改掉即可。

## 第三步：检查并启动

### 1. 启动 OpenClaw

```bash
openclaw
```

### 2. 如果需要启动 Gateway

```bash
openclaw gateway --port 18789
```

### 3. 访问控制台

`http://127.0.0.1:18789/`
