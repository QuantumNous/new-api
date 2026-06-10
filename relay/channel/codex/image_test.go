package codex

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
)

func TestBuildCodexImageBody_Generate(t *testing.T) {
	// N=2：上游拒绝 'n' 参数，因此即便客户端请求多张，tool 里也绝不能出现 "n"。
	n := uint(2)
	req := dto.ImageRequest{Model: "gpt-image-2", Prompt: "a red circle", Size: "1024x1024", Quality: "low", N: &n}
	body := buildCodexImageBody(req, "gpt-5.4", "generate", nil, "")

	if body["model"] != "gpt-5.4" {
		t.Fatalf("carrier model = %v, want gpt-5.4", body["model"])
	}
	if body["store"] != false || body["stream"] != true {
		t.Fatalf("store/stream wrong: %v / %v", body["store"], body["stream"])
	}
	tc, _ := body["tool_choice"].(map[string]any)
	if tc["type"] != "image_generation" {
		t.Fatalf("tool_choice = %v", tc)
	}
	tools, _ := body["tools"].([]any)
	if len(tools) != 1 {
		t.Fatalf("tools len = %d", len(tools))
	}
	tool, _ := tools[0].(map[string]any)
	if tool["model"] != "gpt-image-2" || tool["action"] != "generate" {
		t.Fatalf("tool model/action = %v/%v", tool["model"], tool["action"])
	}
	if tool["size"] != "1024x1024" || tool["quality"] != "low" {
		t.Fatalf("tool size/quality = %v/%v", tool["size"], tool["quality"])
	}
	if _, exists := tool["n"]; exists {
		t.Fatalf("tool must NOT contain 'n' (upstream rejects it), got %v", tool["n"])
	}
}

func TestBuildCodexImageBody_EditWithImageAndMask(t *testing.T) {
	req := dto.ImageRequest{Model: "gpt-image-2", Prompt: "add a star"}
	body := buildCodexImageBody(req, "gpt-5.4", "edit",
		[]string{"data:image/png;base64,AAA"}, "data:image/png;base64,MMM")

	input, _ := body["input"].([]any)
	msg, _ := input[0].(map[string]any)
	content, _ := msg["content"].([]any)
	// content[0]=input_text, content[1]=input_image
	if len(content) != 2 {
		t.Fatalf("content len = %d, want 2", len(content))
	}
	img, _ := content[1].(map[string]any)
	if img["type"] != "input_image" || img["image_url"] != "data:image/png;base64,AAA" {
		t.Fatalf("input_image wrong: %v", img)
	}
	tools, _ := body["tools"].([]any)
	tool, _ := tools[0].(map[string]any)
	mask, _ := tool["input_image_mask"].(map[string]any)
	if mask["image_url"] != "data:image/png;base64,MMM" {
		t.Fatalf("mask wrong: %v", tool["input_image_mask"])
	}
}

func TestRelayImageOverCodex_ParsesImageAndUsage(t *testing.T) {
	// 最小 fixture：一条 output_item.done（带 base64 result） + 一条 completed（带 tool_usage）
	sse := strings.Join([]string{
		`data: {"type":"response.output_item.done","item":{"type":"image_generation_call","id":"ig_1","result":"QUJD","output_format":"png","revised_prompt":"a red circle"}}`,
		`data: {"type":"response.completed","response":{"created_at":1700000000,"tool_usage":{"image_gen":{"input_tokens":21,"output_tokens":196,"total_tokens":217}}}}`,
		"data: [DONE]",
		"",
	}, "\n\n")

	resp := &http.Response{
		StatusCode: 200,
		Body:       io.NopCloser(strings.NewReader(sse)),
		Header:     http.Header{},
	}
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)

	usage, apiErr := RelayImageOverCodex(c, &relaycommon.RelayInfo{}, resp)
	if apiErr != nil {
		t.Fatalf("unexpected error: %v", apiErr)
	}
	if usage.PromptTokens != 21 || usage.CompletionTokens != 196 || usage.TotalTokens != 217 {
		t.Fatalf("usage = %+v", usage)
	}

	var out dto.ImageResponse
	if err := common.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("client body not ImageResponse: %v / %s", err, rec.Body.String())
	}
	if len(out.Data) != 1 || out.Data[0].B64Json != "QUJD" {
		t.Fatalf("image data wrong: %+v", out.Data)
	}
	if out.Data[0].RevisedPrompt != "a red circle" {
		t.Fatalf("revised_prompt = %q", out.Data[0].RevisedPrompt)
	}
}

