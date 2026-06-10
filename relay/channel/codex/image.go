package codex

import (
	"bufio"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"sort"
	"strconv"
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
// 注意：命中该上限会被显式探测并返回 "response exceeded size limit"，
// 而不是静默截断后误报 "no image returned"（见 F8）。
const codexImageStreamReadLimit = 256 << 20 // 256 MiB

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

// ValidateCodexImageRequest 在请求进入上游之前做客户端侧校验。
// 目前仅校验 response_format：codex 图像路径只能返回 base64（无托管 URL），
// 因此除空值（默认 b64_json）与显式 "b64_json" 外的任何值（尤其 "url"）都直接拒绝，
// 避免静默回退到空 url 误导客户端（F7）。
//
// 设计 seam：adaptor.go 的 ConvertImageRequest 拥有 request，应在构建上游 body 前
// 调用本函数。把校验放在 image.go 是为了让规则与 codex 图像的其余逻辑同处一文件、
// 可独立测试；adaptor.go（由另一 agent 维护）只需 `if err := ValidateCodexImageRequest(request); err != nil { return nil, err }`。
func ValidateCodexImageRequest(request dto.ImageRequest) error {
	rf := strings.TrimSpace(request.ResponseFormat)
	if rf != "" && rf != "b64_json" {
		return fmt.Errorf("codex image: response_format %q not supported; codex image only supports b64_json", rf)
	}
	return nil
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
		// F6：mf.File 是 Go map，range 顺序随机。对多图编辑（image[0]/image[1]/...）
		// 必须按下标确定性排序，否则参考图顺序不可复现。先收集匹配的键，再按
		// image[ ] 内的数字自然排序，最后按序追加。
		var keys []string
		for name := range mf.File {
			if strings.HasPrefix(name, "image[") {
				keys = append(keys, name)
			}
		}
		sort.Slice(keys, func(i, j int) bool {
			return imageIndexKeyLess(keys[i], keys[j])
		})
		for _, name := range keys {
			files = append(files, mf.File[name]...)
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
		// F4：客户端提供了 mask 却无法读取/编码时必须致命报错。
		// 若静默回退到无 mask 编辑，会得到语义错误的整图结果——而用户仍被计费。
		u, e := fileHeaderToDataURL(mfs[0])
		if e != nil {
			return nil, "", fmt.Errorf("codex image: failed to read mask %q: %w", mfs[0].Filename, e)
		}
		mask = u
	}
	return images, mask, nil
}

// imageIndexKeyLess 比较两个形如 "image[N]" 的键，优先按 N 的数值升序；
// 数值解析失败时回退到字典序，保证比较全序且确定。
func imageIndexKeyLess(a, b string) bool {
	ai, aok := parseImageIndex(a)
	bi, bok := parseImageIndex(b)
	if aok && bok {
		if ai != bi {
			return ai < bi
		}
		return a < b
	}
	if aok != bok {
		// 能解析出数值的排在前面
		return aok
	}
	return a < b
}

// parseImageIndex 从 "image[N]" 提取数字 N。
func parseImageIndex(key string) (int, bool) {
	const prefix = "image["
	if !strings.HasPrefix(key, prefix) || !strings.HasSuffix(key, "]") {
		return 0, false
	}
	inner := key[len(prefix) : len(key)-1]
	if inner == "" {
		return 0, false
	}
	n, err := strconv.Atoi(inner)
	if err != nil {
		return 0, false
	}
	return n, true
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
	// 仍支持合法的大体积 base64 图像行。多读 1 字节作为哨兵：若 LimitReader 在 EOF
	// 之前耗尽 codexImageStreamReadLimit，则读取到的总量会等于 limit+1（哨兵被命中），
	// 据此显式判定截断（F8）。
	const sentinel = codexImageStreamReadLimit + 1
	reader := bufio.NewReader(io.LimitReader(resp.Body, sentinel))
	var (
		data      []dto.ImageData
		created   int64
		imgUsage  gjson.Result
		hasUsage  bool
		bytesRead int64
		limitHit  bool
	)

	for {
		line, err := reader.ReadString('\n')
		bytesRead += int64(len(line))
		if bytesRead >= sentinel {
			// 命中哨兵：上游响应超过大小上限且尚未结束，base64 极可能被截断在半途。
			// 立即停止，返回一个可诊断的独立错误，而不是继续解析后误报 "no image returned"。
			limitHit = true
			break
		}
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

	if limitHit {
		// F8：截断与"上游真的没返回图像"是两种不同的失败，必须可区分。
		common.SysError(fmt.Sprintf("codex image: upstream SSE exceeded %d bytes read limit, treating as truncated", int64(codexImageStreamReadLimit)))
		return nil, types.NewError(errors.New("codex image: response exceeded size limit"), types.ErrorCodeBadResponseBody)
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

	// F2+F3+F11：逐 token 健壮化，取代旧的"hasUsage ? tokens : fallback"全或无逻辑。
	// 旧逻辑的缺陷：image_gen:{} 存在但为空、或 output_tokens:0 时，u.Exists()==true
	// 导致 hasUsage=true 但 token 全 0，计费塌到 ~0；且兜底只补 CompletionTokens，
	// 把 PromptTokens 置 0，丢掉 edit 的输入图像 token 成本。
	//
	// 新策略：分别读取 input_tokens(p)/output_tokens(comp)/total_tokens(t)，无论 image_gen
	// 是缺失、为空 {} 还是被置零，只要确实产出了图像（len(data)>0），就保证至少
	// 计入 defaultCodexImageOutputTokens 的 completion；并保留 p，使 edit 的输入图像 token 计费不丢。
	p := 0
	comp := 0
	t := 0
	if hasUsage {
		p = int(imgUsage.Get("input_tokens").Int())
		comp = int(imgUsage.Get("output_tokens").Int())
		t = int(imgUsage.Get("total_tokens").Int())
	}
	if comp <= 0 {
		// output_tokens 缺失/为零/被截断：兜底到非零默认，确保真实图像计费 >= 默认值。
		common.SysError("codex image: image produced but image_gen output_tokens missing/zero, applying fallback completion tokens")
		comp = defaultCodexImageOutputTokens
	}
	if p < 0 {
		p = 0
	}
	usage := &dto.Usage{
		PromptTokens:     p,
		CompletionTokens: comp,
	}
	// total 仅在上游给出且与 p+comp 自洽（不小于二者之和）时采用，否则用 p+comp 重算，
	// 避免上游 total 把兜底后的 completion 抵消掉。
	if t >= p+comp {
		usage.TotalTokens = t
	} else {
		usage.TotalTokens = p + comp
	}
	return usage, nil
}
