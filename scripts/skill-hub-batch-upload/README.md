# Skill Hub Batch Upload / Skill Hub 批量上传

## 中文

这个目录用于批量导入 Skill Hub 技能。脚本只负责批处理编排，不直接写数据库；zip 和 icon 仍然走现有后台上传链路：

1. `POST /api/admin/skill-hub/direct-upload/init`
2. OSS signed URL `PUT`
3. `POST /api/admin/skill-hub/direct-upload/complete`
4. `POST` 或 `PUT /api/admin/skill-hub/skills`

这样可以复用后端已有的权限校验、OSS 临时对象、文件头校验、checksum、对象转正、旧对象清理和标签同步逻辑。

### 数据规则

- `id` 必须匹配 `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`：以字母或数字开头，后续允许字母、数字、点、下划线和短横线，最长 128 个字符
- `name` 必填，最多 100 个字符；脚本会在 dry-run 和正式上传前校验
- `zip` 必填，必须是本地 `.zip` 文件；脚本会先检查文件是否存在，最大 50 MB
- `icon` 可选；填写时必须是本地 `.png`、`.jpg`、`.jpeg` 或 `.webp` 文件，最大 1 MB；使用 `--mode update` 时，省略 `icon` 或设为 `""` 会清空远端已有图标
- `tags` 传标签名，不是标签 ID，例如 `["开发工具", "Agent"]`；每个标签最多 40 个字符，不能包含 `/` 或 `\`
- `origin` 和 `originUrl` 为可选来源信息，例如来源 `"Clawhub"` 和对应的源项目 URL；`origin` 最多 64 个字符，`originUrl` 必须是 HTTP/HTTPS 绝对地址且最多 2048 个字符
- `license` 可选，最多 128 个字符；`evaluation` 可选并直接使用详情接口的 JSON 结构。评测固定使用 `safety`、`access`、`frontier`、`economy` 四维，每项及可选综合评分的范围均为 `0` 到 `5`
- `testcases` 可选，值为本地 UTF-8 `.json` 文件路径，不是内联 JSON 或远程 URL。脚本在上传前读取并校验文件，再把解析后的对象传给 Skill 接口；文件最大 2 MB、最多 50 个案例，`slug` 不要求与 Skill ID 一致
- `sort` 必须是整数；值为 `0` 或省略时，脚本实际上传 `1000000`，其他值保持不变
- 所有导入的 Skill 都会强制保存为 `published: true`
- manifest 中的相对路径按 manifest 文件所在目录解析

### 鉴权方式

管理员接口支持两种鉴权方式，二选一即可。无论使用哪种方式，`--user-id` 都必须是该管理员用户 ID，因为后端会校验 `New-Api-User` 和当前登录用户是否一致。

- Session cookie：管理员已登录后，从浏览器 DevTools 复制当前站点 Cookie，至少包含 `session=...`。推荐这种方式。
- Access token：登录后调用 `GET /api/user/token` 生成；这不是 API Key 页面里的普通令牌。

以下命令均在 PowerShell 中运行。环境变量只对当前 PowerShell 会话有效，建议使用环境变量传递凭据，避免 Cookie 或 Token 出现在命令历史中。

Session cookie 环境变量：

```powershell
Remove-Item Env:SKILL_HUB_ADMIN_TOKEN, Env:NEW_API_ADMIN_TOKEN -ErrorAction SilentlyContinue
$env:SKILL_HUB_BASE_URL = "https://your-new-api.example.com"
$env:SKILL_HUB_SESSION_COOKIE = "session=your-session-cookie"
$env:SKILL_HUB_ADMIN_USER_ID = "1"
```

Access token 环境变量：

```powershell
Remove-Item Env:SKILL_HUB_SESSION_COOKIE, Env:NEW_API_SESSION_COOKIE -ErrorAction SilentlyContinue
$env:SKILL_HUB_BASE_URL = "https://your-new-api.example.com"
$env:SKILL_HUB_ADMIN_TOKEN = "your-admin-access-token"
$env:SKILL_HUB_ADMIN_USER_ID = "1"
```

### Manifest 示例

可以直接参考同目录下的 `manifest.example.json`。

```json
[
  {
    "id": "demo-skill",
    "name": "Demo Skill",
    "description": "A demo skill.",
    "version": "1.0.0",
    "author": "Team",
    "origin": "Clawhub",
    "originUrl": "https://clawhub.ai/skills/demo-skill",
    "license": "MIT License",
    "tags": ["开发工具", "Agent"],
    "verified": true,
    "recommended": false,
    "sort": 0,
    "evaluation": {
      "overallRating": "优秀",
      "dimensions": {
        "safety": { "score": 4.8, "review": "未发现已知高风险行为。" },
        "access": { "score": 4.5, "review": "权限范围合理。" },
        "frontier": { "score": 4.4, "review": "能力与工具调用方式较先进。" },
        "economy": { "score": 4.0, "review": "Token 消耗控制良好。" }
      }
    },
    "zip": "./packages/demo-skill.zip",
    "icon": "./icons/demo-skill.png",
    "testcases": "./testcases/demo-skill.json"
  }
]
```

`testcases` 文件示例：

```json
{
  "slug": "demo-skill-cases",
  "testcases": [
    {
      "id": 1,
      "question": "用户问题",
      "answer": "# Markdown 回答",
      "sortOrder": 0
    }
  ]
}
```

JSONL 也支持：

```jsonl
{"id":"demo-skill","name":"Demo Skill","version":"1.0.0","tags":["开发工具"],"zip":"./packages/demo-skill.zip","icon":"./icons/demo-skill.png","testcases":"./testcases/demo-skill.json"}
{"id":"code-review","name":"Code Review","tags":["开发工具"],"zip":"./packages/code-review.zip"}
```

### 运行

先打开 PowerShell 并切换到仓库根目录。可先检查 Node.js 和脚本帮助；后续命令都从仓库根目录执行：

```powershell
Set-Location "D:\path\to\z-up-new-api"
node --version
node ".\scripts\skill-hub-batch-upload\upload.js" --help
```

设置好上面的任一种鉴权环境变量后，先执行 dry-run。PowerShell 的续行符是反引号 `` ` ``，其后不能有空格：