func TestRelayImageOverCodex_FailedEventReturnsGenericError(t *testing.T) {
	// 上游 response.failed：客户端必须只看到通用错误，绝不能泄露上游原文。
	const upstreamSecret = "ChatGPT internal model gpt-image-secret blew up"
	sse := strings.Join([]string{
		`data: {"type":"response.failed","response":{"error":{"message":"` + upstreamSecret + `"}}}`,
		"data: [DONE]",
		"",
	}, "\n\n")

	resp := &http.Response{
		StatusCode: 200,
		Body:       io.NopCloser(strings.NewReader(sse)),
		Header:     http.Header{},
	}
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)

	usage, apiErr := RelayImageOverCodex(c, &relaycommon.RelayInfo{}, resp)
	if apiErr == nil {
		t.Fatalf("expected an error on response.failed, got nil (usage=%+v)", usage)
	}
	errMsg := apiErr.Error()
	if !strings.Contains(errMsg, "codex image generation failed") {
		t.Fatalf("client error should be the generic message, got %q", errMsg)
	}
	if strings.Contains(errMsg, upstreamSecret) || strings.Contains(errMsg, "ChatGPT") {
		t.Fatalf("client error leaked upstream detail: %q", errMsg)
	}
	if rec.Body.Len() != 0 {
		t.Fatalf("no image body should be written on failure, got %q", rec.Body.String())
	}
}

func TestRelayImageOverCodex_FallsBackToDefaultUsageWhenMissing(t *testing.T) {
	// 产出了图像但 completed 事件里没有 tool_usage：计费必须兜底到非零默认值。
	sse := strings.Join([]string{
		`data: {"type":"response.output_item.done","item":{"type":"image_generation_call","id":"ig_1","result":"QUJD","output_format":"png"}}`,
		`data: {"type":"response.completed","response":{"created_at":1700000000}}`,
		"data: [DONE]",
		"",
	}, "\n\n")

	resp := &http.Response{
		StatusCode: 200,
		Body:       io.NopCloser(strings.NewReader(sse)),
		Header:     http.Header{},
	}
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)

	usage, apiErr := RelayImageOverCodex(c, &relaycommon.RelayInfo{}, resp)
	if apiErr != nil {
		t.Fatalf("unexpected error: %v", apiErr)
	}
	if usage.CompletionTokens != defaultCodexImageOutputTokens || usage.TotalTokens != defaultCodexImageOutputTokens {
		t.Fatalf("usage should fall back to default %d, got %+v", defaultCodexImageOutputTokens, usage)
	}
	if usage.CompletionTokens == 0 || usage.CompletionTokens == 1 {
		t.Fatalf("fallback usage must be non-trivial, got %+v", usage)
	}

	var out dto.ImageResponse
	if err := common.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("client body not ImageResponse: %v / %s", err, rec.Body.String())
	}
	if len(out.Data) != 1 || out.Data[0].B64Json != "QUJD" {
		t.Fatalf("image data wrong: %+v", out.Data)
	}
}

func TestRelayImageOverCodex_EmptyStreamReturnsNoImageError(t *testing.T) {
	// 只有 [DONE]、没有任何图像：走 "no image returned" 错误路径，不得 panic。
	sse := strings.Join([]string{
		"data: [DONE]",
		"",
	}, "\n\n")

	resp := &http.Response{
		StatusCode: 200,
		Body:       io.NopCloser(strings.NewReader(sse)),
		Header:     http.Header{},
	}
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)

	usage, apiErr := RelayImageOverCodex(c, &relaycommon.RelayInfo{}, resp)
	if apiErr == nil {
		t.Fatalf("expected 'no image returned' error, got nil (usage=%+v)", usage)
	}
	if !strings.Contains(apiErr.Error(), "no image returned") {
		t.Fatalf("expected no-image error, got %q", apiErr.Error())
	}
	if rec.Body.Len() != 0 {
		t.Fatalf("no image body should be written, got %q", rec.Body.String())
	}
}
