package codex

// 本文件承载 codex 图像修复（F2/F3/F11 计费健壮化、F4 mask 致命、F6 多图确定性顺序、
// F7 response_format 校验、F8 流截断可诊断）的新增测试。
// 之所以单独成文件而非并入 image_test.go：image_test.go 由处理 F1（adaptor.go 脱敏）的
// 另一 agent 并发编辑，单独成文件可避免共享文件的编辑竞争且保持同包可见性。

import (
	"bytes"
	"encoding/base64"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"

	"github.com/gin-gonic/gin"
)

// F7 接线测试：ConvertImageRequest（生产路径）必须真正拒绝 response_format=url，
// 防止 ValidateCodexImageRequest 沦为死代码（max-review 复审曾发现未接线）。
func TestConvertImageRequest_RejectsURLResponseFormat(t *testing.T) {
	a := &Adaptor{}
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesGenerations}

	// url 在 ValidateCodexImageRequest 处即被拒绝（早于 resolveImageCarrierModel），
	// 证明校验确已接入生产路径，而非死代码。
	if _, err := a.ConvertImageRequest(c, info, dto.ImageRequest{Model: "gpt-image-2", Prompt: "x", ResponseFormat: "url"}); err == nil {
		t.Fatalf("ConvertImageRequest must reject response_format=url")
	} else if !strings.Contains(err.Error(), "response_format") {
		t.Fatalf("expected response_format rejection, got: %v", err)
	}
}

// runCodexImageSSE 跑一遍 RelayImageOverCodex（200 路径）并返回 usage。
func runCodexImageSSE(t *testing.T, sse string) *dto.Usage {
	t.Helper()
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
	return usage
}

// F2/F11：image_gen 存在但为空对象 {} —— 旧逻辑 u.Exists()==true 让 token 全 0、计费塌到 ~0。
// 新逻辑必须兜底到非零默认 completion。
func TestRelayImageOverCodex_EmptyImageGenObjectStillBillsDefault(t *testing.T) {
	sse := strings.Join([]string{
		`data: {"type":"response.output_item.done","item":{"type":"image_generation_call","id":"ig_1","result":"QUJD"}}`,
		`data: {"type":"response.completed","response":{"created_at":1700000000,"tool_usage":{"image_gen":{}}}}`,
		"data: [DONE]",
		"",
	}, "\n\n")
	usage := runCodexImageSSE(t, sse)
	if usage.CompletionTokens != defaultCodexImageOutputTokens {
		t.Fatalf("empty image_gen{} must fall back to default completion %d, got %+v",
			defaultCodexImageOutputTokens, usage)
	}
	if usage.TotalTokens < defaultCodexImageOutputTokens {
		t.Fatalf("total must be >= default completion, got %+v", usage)
	}
}

// F2/F11：output_tokens 被显式置零 —— 仍须兜底，不可塌到 0。
func TestRelayImageOverCodex_ZeroOutputTokensStillBillsDefault(t *testing.T) {
	sse := strings.Join([]string{
		`data: {"type":"response.output_item.done","item":{"type":"image_generation_call","id":"ig_1","result":"QUJD"}}`,
		`data: {"type":"response.completed","response":{"created_at":1700000000,"tool_usage":{"image_gen":{"input_tokens":0,"output_tokens":0,"total_tokens":0}}}}`,
		"data: [DONE]",
		"",
	}, "\n\n")
	usage := runCodexImageSSE(t, sse)
	if usage.CompletionTokens != defaultCodexImageOutputTokens {
		t.Fatalf("zeroed output_tokens must fall back to default %d, got %+v",
			defaultCodexImageOutputTokens, usage)
	}
}

// F2/F3：partial usage —— 有 input_tokens 但缺 output_tokens。input(prompt) 必须保留，
// completion 兜底到默认，total 重算为 p+comp（上游缺/不自洽时）。
func TestRelayImageOverCodex_PartialUsageKeepsPromptAndBillsCompletion(t *testing.T) {
	sse := strings.Join([]string{
		`data: {"type":"response.output_item.done","item":{"type":"image_generation_call","id":"ig_1","result":"QUJD"}}`,
		`data: {"type":"response.completed","response":{"created_at":1700000000,"tool_usage":{"image_gen":{"input_tokens":500}}}}`,
		"data: [DONE]",
		"",
	}, "\n\n")
	usage := runCodexImageSSE(t, sse)
	if usage.PromptTokens != 500 {
		t.Fatalf("partial usage must keep input_tokens as PromptTokens=500, got %+v", usage)
	}
	if usage.CompletionTokens != defaultCodexImageOutputTokens {
		t.Fatalf("missing output_tokens must fall back to default %d, got %+v",
			defaultCodexImageOutputTokens, usage)
	}
	if usage.TotalTokens != 500+defaultCodexImageOutputTokens {
		t.Fatalf("total must be recomputed to p+comp=%d, got %+v",
			500+defaultCodexImageOutputTokens, usage)
	}
}

