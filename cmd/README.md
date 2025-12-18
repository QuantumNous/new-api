# 命令行工具

本目录包含用于渠道池治理的命令行工具。

## 工具列表

### 1. channel-health-check - 渠道健康检查

定时探测便宜池渠道，自动禁用失效账号，支持冷却恢复。

#### 编译

```bash
go build -o bin/channel-health-check ./cmd/channel-health-check
```

#### 使用

```bash
# 单次运行，检查 priority >= 100 的渠道
./bin/channel-health-check -priority 100

# 循环模式，每 5 分钟检查一次
./bin/channel-health-check -priority 100 -interval 300

# 详细输出
./bin/channel-health-check -priority 100 -v
```

#### 参数说明

| 参数                 | 说明                             | 默认值 |
| -------------------- | -------------------------------- | ------ |
| `-priority`          | 检查 priority >= 此值的渠道      | `100`  |
| `-interval`          | 循环间隔（秒），0 表示只运行一次 | `0`    |
| `-cooldown-fatal`    | Fatal 错误冷却时间（小时）       | `6`    |
| `-cooldown-throttle` | 限流错误冷却时间（分钟）         | `5`    |
| `-max-retries`       | 最大恢复重试次数                 | `3`    |
| `-v`                 | 详细输出                         | -      |

#### 环境变量

工具需要数据库连接，支持以下环境变量：

- `SQL_DSN`: MySQL 连接字符串（如 `root:password@tcp(localhost:3306)/newapi`）
- `SQLITE_PATH`: SQLite 数据库路径（默认 `./newapi.db`）

也可以在项目根目录创建 `.env` 文件配置。

#### Cron 配置示例

```bash
# 每 5 分钟运行一次健康检查
*/5 * * * * cd /path/to/new-api && ./bin/channel-health-check -priority 100 >> /var/log/channel-health-check.log 2>&1
```

---

### 2. channel-batch-manager - 渠道批量管理

批量导入渠道、按 Tag 管理渠道、查看统计信息。

#### 编译

```bash
go build -o bin/channel-batch-manager ./cmd/channel-batch-manager
```

#### 使用

```bash
# 查看 Tag 统计
./bin/channel-batch-manager stats

# 按 Tag 禁用渠道
./bin/channel-batch-manager disable -tag merchant-a-batch1

# 按 Tag 启用渠道
./bin/channel-batch-manager enable -tag merchant-a-batch1

# 从 CSV 导入渠道
./bin/channel-batch-manager import -file channels.csv -tag merchant-a-batch1 -priority 100

# 从 JSON 导入渠道
./bin/channel-batch-manager import -file channels.json -tag merchant-a-batch1

# 导出渠道到 CSV
./bin/channel-batch-manager export -file backup.csv

# 导出指定 Tag 的渠道
./bin/channel-batch-manager export -file merchant-a.csv -tag merchant-a-batch1

# 为渠道批量设置 Tag
./bin/channel-batch-manager set-tag -ids 1,2,3 -tag merchant-b
```

#### 命令说明

| 命令      | 说明            | 必需参数                           |
| --------- | --------------- | ---------------------------------- |
| `stats`   | 查看 Tag 统计   | -                                  |
| `disable` | 按 Tag 禁用渠道 | `-tag <tag>`                       |
| `enable`  | 按 Tag 启用渠道 | `-tag <tag>`                       |
| `import`  | 从文件导入渠道  | `-file <file>`, `-tag <tag>`       |
| `export`  | 导出渠道到文件  | `-file <file>`                     |
| `set-tag` | 批量设置 Tag    | `-ids <id1,id2,...>`, `-tag <tag>` |

#### import 命令参数

| 参数        | 说明         | 默认值             |
| ----------- | ------------ | ------------------ |
| `-file`     | 导入文件路径 | 必填               |
| `-tag`      | 渠道标签     | 必填               |
| `-priority` | 默认优先级   | `100`              |
| `-group`    | 默认分组     | `default,vip,free` |

---

## 导入文件格式

模板文件位于 `cmd/templates/` 目录：

- `channels_import_template.csv` - CSV 导入模板
- `channels_import_template.json` - JSON 导入模板

### CSV 格式

```csv
name,type,key,base_url,models,priority,weight,group
便宜池-OpenAI-A,openai,sk-xxx1,,gpt-4o,100,10,"default,vip,free"
便宜池-OpenAI-B,openai,sk-xxx2,,gpt-4o-mini,100,5,"default,vip"
```

简化格式（使用默认值）：

```csv
name,key
号商A账号1,sk-xxx1
号商A账号2,sk-xxx2
```

多 Key 格式（Key 用换行符分隔）：

```csv
name,key,models
便宜池-多Key,"sk-xxx1
sk-xxx2
sk-xxx3",gpt-4o
```

### JSON 格式

```json
[
  {
    "name": "便宜池-OpenAI-A",
    "type": 1,
    "key": "sk-xxx1\nsk-xxx2\nsk-xxx3",
    "models": "gpt-4o,gpt-4o-mini",
    "priority": 100,
    "weight": 10,
    "group": "default,vip,free",
    "auto_ban": 1,
    "channel_info": {
      "is_multi_key": true,
      "multi_key_mode": "random"
    }
  }
]
```

---

## 渠道类型映射

| 类型名称         | 类型 ID |
| ---------------- | ------- |
| openai           | 1       |
| azure            | 3       |
| anthropic/claude | 14      |
| gemini/google    | 24      |
| deepseek         | 37      |
| mistral          | 29      |
| groq             | 31      |
| cohere           | 26      |
| zhipu            | 18      |
| qwen             | 17      |
| baichuan         | 25      |
| moonshot         | 16      |
| minimax          | 19      |
| custom           | 8       |

---

## Tag 命名建议

建议采用以下命名规范：

```
{来源}-{批次}
```

示例：

- `merchant-a-batch1` - 号商 A 的第 1 批账号
- `merchant-a-batch2` - 号商 A 的第 2 批账号
- `merchant-b-trial` - 号商 B 的体验账号
- `official-openai` - 官方 OpenAI 账号
- `official-anthropic` - 官方 Anthropic 账号

---

## 使用场景示例

### 场景 1：新增一批号商账号

```bash
# 1. 准备 CSV 文件
cat > new_accounts.csv << 'EOF'
name,key,models
号商A新批次-1,sk-xxx1,gpt-4o
号商A新批次-2,sk-xxx2,gpt-4o
号商A新批次-3,sk-xxx3,gpt-4o-mini
EOF

# 2. 导入并打 Tag
./bin/channel-batch-manager import -file new_accounts.csv -tag merchant-a-batch2 -priority 100

# 3. 运行健康检查
./bin/channel-health-check -priority 100
```

### 场景 2：某号商账号批量失效

```bash
# 1. 查看 Tag 统计，确认问题范围
./bin/channel-batch-manager stats

# 2. 批量禁用该号商的账号
./bin/channel-batch-manager disable -tag merchant-a-batch1

# 3. 联系号商获取新账号后，导入新批次
```

### 场景 3：定时健康检查

```bash
# crontab 配置
# 每 5 分钟检查便宜池
*/5 * * * * cd /path/to/new-api && ./bin/channel-health-check -priority 100 >> /var/log/health_check.log 2>&1
```

---

## 编译所有工具

```bash
# 在项目根目录执行
make tools

# 或手动编译
go build -o bin/channel-health-check ./cmd/channel-health-check
go build -o bin/channel-batch-manager ./cmd/channel-batch-manager
```

编译后的二进制文件位于 `bin/` 目录。