```powershell
node ".\scripts\skill-hub-batch-upload\upload.js" `
  --manifest "D:\skills\manifest.jsonl" `
  --mode skip `
  --dry-run

if ($LASTEXITCODE -ne 0) {
  throw "Dry-run 失败，请检查 skill-hub-batch-upload-report.json"
}
```

确认 dry-run 报告后正式上传。脚本会自动读取当前会话中的 session cookie 或 access token 环境变量：

```powershell
node ".\scripts\skill-hub-batch-upload\upload.js" `
  --manifest "D:\skills\manifest.jsonl" `
  --mode skip `
  --concurrency 2

if ($LASTEXITCODE -ne 0) {
  throw "上传存在失败项，请检查 skill-hub-batch-upload-report.json"
}
```

查看 JSON 报告：

```powershell
Get-Content -Raw ".\skill-hub-batch-upload-report.json" | ConvertFrom-Json
```

### 冲突策略

- `--mode skip`：远端已有同 ID 时跳过，默认值，适合首次批量导入
- `--mode update`：远端已有同 ID 时同步更新 metadata、zip、icon 和案例；manifest 提供本地图标时上传替换，省略 `icon` 或设为 `""` 时清空远端已有图标，省略 `testcases` 或设为 `""` 时清空远端已有案例
- `--mode fail`：远端已有同 ID 时标记失败

### 输出报告

默认生成 `skill-hub-batch-upload-report.json`。报告包含每条 Skill 的状态、动作、原始 sort、实际上传 sort、案例文件摘要、OSS object 和 checksum，不会嵌入完整 `SKILL.md` 或案例正文。只要存在失败项，脚本退出码就是 `1`。

## English

This directory contains the Skill Hub batch upload script. The script orchestrates bulk work only; it does not write the database directly. ZIP and icon files still use the existing admin upload flow:

1. `POST /api/admin/skill-hub/direct-upload/init`
2. OSS signed URL `PUT`
3. `POST /api/admin/skill-hub/direct-upload/complete`
4. `POST` or `PUT /api/admin/skill-hub/skills`

This keeps authorization, temporary OSS object handling, file header validation, checksum calculation, object promotion, old object cleanup, and tag synchronization in the backend.

### Data Rules