// F3：edit 兜底也必须把输入图像 token（input_tokens）计入 PromptTokens，
// 不能像旧逻辑那样把 PromptTokens 置 0 丢掉编辑输入成本。
func TestRelayImageOverCodex_EditFallbackPreservesPromptTokens(t *testing.T) {
	sse := strings.Join([]string{
		`data: {"type":"response.output_item.done","item":{"type":"image_generation_call","id":"ig_1","result":"QUJD"}}`,
		`data: {"type":"response.completed","response":{"created_at":1700000000,"tool_usage":{"image_gen":{"input_tokens":1200,"output_tokens":0}}}}`,
		"data: [DONE]",
		"",
	}, "\n\n")
	usage := runCodexImageSSE(t, sse)
	if usage.PromptTokens != 1200 {
		t.Fatalf("edit input-image tokens must survive fallback as PromptTokens=1200, got %+v", usage)
	}
	if usage.CompletionTokens != defaultCodexImageOutputTokens {
		t.Fatalf("edit completion must fall back to default %d, got %+v",
			defaultCodexImageOutputTokens, usage)
	}
}

// 全用量在场且自洽：直接采用上游值，不触发任何兜底。
func TestRelayImageOverCodex_FullUsageHonored(t *testing.T) {
	sse := strings.Join([]string{
		`data: {"type":"response.output_item.done","item":{"type":"image_generation_call","id":"ig_1","result":"QUJD"}}`,
		`data: {"type":"response.completed","response":{"created_at":1700000000,"tool_usage":{"image_gen":{"input_tokens":21,"output_tokens":196,"total_tokens":217}}}}`,
		"data: [DONE]",
		"",
	}, "\n\n")
	usage := runCodexImageSSE(t, sse)
	if usage.PromptTokens != 21 || usage.CompletionTokens != 196 || usage.TotalTokens != 217 {
		t.Fatalf("full usage should be honored verbatim, got %+v", usage)
	}
}

// F8：上游 SSE 超过读取上限且未产出图像时，返回可区分的 "response exceeded size limit"，
// 而不是误报 "no image returned"。
func TestRelayImageOverCodex_OversizedStreamReturnsDistinctError(t *testing.T) {
	var b bytes.Buffer
	b.WriteString("data: {\"type\":\"noise\",\"blob\":\"")
	chunk := strings.Repeat("A", 1<<20) // 1 MiB
	for b.Len() <= codexImageStreamReadLimit+(2<<20) {
		b.WriteString(chunk)
	}
	resp := &http.Response{
		StatusCode: 200,
		Body:       io.NopCloser(strings.NewReader(b.String())),
		Header:     http.Header{},
	}
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	usage, apiErr := RelayImageOverCodex(c, &relaycommon.RelayInfo{}, resp)
	if apiErr == nil {
		t.Fatalf("expected size-limit error, got nil (usage=%+v)", usage)
	}
	if !strings.Contains(apiErr.Error(), "response exceeded size limit") {
		t.Fatalf("expected distinct size-limit error, got %q", apiErr.Error())
	}
	if strings.Contains(apiErr.Error(), "no image returned") {
		t.Fatalf("truncation must NOT be reported as 'no image returned': %q", apiErr.Error())
	}
}

// F7：response_format 非 b64_json（如 "url"）必须被拒绝；空与 b64_json 通过。
func TestValidateCodexImageRequest_ResponseFormat(t *testing.T) {
	if err := ValidateCodexImageRequest(dto.ImageRequest{ResponseFormat: "url"}); err == nil {
		t.Fatalf("response_format=url must be rejected")
	} else if !strings.Contains(err.Error(), "b64_json") {
		t.Fatalf("rejection message should mention b64_json, got %q", err.Error())
	}
	if err := ValidateCodexImageRequest(dto.ImageRequest{}); err != nil {
		t.Fatalf("empty response_format must pass: %v", err)
	}
	if err := ValidateCodexImageRequest(dto.ImageRequest{ResponseFormat: "b64_json"}); err != nil {
		t.Fatalf("response_format=b64_json must pass: %v", err)
	}
}

// newCodexEditMultipartContext 构造携带 multipart 表单的 gin.Context。
// maxMemory 控制内存阈值：传一个很小的值可强制文件落盘（用于 F4 致命路径）。
func newCodexEditMultipartContext(t *testing.T, fields map[string][]codexTestFile, maxMemory int64) *gin.Context {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	for field, files := range fields {
		for _, f := range files {
			fw, err := w.CreateFormFile(field, f.filename)
			if err != nil {
				t.Fatalf("create form file: %v", err)
			}
			if _, err := fw.Write([]byte(f.content)); err != nil {
				t.Fatalf("write form file: %v", err)
			}
		}
	}
	if err := w.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/v1/images/edits", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = req
	if maxMemory > 0 {
		if err := req.ParseMultipartForm(maxMemory); err != nil {
			t.Fatalf("parse multipart form: %v", err)
		}
	}
	return c
}

type codexTestFile struct {
	filename string
	content  string
}

