# TokenKit

TokenKit is an independent Go module split from [new-api](https://github.com/QuantumNous/new-api), used to calculate or estimate the number of tokens requested by large models without calling the upstream API.

It only does counting and is not responsible for parsing requests, downloading images, or billing. The caller passes in text, or the size and detail settings of the image, and TokenKit returns the token number. You can break away from the new-api main module and embed other Go gateways, proxies or clients.

## Abilities

- GPT and o series models use tiktoken for accurate counting, GPT-4 and GPT-3.5 go to `cl100k_base`, and the rest go to `o200k_base`
- Claude, Gemini and other models weight estimation by character category, and the two sets of tokenizers before and after Claude Opus 4.7 are processed separately
- Calculate image tokens according to the size rules disclosed by each company, including OpenAI's detail level and Gemini 3's media resolution
- Does not rely on new-api main module, Gin, database or global settings

## Accuracy

Text weights are calibrated using real agent sessions: 54 segments were taken from Claude Code and Codex sessions, including tool definitions, tool calls, and tool outputs, and compared with the usage returned by the upstream one by one.

| model | test model | prompt bias/average error | output text bias/average error |
|---|---|---|---|
| Claude (before 4.7) | claude-haiku-4-5 | +0.5% / 3.3% | −0.6% / 3.8% |
| Claude (4.7 and later) | claude-sonnet-5 | +0.3% / 3.5% | −1.1% / 4.3% |
| GPT (estimated) | gpt-5.6-luna | +0.9% / 2.9% | −1.8% / 5.3% |
| Gemini | gemini-3.7-flash | +0.7% / 4.2% | −1.3% / 4.7% |

When GPT uses `Count`, it is basically the same as tiktoken. There are two known differences:
- Blank lines containing only indented spaces will count 1 more token, which comes from the word segmentation regularization of tiktoken-go v0.8.1, and there will be a total of 3 more tokens in the 1.2 MB agent text.
- Continuous segments exceeding 1024 bytes with no separation in the middle (such as long Chinese characters without punctuation, long strings of spaces) will be cut and counted, with an error of less than 0.5%. Without cutting, the time consumption of BPE increases with the square of the fragment length: 100,000 consecutive Chinese characters take about 20 seconds, and after cutting, it takes about 0.1 seconds.

Estimates are suitable for agent traffic: code, JSON, command output, and mixed Chinese and English. The error will be larger for short texts of several hundred tokens.

The image rules are consistent with the upstream actual measurements: OpenAI's patch and tile calculations, Claude's two resolution levels, and Gemini 2.x's tiles. See [image](#image) for exceptions and caveats.

## Installation

TokenKit requires Go 1.26 or higher.

```bash
go get github.com/QuantumNous/new-api/tokenkit@latest
```

## Quick start

```go
package main

import (
	"fmt"

	"github.com/QuantumNous/new-api/tokenkit"
)

func main() {
prompt := "Read main.go and interpret the init function"

// GPT is accurately counted using tiktoken and estimated by other models
	fmt.Println(tokenkit.Count("gpt-5.6-sol", prompt))
	fmt.Println(tokenkit.Count("claude-opus-5-5", prompt))

// Just estimate, don't run tokenizer, for example, if the streaming output is interrupted midway, completion will be calculated
	fmt.Println(tokenkit.Estimate("gpt-5.6-sol", prompt))

// A 1920×1080 screenshot
	shot := tokenkit.Image{Width: 1920, Height: 1080}
	fmt.Println(tokenkit.ImageTokens("claude-opus-5-5", shot))  // 2694
	fmt.Println(tokenkit.ImageTokens("claude-haiku-4-5", shot)) // 1564
	shot.Detail = "low"
	fmt.Println(tokenkit.ImageTokens("gpt-5.6-sol", shot)) // 173
}
```

## Model grouping

`ModelFamily` is grouped by model name, is not case-sensitive, and allows manufacturer prefix and date suffix, such as `us.anthropic.claude-opus-4-7-v1:0`, `claude-sonnet-4-5-20250929`.

| group | match | text |
|---|---|---|
| `FamilyOpenAI` | Names containing `gpt-`, `o1`, `o3`, `o4`, `chatgpt` | `Count` accurate, `Estimate` estimated |
| `FamilyClaude` | Before Claude 4.7, such as Haiku 4.5, Sonnet 4.6 | Estimate |
| `FamilyClaude47` | Claude 4.7 and later, and names with unreadable version numbers, such as Opus 4.7, Sonnet 5, Fable, Mythos | Estimate |
| `FamilyGemini` | Name contains `gemini` | Estimate |
| `FamilyUnknown` | Other models | Estimates, weights uncalibrated |

The tokenizer of Claude 4.7 and later has about 30% more tokens for the same text, so the two sets of Claude use different weights.

## Pictures

`ImageTokens(model, Image)` returns the prompt token occupied by a picture. `Image.Width` and `Image.Height` are pixel sizes, which are calculated as 1024×1024 when they are 0. `ImageNeedsSize` determines whether size is required under a certain model and detail settings; when false is returned, the image does not need to be read.

| Model | Calculation method |
|---|---|
| gpt-5.2 and later, gpt-6 | 32px patch × 1.2, scaled according to model and detail; when detail is not passed, gpt-5.5 and later are calculated according to `original` |
| gpt-5, gpt-5.1, gpt-4o, gpt-4.1, o1, o3 | 512px tile, plus base tokens |
| Before Claude 4.7 | ⌈width/28⌉ × ⌈height/28⌉, longest side 1568, maximum 1568 patches, plus 4 |
| Claude 4.7 and later | Same as above, longest side 2576, maximum 4784 patches, plus 3 |
| Gemini 3 | Regardless of size, media resolution: 280 / 560 / 1120 / 2240, default 1120 |
| Gemini 2.x | 258 when neither side exceeds 384; larger images cut into cubes, 258 each, up to 12, plus 1 thumbnail |
| Other models | 520 each |

`Image.Detail` fills in OpenAI's detail (`low`, `high`, `auto`, `original`), or Gemini's media resolution (`MEDIA_RESOLUTION_LOW`, etc.). The two types of values ​​only take effect on the corresponding models. For example, Gemini will ignore `low`.

Things to note:

- There are two places where billing is based on the actual upstream, rather than official documents. The `high` of gpt-5.5 and gpt-5.6 is first reduced to within 2048×2048, and then the shortest side is reduced to 768. The document states a budget of 2500 patches. The `high` of gpt-6 is first reduced to within 2048×2048, and then scaled according to the 2500 patch budget. The document does not mention the 2048 step.
- Gemini 3 uses document values. Actual measurements range from 2% to 9% lower depending on the image aspect ratio.
- The 4K image of Gemini 2.x will be over-counted: 3840×2160. The actual 2322 is 3354 here.
- Image dimensions come from the requester and may be forged. Sides exceeding 65535 pixels will be reduced first. A single image is calculated based on a maximum of 30000 patches, and the result always has an upper limit.

## Development

TokenKit must always remain independently buildable and not dependent on the new-api main module or RelayKit. After modifying the module, run in the `tokenkit` directory:

```bash
GOWORK=off go test ./...
GOWORK=off go build ./...
```

The expected value in `image_test.go` is the upstream measured value. When changing the image rules, use the same method to re-measure: the same request is sent once with a picture and once without a picture, and the difference between the two input tokens is the consumption of this picture.

## Versions and Compatibility

TokenKit currently uses the `v0.x` version, and the public API may be adjusted in minor versions. Estimated weights and image rules are recalibrated with upstream model updates, and the same inputs may yield different results between versions.

## License

TokenKit is part of the new-api project and complies with the [GNU Affero General Public License v3.0](../LICENSE) in the project root directory.