- `id` must match `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`: start with a letter or digit, followed by letters, digits, dots, underscores, or hyphens, up to 128 characters total
- `name` is required and must contain no more than 100 characters. The script validates it before both dry-runs and uploads
- `zip` is required. It must be a local `.zip` file. The script checks that it exists before upload. Maximum size: 50 MB
- `icon` is optional. When provided, it must be a local `.png`, `.jpg`, `.jpeg`, or `.webp` file with a maximum size of 1 MB. In `--mode update`, omitting `icon` or setting it to `""` clears the existing remote icon
- `tags` are tag names, not tag IDs, for example `["Developer Tools", "Agent"]`. Each tag is limited to 40 characters and cannot contain `/` or `\`
- `origin` and `originUrl` are optional source metadata, for example `"Clawhub"` and the original project URL. `origin` is limited to 64 characters; `originUrl` must be an absolute HTTP/HTTPS URL with at most 2048 characters
- `license` is optional with a limit of 128 characters. Optional `evaluation` uses the same inline JSON shape returned by the detail API. Evaluation uses the fixed `safety`, `access`, `frontier`, and `economy` dimensions; every dimension and the optional overall score must be between `0` and `5`
- `testcases` is an optional local UTF-8 `.json` file path, not inline JSON or a remote URL. The script reads and validates the file before sending the parsed object to the Skill API. The file is limited to 2 MB and 50 cases; its `slug` does not need to match the skill ID
- `sort` must be an integer. A value of `0`, including the omitted default, is uploaded as `1000000`; other values are preserved
- All imported skills are forced to `published: true`
- Relative paths in the manifest are resolved from the manifest file directory

### Authentication

Admin APIs support either a session cookie or a system management access token. In both modes, `--user-id` must be the admin user ID because the backend checks `New-Api-User` against the authenticated user.

- Session cookie: copy the current site Cookie from browser DevTools after the admin logs in. It must include at least `session=...`. This is the recommended mode.
- Access token: generate it after login by calling `GET /api/user/token`. This is not a normal API key from the API Keys page.

Run all commands below in PowerShell. Environment variables only affect the current PowerShell session. Passing credentials through environment variables is recommended so cookies and tokens do not appear in command history.

Session cookie environment:

```powershell
Remove-Item Env:SKILL_HUB_ADMIN_TOKEN, Env:NEW_API_ADMIN_TOKEN -ErrorAction SilentlyContinue
$env:SKILL_HUB_BASE_URL = "https://your-new-api.example.com"
$env:SKILL_HUB_SESSION_COOKIE = "session=your-session-cookie"
$env:SKILL_HUB_ADMIN_USER_ID = "1"
```

Access token environment:

```powershell
Remove-Item Env:SKILL_HUB_SESSION_COOKIE, Env:NEW_API_SESSION_COOKIE -ErrorAction SilentlyContinue
$env:SKILL_HUB_BASE_URL = "https://your-new-api.example.com"
$env:SKILL_HUB_ADMIN_TOKEN = "your-admin-access-token"
$env:SKILL_HUB_ADMIN_USER_ID = "1"
```

### Manifest Example

You can also start from `manifest.example.json` in this directory.

```json
[
  {
    "id": "demo-skill",
    "name": "Demo Skill",
    "description": "A demo skill.",
    "version": "1.0.0",
    "author": "Team",
    "origin": "Clawhub",
    "originUrl": "https://clawhub.ai/skills/demo-skill",
    "license": "MIT License",
    "tags": ["Developer Tools", "Agent"],
    "verified": true,
    "recommended": false,
    "sort": 0,
    "zip": "./packages/demo-skill.zip",
    "icon": "./icons/demo-skill.png",
    "testcases": "./testcases/demo-skill.json"
  }
]
```

Example `testcases` file:

```json
{
  "slug": "demo-skill-cases",
  "testcases": [
    {
      "id": 1,
      "question": "User question",
      "answer": "# Markdown answer",
      "sortOrder": 0
    }
  ]
}
```

JSONL is also supported:

```jsonl
{"id":"demo-skill","name":"Demo Skill","version":"1.0.0","tags":["Developer Tools"],"zip":"./packages/demo-skill.zip","icon":"./icons/demo-skill.png","testcases":"./testcases/demo-skill.json"}
{"id":"code-review","name":"Code Review","tags":["Developer Tools"],"zip":"./packages/code-review.zip"}
```

### Run

Open PowerShell and switch to the repository root. You can check Node.js and display the script help first. Run all subsequent commands from the repository root:

```powershell
Set-Location "D:\path\to\z-up-new-api"
node --version
node ".\scripts\skill-hub-batch-upload\upload.js" --help
```

After configuring either authentication environment above, run a dry-run first. The PowerShell line-continuation character is the backtick `` ` ``; do not put spaces after it:

```powershell
node ".\scripts\skill-hub-batch-upload\upload.js" `
  --manifest "D:\skills\manifest.jsonl" `
  --mode skip `
  --dry-run

if ($LASTEXITCODE -ne 0) {
  throw "Dry-run failed; inspect skill-hub-batch-upload-report.json"
}
```

After reviewing the dry-run report, start the upload. The script automatically reads the session cookie or access token environment from the current PowerShell session:

```powershell
node ".\scripts\skill-hub-batch-upload\upload.js" `
  --manifest "D:\skills\manifest.jsonl" `
  --mode skip `
  --concurrency 2

if ($LASTEXITCODE -ne 0) {
  throw "One or more uploads failed; inspect skill-hub-batch-upload-report.json"
}
```

View the JSON report:

```powershell
Get-Content -Raw ".\skill-hub-batch-upload-report.json" | ConvertFrom-Json
```

### Conflict Modes

- `--mode skip`: skip skills that already exist remotely. This is the default and safest first-import mode
- `--mode update`: synchronize metadata, ZIP, icon, and testcases when the skill already exists. A local icon replaces the remote icon; omitting `icon` or setting it to `""` clears the existing remote icon, while omitting `testcases` or setting it to `""` clears the existing testcases
- `--mode fail`: mark existing remote skills as failed

### Report

The default report path is `skill-hub-batch-upload-report.json`. It includes per-skill status, action, original sort, uploaded sort, testcase file summary, OSS object, checksum, and related upload details. It does not embed the full `SKILL.md` or testcase content. If any item fails, the script exits with code `1`.
