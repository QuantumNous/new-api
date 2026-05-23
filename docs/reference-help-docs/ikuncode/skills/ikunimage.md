# ikunimage - AI 图片生成器

> 来源：https://docs.ikuncode.cc/zh/skills/ikunimage
>
> 抓取时间：2026-05-23T07:09:46.142Z

## 页面大纲

- ikunimage - AI 图片生成器
  - 🔗 相关链接
  - ✨ 功能特点
  - 📋 前置要求
  - 🛠️ 安装
    - 第一步：下载 Skill
    - 第二步：安装依赖
    - 第三步：配置 API Key
  - 📖 使用方法
    - 在 Claude Code 中使用
    - 独立脚本使用
  - 📐 参数速查
    - 文生图 (generate_ikun.py)
    - 图生图 (generate_ikun_edit.py)
  - 📊 分辨率参考
    - 1K（快速预览）
    - 2K（推荐）
    - 4K（超高清）
  - 🖼️ 图生图支持格式
  - 常见问题
    - 提示 "未找到 API Key"？
    - 请求超时？
    - 收到 429 错误？
    - 更多问题

## 原文内容

# ikunimage - AI 图片生成器

**Claude Code Skill — 通过 ikun API 调用 Gemini 图像模型，支持文生图与图生图**

📋 简介