// F4：mask 字段存在且可读 -> 被采用。
func TestReadCodexEditImages_MaskPresentAndReadable(t *testing.T) {
	c := newCodexEditMultipartContext(t, map[string][]codexTestFile{
		"image": {{"a.png", "IMGDATA"}},
		"mask":  {{"m.png", "MASKDATA"}},
	}, 0)
	imgs, mask, err := readCodexEditImages(c)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(imgs) != 1 {
		t.Fatalf("want 1 image, got %d", len(imgs))
	}
	if mask == "" {
		t.Fatalf("mask should be captured, got empty")
	}
}

// F4：mask 缺失是允许的（无 mask 编辑），不得报错。
func TestReadCodexEditImages_NoMaskIsFine(t *testing.T) {
	c := newCodexEditMultipartContext(t, map[string][]codexTestFile{
		"image": {{"a.png", "IMGDATA"}},
	}, 0)
	_, mask, err := readCodexEditImages(c)
	if err != nil {
		t.Fatalf("absent mask must not error: %v", err)
	}
	if mask != "" {
		t.Fatalf("absent mask should yield empty mask, got %q", mask)
	}
}

// F4：mask 文件存在但底层不可读 -> 必须致命报错（不得静默无 mask 继续并计费）。
// 通过把 mask 落盘（maxMemory 极小），再删除底层 temp 文件，使 Open/Read 失败。
func TestReadCodexEditImages_MaskUnreadableIsFatal(t *testing.T) {
	// 显式按序写 parts：先一个很小的 image（保留在内存、可读），再一个很大的 mask（落盘）。
	// maxMemory 取二者之间：image 留内存，mask 溢出到 tmpfile；随后删除 temp 文件，
	// 使 mask 的 fh.Open()/Read 失败，而 image 仍可读 —— 精确命中 mask 致命分支。
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	if fw, err := w.CreateFormFile("image", "a.png"); err != nil {
		t.Fatalf("create image part: %v", err)
	} else if _, err := fw.Write([]byte("IMG")); err != nil {
		t.Fatalf("write image part: %v", err)
	}
	bigMask := strings.Repeat("M", 1<<20) // 1 MiB，确保溢出到磁盘
	if fw, err := w.CreateFormFile("mask", "m.png"); err != nil {
		t.Fatalf("create mask part: %v", err)
	} else if _, err := fw.Write([]byte(bigMask)); err != nil {
		t.Fatalf("write mask part: %v", err)
	}
	if err := w.Close(); err != nil {
		t.Fatalf("close writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/v1/images/edits", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = req

	// maxMemory=1KiB：image(3B) 留内存，mask(1MiB) 落盘。
	if err := req.ParseMultipartForm(1 << 10); err != nil {
		t.Fatalf("parse multipart form: %v", err)
	}
	mf := c.Request.MultipartForm
	if mf == nil || len(mf.File["mask"]) == 0 {
		t.Fatalf("expected a parsed mask file header")
	}
	// 删除所有 multipart temp 文件：只有落盘的 mask 受影响，内存中的 image 仍可读。
	if err := mf.RemoveAll(); err != nil {
		t.Fatalf("RemoveAll temp files: %v", err)
	}

	_, _, err := readCodexEditImages(c)
	if err == nil {
		t.Fatalf("present-but-unreadable mask MUST be fatal, got nil error")
	}
	if !strings.Contains(err.Error(), "mask") {
		t.Fatalf("mask failure error should mention mask, got %q", err.Error())
	}
}

// F6：image[0]/image[1]/image[2] 回退分支必须按下标确定性排序，参考图顺序可复现。
func TestReadCodexEditImages_IndexedImagesAreOrdered(t *testing.T) {
	// 故意乱序声明；map range 随机，但结果必须按 0,1,2 排序。
	c := newCodexEditMultipartContext(t, map[string][]codexTestFile{
		"image[2]": {{"c.png", "ZZZ"}},
		"image[0]": {{"a.png", "AAA"}},
		"image[1]": {{"b.png", "BBB"}},
	}, 0)
	imgs, _, err := readCodexEditImages(c)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(imgs) != 3 {
		t.Fatalf("want 3 images, got %d", len(imgs))
	}
	wantOrder := []string{"AAA", "BBB", "ZZZ"}
	for i, raw := range wantOrder {
		want := "data:image/png;base64," + base64.StdEncoding.EncodeToString([]byte(raw))
		if imgs[i] != want {
			t.Fatalf("image[%d] order wrong: got %q want %q (full=%v)", i, imgs[i], want, imgs)
		}
	}
}

// F6 单测：imageIndexKeyLess 对 N 数值升序，且 image[10] 排在 image[2] 之后（非字典序）。
func TestImageIndexKeyLess_NumericOrder(t *testing.T) {
	if !imageIndexKeyLess("image[2]", "image[10]") {
		t.Fatalf("image[2] must sort before image[10] (numeric, not lexical)")
	}
	if imageIndexKeyLess("image[10]", "image[2]") {
		t.Fatalf("image[10] must NOT sort before image[2]")
	}
}
