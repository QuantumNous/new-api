package codex

import (
	"bufio"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

// codexImageStreamReadLimit 限制 SSE 响应总字节数，防止恶意上游耗尽内存。
// 不对单行做上限（base64 图像行可能合法地超过 1MB），只约束整体读取量。
const codexImageStreamReadLimit = 128 << 20 // 128 MiB

// defaultCodexImageOutputTokens 是 image_gen 用量缺失但确实产出了图像时的兜底
// 计费 token 数（约等于 low quality 1024x1024 的输出 token），避免计费塌到 ~0。
const defaultCodexImageOutputTokens = 272

// resolveImageCarrierModel：per-channel 覆盖 > 全局设置 > 代码默认 gpt-5.4。
func resolveImageCarrierModel(info *relaycommon.RelayInfo) string {
	if info != nil {
		if m := strings.TrimSpace(info.ChannelSetting.ImageCarrierModel); m != "" {
			return m
		}
	}
	if g := strings.TrimSpace(model_setting.GetCodexSettings().ImageCarrierModel); g != "" {
		return g
	}
	return defaultImageCarrierModel
}

// buildCodexImageBody 把 OpenAI 图像请求转成 codex Responses + image_generation 工具的 body。
// inputImages / mask 为 edits 场景的 data URL（generate 时传 nil / ""）。
func buildCodexImageBody(req dto.ImageRequest, carrier, action string, inputImages []string, mask string) map[string]any {
	content := []any{map[string]any{"type": "input_text", "text": req.Prompt}}
	for _, u := range inputImages {
		content = append(content, map[string]any{"type": "input_image", "image_url": u})
	}

	tool := map[string]any{
		"type":   "image_generation",
		"action": action,
		"model":  req.Model, // gpt-image-*（已映射）
	}
	setIfNotEmpty(tool, "size", req.Size)
	setIfNotEmpty(tool, "quality", req.Quality)
	setRawIfPresent(tool, "background", req.Background)
	setRawIfPresent(tool, "output_format", req.OutputFormat)
	setRawIfPresent(tool, "output_compression", req.OutputCompression)
	setRawIfPresent(tool, "moderation", req.Moderation)
	// NOTE: 上游 image_generation 工具拒绝 'n' 参数（返回 HTTP 400
	// {"message":"Unknown parameter: 'tools[0].n'"}）。codex 图像路径每次请求只返回
	// 一张图，客户端的 'n' 不会向上游透传，因此这里不设置 tool["n"]。
	if mask != "" {
		tool["input_image_mask"] = map[string]any{"image_url": mask}
	}

	return map[string]any{
		"instructions":        "",
		"stream":              true,
		"store":               false,
		"reasoning":           map[string]any{"effort": "medium", "summary": "auto"},
		"parallel_tool_calls": true,
		"include":             []any{"reasoning.encrypted_content"},
		"model":               carrier,
		"tool_choice":         map[string]any{"type": "image_generation"},
		"input": []any{map[string]any{
			"type": "message", "role": "user", "content": content,
		}},
		"tools": []any{tool},
	}
}

func setIfNotEmpty(m map[string]any, k, v string) {
	if strings.TrimSpace(v) != "" {
		m[k] = v
	}
}

// setRawIfPresent 把 json.RawMessage（非空非 null）解码后写入 map，保持原值类型。
func setRawIfPresent(m map[string]any, k string, raw []byte) {
	s := strings.TrimSpace(string(raw))
	if s == "" || s == "null" {
		return
	}
	var v any
	if err := common.Unmarshal(raw, &v); err == nil {
		m[k] = v
	}
}

// readCodexEditImages 从已解析的 multipart 表单读取 image/image[] 与 mask 文件，转 base64 data URL。
func readCodexEditImages(c *gin.Context) (images []string, mask string, err error) {
	mf := c.Request.MultipartForm
	if mf == nil {
		if _, e := c.MultipartForm(); e != nil {
			return nil, "", fmt.Errorf("failed to parse multipart form: %w", e)
		}
		mf = c.Request.MultipartForm
	}
	if mf == nil || mf.File == nil {
		return nil, "", errors.New("no multipart form data found")
	}

	var files []*multipart.FileHeader
	if fs, ok := mf.File["image"]; ok && len(fs) > 0 {
		files = append(files, fs...)
	} else if fs, ok := mf.File["image[]"]; ok && len(fs) > 0 {
		files = append(files, fs...)
	} else {
		for name, fs := range mf.File {
			if strings.HasPrefix(name, "image[") {
				files = append(files, fs...)
			}
		}
	}
	if len(files) == 0 {
		return nil, "", errors.New("image is required")
	}
	for _, fh := range files {
		u, e := fileHeaderToDataURL(fh)
		if e != nil {
			return nil, "", e
		}
		images = append(images, u)
	}
	if mfs, ok := mf.File["mask"]; ok && len(mfs) > 0 {
		if u, e := fileHeaderToDataURL(mfs[0]); e == nil {
			mask = u
		} else {
			// mask 读取失败不致命：记录后继续以无 mask 方式处理，避免静默吞错。
			common.SysError(fmt.Sprintf("codex image: failed to read mask %q, continuing without mask: %v", mfs[0].Filename, e))
		}
	}
	return images, mask, nil
}

func fileHeaderToDataURL(fh *multipart.FileHeader) (string, error) {
	f, err := fh.Open()
	if err != nil {
		return "", fmt.Errorf("open upload %q: %w", fh.Filename, err)
	}
	defer f.Close()
	data, err := io.ReadAll(f)
	if err != nil {
		return "", fmt.Errorf("read upload %q: %w", fh.Filename, err)
	}
	mime := detectCodexImageMime(fh.Filename)
	return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(data), nil
}

func detectCodexImageMime(filename string) string {
	lower := strings.ToLower(filename)
	switch {
	case strings.HasSuffix(lower, ".jpg"), strings.HasSuffix(lower, ".jpeg"):
		return "image/jpeg"
	case strings.HasSuffix(lower, ".webp"):
		return "image/webp"
	case strings.HasSuffix(lower, ".gif"):
		return "image/gif"
	default:
		return "image/png"
	}
}

// RelayImageOverCodex 读取 codex Responses SSE 流，抽取 image_generation_call 的 base64 结果
// 与 tool_usage.image_gen 用量，回写标准 OpenAI 图像响应，返回计费用量。
func RelayImageOverCodex(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	// 用 io.LimitReader 约束 SSE 总字节数（不是单行），防止恶意上游耗尽内存；
	// 仍支持合法的大体积 base64 图像行。
	reader := bufio.NewReader(io.LimitReader(resp.Body, codexImageStreamReadLimit))
	var (
		data     []dto.ImageData
		created  int64
		imgUsage gjson.Result
		hasUsage bool
	)

	for {
		line, err := reader.ReadString('\n')
		if len(line) > 0 {
			line = strings.TrimRight(line, "\r\n")
			if strings.HasPrefix(line, "data:") {
				payload := strings.TrimSpace(line[len("data:"):])
				if payload != "" && payload != "[DONE]" {
					evType := gjson.Get(payload, "type").String()
					switch evType {
					case "response.output_item.done":
						item := gjson.Get(payload, "item")
						if item.Get("type").String() == "image_generation_call" {
							if result := item.Get("result").String(); result != "" {
								data = append(data, dto.ImageData{
									B64Json:       result,
									RevisedPrompt: item.Get("revised_prompt").String(),
								})
							}
						}
					case "response.completed":
						created = gjson.Get(payload, "response.created_at").Int()
						if u := gjson.Get(payload, "response.tool_usage.image_gen"); u.Exists() {
							imgUsage, hasUsage = u, true
						}
					case "response.failed":
						// 白标：上游错误详情仅落服务端日志，绝不透传给客户端（可能泄露
						// ChatGPT/OpenAI 品牌或内部模型名）。客户端只收到通用错误。
						if upstreamMsg := gjson.Get(payload, "response.error.message").String(); upstreamMsg != "" {
							common.SysError(fmt.Sprintf("codex image: upstream reported failure: %s", upstreamMsg))
						}
						return nil, types.NewError(errors.New("codex image generation failed"), types.ErrorCodeBadResponseBody)
					}
				}
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
		}
	}

	if len(data) == 0 {
		return nil, types.NewError(errors.New("codex image: no image returned"), types.ErrorCodeBadResponseBody)
	}
	if created == 0 {
		created = time.Now().Unix()
	}

	out := dto.ImageResponse{Created: created, Data: data}
	body, mErr := common.Marshal(out)
	if mErr != nil {
		return nil, types.NewOpenAIError(mErr, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(http.StatusOK)
	_, _ = c.Writer.Write(body)

	usage := &dto.Usage{}
	if hasUsage {
		usage.PromptTokens = int(imgUsage.Get("input_tokens").Int())
		usage.CompletionTokens = int(imgUsage.Get("output_tokens").Int())
		usage.TotalTokens = int(imgUsage.Get("total_tokens").Int())
	} else {
		// 兜底：image_gen 用量事件缺失/被截断，但确实产出了图像（len(data) > 0）。
		// 若不兜底计费会塌到 ~0，因此用 defaultCodexImageOutputTokens 估算输出。
		common.SysError("codex image: image produced but image_gen usage missing, applying fallback billing tokens")
		usage.CompletionTokens = defaultCodexImageOutputTokens
		usage.TotalTokens = defaultCodexImageOutputTokens
	}
	return usage, nil
}
