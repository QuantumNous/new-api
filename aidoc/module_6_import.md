# 模块六：一键导入 Codex / Claude Code

## 功能说明

在用户的 Token 管理页面，提供一键生成配置的能力，让用户快速将 new-api 地址和 Token 配置到 Codex CLI 或 Claude Code 中。

---

## 支持的工具

| 工具 | 配置方式 | 关键环境变量 |
|------|----------|-------------|
| **Codex CLI** | `~/.codex/config.toml` 或环境变量 | `OPENAI_BASE_URL` + `OPENAI_API_KEY` |
| **Claude Code** | `~/.claude/settings.json` 或环境变量 | `ANTHROPIC_BASE_URL` + `ANTHROPIC_API_KEY` |
| Cursor | Settings UI 或环境变量 | `OPENAI_BASE_URL` + `OPENAI_API_KEY` |
| Continue | `~/.continue/config.json` | `apiBase` 字段 |

---

## 后端实现

```go
// controller/export.go

// GET /api/user/export/config?token_id=xxx&tool=codex
func ExportToolConfig(c *gin.Context) {
    tokenID, _ := strconv.Atoi(c.Query("token_id"))
    tool := c.Query("tool") // codex / claudecode / cursor / generic
    
    token, err := model.GetTokenByID(tokenID)
    if err != nil || token.UserID != c.GetInt("user_id") {
        c.JSON(403, gin.H{"error": "无权访问该 Token"})
        return
    }
    
    // 获取服务器地址
    baseURL := getServerBaseURL(c) // 如 https://api.example.com
    
    var result map[string]interface{}
    
    switch tool {
    case "codex":
        result = generateCodexConfig(baseURL, token.Key)
    case "claudecode":
        result = generateClaudeCodeConfig(baseURL, token.Key)
    case "cursor":
        result = generateCursorConfig(baseURL, token.Key)
    default:
        result = generateGenericConfig(baseURL, token.Key)
    }
    
    c.JSON(200, result)
}

func generateCodexConfig(baseURL, tokenKey string) map[string]interface{} {
    return map[string]interface{}{
        "tool": "Codex CLI",
        // 方式一：环境变量（推荐）
        "env_script": fmt.Sprintf(
            "export OPENAI_BASE_URL=\"%s/v1\"\nexport OPENAI_API_KEY=\"%s\"",
            baseURL, tokenKey),
        // 方式二：配置文件
        "config_file": "~/.codex/config.toml",
        "config_content": fmt.Sprintf(
            "# NewAPI 自动生成配置\nopenai_base_url = \"%s/v1\"\n", baseURL),
        // 测试命令
        "test_command": fmt.Sprintf(
            "curl %s/v1/models -H \"Authorization: Bearer %s\"", baseURL, tokenKey),
        // 使用说明
        "instructions": []string{
            "方式一（推荐）：复制下方命令到终端执行，设置环境变量",
            "方式二：将配置内容写入 ~/.codex/config.toml",
            "设置完成后运行测试命令验证连通性",
        },
    }
}

func generateClaudeCodeConfig(baseURL, tokenKey string) map[string]interface{} {
    settingsJSON := map[string]interface{}{
        "env": map[string]string{
            "ANTHROPIC_BASE_URL": baseURL,
            "ANTHROPIC_API_KEY":  tokenKey,
        },
    }
    jsonBytes, _ := json.MarshalIndent(settingsJSON, "", "  ")
    
    return map[string]interface{}{
        "tool": "Claude Code",
        "env_script": fmt.Sprintf(
            "export ANTHROPIC_BASE_URL=\"%s\"\nexport ANTHROPIC_API_KEY=\"%s\"",
            baseURL, tokenKey),
        "config_file":    "~/.claude/settings.json",
        "config_content": string(jsonBytes),
        "test_command": fmt.Sprintf(
            "curl %s/v1/messages -H \"x-api-key: %s\" -H \"anthropic-version: 2023-06-01\" "+
            "-d '{\"model\":\"claude-sonnet-4-20250514\",\"max_tokens\":10,\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}]}'",
            baseURL, tokenKey),
        "instructions": []string{
            "方式一（推荐）：复制下方命令到终端执行",
            "方式二：将 JSON 内容写入 ~/.claude/settings.json",
            "注意：设置 ANTHROPIC_BASE_URL 后 MCP 工具搜索默认禁用",
        },
    }
}
```

---

## 前端交互

### Token 列表页增加操作菜单

```
Token 列表：
┌────────────────────────────────────────────────────────┐
│ Token 名称    │ Token Key         │ 余额   │ 操作      │
│──────────────│──────────────────│───────│──────────│
│ 日常开发      │ sk-xxxx...xxxx   │ 50000  │ 📋 🔧 ▼  │
│              │                  │        │          │
│  下拉菜单：                                          │
│  ┌──────────────────────────┐                        │
│  │ 🖥  配置 Codex CLI       │                        │
│  │ 🤖 配置 Claude Code     │                        │
│  │ 📝 配置 Cursor          │                        │
│  │ ⚙️  通用 OpenAI 配置     │                        │
│  └──────────────────────────┘                        │
└────────────────────────────────────────────────────────┘
```

### 配置弹窗

```
┌─ 配置 Codex CLI ────────────────────────────────┐
│                                                  │
│  ⚡ 快速配置（复制到终端执行）                    │
│  ┌──────────────────────────────────────────┐   │
│  │ export OPENAI_BASE_URL="https://api..."  │   │
│  │ export OPENAI_API_KEY="sk-xxxxx"         │   │
│  └──────────────────────────────────────────┘   │
│                          [📋 一键复制]           │
│                                                  │
│  📂 配置文件方式                                 │
│  文件路径：~/.codex/config.toml                  │
│  ┌──────────────────────────────────────────┐   │
│  │ openai_base_url = "https://api..."       │   │
│  └──────────────────────────────────────────┘   │
│                          [📋 复制]               │
│                                                  │
│  🧪 测试连通性                                   │
│  ┌──────────────────────────────────────────┐   │
│  │ curl https://api.../v1/models ...        │   │
│  └──────────────────────────────────────────┘   │
│                          [📋 复制]               │
│                                                  │
│                     [关闭]                        │
└──────────────────────────────────────────────────┘
```

## API 端点

```
GET /api/user/export/config?token_id=xxx&tool=codex      -- Codex 配置
GET /api/user/export/config?token_id=xxx&tool=claudecode  -- Claude Code 配置
GET /api/user/export/config?token_id=xxx&tool=cursor      -- Cursor 配置
GET /api/user/export/config?token_id=xxx&tool=generic     -- 通用配置
```
