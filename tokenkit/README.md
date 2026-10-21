# TokenKit

TokenKit 是从 [new-api](https://github.com/QuantumNous/new-api) 中拆分出的独立 Go 模块，用来在不调用上游 API 的情况下，计算或估算大模型请求的 token 数。

它只做计数，不负责解析请求、下载图片或计费。调用方传入文本，或者图片的尺寸和 detail 设置，TokenKit 返回 token 数。可以脱离 new-api 主模块，嵌入其他 Go 网关、代理或客户端。

## 能力

- GPT 和 o 系列模型用 tiktoken 精确计数，GPT-4 和 GPT-3.5 走 `cl100k_base`，其余走 `o200k_base`
- Claude、Gemini 和其他模型按字符类别加权估算，Claude Opus 4.7 前后的两套 tokenizer 分开处理
- 按各家公开的尺寸规则计算图片 token，包括 OpenAI 的 detail 级别和 Gemini 3 的 media resolution
- 不依赖 new-api 主模块、Gin、数据库或全局设置

## 准确度

文本权重是用真实 agent 会话校准的：从 Claude Code 和 Codex 的会话里取了 54 段，包括工具定义、工具调用和工具输出，和上游返回的 usage 逐条对比。

| 模型 | 测试模型 | prompt 偏差 / 平均误差 | 输出文本 偏差 / 平均误差 |
|---|---|---|---|
| Claude（4.7 之前） | claude-haiku-4-5 | +0.5% / 3.3% | −0.6% / 3.8% |
| Claude（4.7 及以后） | claude-sonnet-5 | +0.3% / 3.5% | −1.1% / 4.3% |
| GPT（估算） | gpt-5.6-luna | +0.9% / 2.9% | −1.8% / 5.3% |
| Gemini | gemini-3.7-flash | +0.7% / 4.2% | −1.3% / 4.7% |

GPT 用 `Count` 时和 tiktoken 基本一致。有两处已知差异：
- 只含缩进空格的空行会多算 1 个 token，来自 tiktoken-go v0.8.1 的分词正则，1.2 MB 的 agent 文本上一共多 3 个。
- 超过 1024 字节、中间没有分隔的连续片段（例如没有标点的长段汉字、长串空格）会被切开再计数，误差不到 0.5%。不切的话，BPE 的耗时随片段长度平方增长：10 万个连续汉字要 20 秒左右，切开后约 0.1 秒。

估算适合 agent 流量：代码、JSON、命令输出和中英文混排。几百 token 的短文本误差会大一些。

图片规则和上游实测一致：OpenAI 的 patch 和 tile 计算、Claude 两个分辨率档位、Gemini 2.x 的切块。例外和注意事项见[图片](#图片)。

## 安装

TokenKit 要求 Go 1.26 或更高版本。

```bash
go get github.com/QuantumNous/new-api/tokenkit@latest
```

## 快速开始

```go
package main

import (
	"fmt"

	"github.com/QuantumNous/new-api/tokenkit"
)

func main() {
	prompt := "读取 main.go 并解释 init 函数"

	// GPT 用 tiktoken 精确计数，其他模型估算
	fmt.Println(tokenkit.Count("gpt-5.6-sol", prompt))
	fmt.Println(tokenkit.Count("claude-opus-5-5", prompt))

	// 只要估算，不跑 tokenizer，比如流式输出中途断开时补算 completion
	fmt.Println(tokenkit.Estimate("gpt-5.6-sol", prompt))

	// 一张 1920×1080 的截图
	shot := tokenkit.Image{Width: 1920, Height: 1080}
	fmt.Println(tokenkit.ImageTokens("claude-opus-5-5", shot))  // 2694
	fmt.Println(tokenkit.ImageTokens("claude-haiku-4-5", shot)) // 1564
	shot.Detail = "low"
	fmt.Println(tokenkit.ImageTokens("gpt-5.6-sol", shot)) // 173
}
```

## 模型分组

`ModelFamily` 按模型名分组，不区分大小写，允许带厂商前缀和日期后缀，例如 `us.anthropic.claude-opus-4-7-v1:0`、`claude-sonnet-4-5-20250929`。

| 分组 | 匹配 | 文本 |
|---|---|---|
| `FamilyOpenAI` | 名称含 `gpt-`、`o1`、`o3`、`o4`、`chatgpt` | `Count` 精确，`Estimate` 估算 |
| `FamilyClaude` | Claude 4.7 之前，例如 Haiku 4.5、Sonnet 4.6 | 估算 |
| `FamilyClaude47` | Claude 4.7 及以后，以及读不出版本号的名称，例如 Opus 4.7、Sonnet 5、Fable、Mythos | 估算 |
| `FamilyGemini` | 名称含 `gemini` | 估算 |
| `FamilyUnknown` | 其他模型 | 估算，权重未校准 |

Claude 4.7 及以后的 tokenizer 对同样的文本多出约 30% 的 token，所以两组 Claude 用不同的权重。

## 图片

`ImageTokens(model, Image)` 返回一张图片占用的 prompt token。`Image.Width` 和 `Image.Height` 是像素尺寸，为 0 时按 1024×1024 计算。`ImageNeedsSize` 判断某个模型和 detail 设置下是否需要尺寸；返回 false 时可以不读取图片。

| 模型 | 计算方式 |
|---|---|
| gpt-5.2 及以后、gpt-6 | 32px patch × 1.2，按模型和 detail 缩放；不传 detail 时 gpt-5.5 及以后按 `original` 计算 |
| gpt-5、gpt-5.1、gpt-4o、gpt-4.1、o1、o3 | 512px tile，加 base tokens |
| Claude 4.7 之前 | ⌈宽/28⌉ × ⌈高/28⌉，最长边 1568，最多 1568 个 patch，另加 4 |
| Claude 4.7 及以后 | 同上，最长边 2576，最多 4784 个 patch，另加 3 |
| Gemini 3 | 与尺寸无关，按 media resolution：280 / 560 / 1120 / 2240，默认 1120 |
| Gemini 2.x | 两边都不超过 384 时 258；更大的图切成方块，每块 258，最多 12 块，另加 1 块缩略图 |
| 其他模型 | 每张 520 |

`Image.Detail` 填 OpenAI 的 detail（`low`、`high`、`auto`、`original`），或 Gemini 的 media resolution（`MEDIA_RESOLUTION_LOW` 等）。两类值只在对应的模型上生效，例如 Gemini 会忽略 `low`。

注意事项：

- 有两处按上游实际计费，而不是按官方文档。gpt-5.5 和 gpt-5.6 的 `high` 先缩到 2048×2048 以内，最短边再缩到 768，文档写的是 2500 patch 预算。gpt-6 的 `high` 先缩到 2048×2048 以内，再按 2500 patch 预算缩放，文档没有写 2048 这一步。
- Gemini 3 用的是文档值。实测按图片宽高比低 2% 到 9%。
- Gemini 2.x 的 4K 图会多算：3840×2160 实际 2322，这里给 3354。
- 图片尺寸来自请求方，可能被伪造。超过 65535 像素的边会先缩小，单张最多按 30000 个 patch 计算，结果始终有上限。

## 开发

TokenKit 必须始终保持独立可构建，不依赖 new-api 主模块或 RelayKit。修改模块后，在 `tokenkit` 目录运行：

```bash
GOWORK=off go test ./...
GOWORK=off go build ./...
```

`image_test.go` 里的期望值是上游实测值。改动图片规则时，用同样的方法重新测量：同一个请求带图和不带图各发一次，两次 input token 的差就是这张图的消耗。

## 版本与兼容性

TokenKit 当前使用 `v0.x` 版本，公开 API 可能在小版本中调整。估算权重和图片规则会随上游模型更新重新校准，同样的输入在不同版本之间可能得到不同的结果。

## 许可证

TokenKit 是 new-api 项目的一部分，遵循项目根目录中的 [GNU Affero General Public License v3.0](../LICENSE)。