ikunimage 是一款 Claude Code Skill 插件，通过 [ikun API](https://api.ikuncode.cc/) 调用 **NanoBananaPro（Gemini 3 Pro Image Preview）** 模型，在 Claude Code 对话中直接生成高质量图片。支持文生图、图生图编辑、批量并发等多种模式。

## 🔗 相关链接

| 资源 | 地址 |
| --- | --- |
| GitHub 仓库 | [deijing/ikunimage](https://github.com/deijing/ikunimage) |
| ikun API | [api.ikuncode.cc](https://api.ikuncode.cc/) |

## ✨ 功能特点

-   ✅ **文生图**：用自然语言描述场景，AI 生成对应图片
-   ✅ **图生图**：上传本地图片 + 编辑描述，AI 修改生成新图片
-   ✅ **10 种宽高比**：1:1 / 16:9 / 9:16 / 4:3 / 3:4 / 3:2 / 2:3 / 21:9 / 5:4 / 4:5
-   ✅ **3 档分辨率**：1K（快速预览）/ 2K（推荐）/ 4K（超高清）
-   ✅ **文字渲染**：支持在图片中渲染中文文字（招牌、海报、标语等）
-   ✅ **并发批量**：多张图片并发生成，大幅缩短总耗时
-   ✅ **配置文件管理**：API Key 存储在本地配置文件，安全便捷

## 📋 前置要求

-   [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI 已安装
-   Python 3.10+
-   ikun API Key（从 [api.ikuncode.cc](https://api.ikuncode.cc/) 获取）

## 🛠️ 安装

### 第一步：下载 Skill

bash

```
# 如果目录不存在，先创建
mkdir -p ~/.claude/skills

# 克隆 ikunimage 到 skills 目录
cd ~/.claude/skills
git clone https://github.com/deijing/ikunimage.git
```

安装完成后目录结构如下：

```
~/.claude/skills/ikunimage/
├── SKILL.md                        # Skill 定义文件
├── scripts/
│   ├── generate_ikun.py            # 文生图脚本
│   └── generate_ikun_edit.py       # 图生图脚本
└── references/
    └── api-reference.md            # API 参考文档
```

### 第二步：安装依赖

bash

```
pip install httpx
```

### 第三步：配置 API Key

三种方式任选其一：

**方式 A：交互式配置（推荐）**

bash

```
python ~/.claude/skills/ikunimage/scripts/generate_ikun.py --setup
```

按提示输入你的 API Key 即可，配置会保存到 `~/.ikunimage/config.json`。

**方式 B：手动创建配置文件**

bash

```
mkdir -p ~/.ikunimage
echo '{"api_key": "sk-你的key"}' > ~/.ikunimage/config.json
```

**方式 C：环境变量**

bash

```
export IKUN_API_KEY="sk-你的key"
```

💡 API Key 加载优先级

`--api-key` 命令行参数 > `IKUN_API_KEY` 环境变量 > `~/.ikunimage/config.json` 配置文件

## 📖 使用方法

### 在 Claude Code 中使用

安装配置完成后，在 Claude Code 对话中输入：

```
/ikunimage
```

然后描述你想要的图片即可。例如：

-   "画一张江南水乡的风景"
-   "生成一张 4K 超宽屏的故宫雪景"
-   "批量生成 5 张不同风格的古风人像"

图生图编辑：

-   "编辑 /path/to/photo.jpg，把背景改成竹林"

### 独立脚本使用

也可以脱离 Claude Code，直接在命令行中调用。

**文生图**：

bash

```
python ~/.claude/skills/ikunimage/scripts/generate_ikun.py \
  -p "一位中国女性，身穿汉服，站在竹林中，晨雾缭绕" \
  -ar 3:4 \
  -s 2K \
  -o ./output.png
```

**图生图**：

bash

```
python ~/.claude/skills/ikunimage/scripts/generate_ikun_edit.py \
  -i ./photo.jpg \
  -p "将背景改为雪景，保持人物不变" \
  -ar 3:4 \
  -o ./edited.png
```

**批量生成**：

bash

```
# 准备任务文件 tasks.json
cat > tasks.json << 'EOF'
[
  {"prompt": "描述1", "aspect_ratio": "3:4", "size": "2K", "output": "./out1.png"},
  {"prompt": "描述2", "aspect_ratio": "16:9", "size": "1K", "output": "./out2.png"}
]
EOF

# 执行批量生成
python ~/.claude/skills/ikunimage/scripts/generate_ikun.py \
  --batch tasks.json \
  --workers 2
```

## 📐 参数速查

### 文生图 (generate\_ikun.py)

| 参数 | 简写 | 说明 | 默认值 |
| --- | --- | --- | --- |
| `--setup` |  | 交互式配置 API Key |  |
| `--api-key` |  | 指定 API Key | 从配置加载 |
| `--prompt` | `-p` | 图片描述（必填） |  |
| `--aspect-ratio` | `-ar` | 宽高比 | `1:1` |
| `--size` | `-s` | 分辨率（1K/2K/4K） | `2K` |
| `--output` | `-o` | 输出路径 | `output.png` |
| `--batch` | `-b` | 批量任务 JSON 文件 |  |
| `--workers` | `-w` | 并发数 | 自动（默认 2） |
| `--retry` | `-r` | 重试次数（0-10） | `3` |

### 图生图 (generate\_ikun\_edit.py)

| 参数 | 简写 | 说明 | 默认值 |
| --- | --- | --- | --- |
| `--setup` |  | 交互式配置 API Key |  |
| `--api-key` |  | 指定 API Key | 从配置加载 |
| `--input` | `-i` | 输入图片路径（必填） |  |
| `--prompt` | `-p` | 编辑描述（必填） |  |
| `--aspect-ratio` | `-ar` | 输出宽高比 | `1:1` |
| `--output` | `-o` | 输出路径 | `output.png` |
| `--batch` | `-b` | 批量任务 JSON 文件 |  |
| `--workers` | `-w` | 并发数 | 自动（默认 2） |
| `--retry` | `-r` | 重试次数（0-10） | `3` |

⚠️ 互斥参数

`--prompt` 和 `--batch` 互斥，单图模式和批量模式必须二选一。

## 📊 分辨率参考

### 1K（快速预览）

| 宽高比 | 分辨率 |
| --- | --- |
| 1:1 | 1024×1024 |
| 16:9 | 1376×768 |
| 9:16 | 768×1376 |
| 4:3 | 1200×896 |
| 3:4 | 896×1200 |

### 2K（推荐）

| 宽高比 | 分辨率 |
| --- | --- |
| 1:1 | 2048×2048 |
| 16:9 | 2752×1536 |
| 9:16 | 1536×2752 |
| 4:3 | 2400×1792 |
| 3:4 | 1792×2400 |

### 4K（超高清）

| 宽高比 | 分辨率 |
| --- | --- |
| 1:1 | 4096×4096 |
| 16:9 | 5504×3072 |
| 9:16 | 3072×5504 |
| 4:3 | 4800×3584 |
| 3:4 | 3584×4800 |

## 🖼️ 图生图支持格式

| 格式 | 支持 | 备注 |
| --- | --- | --- |
| JPG / JPEG | ✅ | 推荐 |
| PNG | ✅ | 推荐 |
| WebP | ✅ |  |
| GIF | ✅ | 仅使用第一帧 |

💡 建议

图片大小推荐 < 4MB，过大可能导致上传变慢或超时。

## 常见问题

### 提示 "未找到 API Key"？

运行交互式配置命令：

bash

```
python ~/.claude/skills/ikunimage/scripts/generate_ikun.py --setup
```

### 请求超时？

4K 图片生成较慢，脚本已设置充足的超时时间。如果仍然超时，可降低分辨率到 2K 或 1K。

### 收到 429 错误？

触发了 API 频率限制。脚本会自动指数退避重试（默认 3 次）。可加 `--retry 5` 增加重试次数。

### 更多问题

请查看 [FAQ](https://docs.ikuncode.cc/support/faq) 或联系[售后支持](https://docs.ikuncode.cc/support/after-sales)。
