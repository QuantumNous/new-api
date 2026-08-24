package groksubscription

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
	"github.com/tidwall/gjson"
)

// grokCompactUpstreamOK 是一段合法的上游普通 Responses JSON（非流式），含 encrypted
// reasoning + message.output_text，以及 usage。它是 Grok compact turn 的上游回包形态
// （Grok 上游回普通 Responses JSON，不是 OpenAI 的 compact 格式）。
const grokCompactUpstreamOK = `{"id":"resp_c1","object":"response","created_at":123,"model":"grok-4","status":"completed","output":[{"type":"reasoning","encrypted_content":"ENC_BLOB"},{"type":"message","role":"assistant","content":[{"type":"output_text","text":"the summary"}]}],"usage":{"input_tokens":11,"output_tokens":7,"total_tokens":18}}`

func newJSONResponse(status int, body string) *http.Response {
	return &http.Response{
		StatusCode: status,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

func newCompactTestContext(t *testing.T) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses/compact", nil)
	return c, rec
}

// TestGrokCompactResponseHandler_Success 锁住 Task 12.5 C：合法上游 Responses JSON
// （含 encrypted reasoning + output_text summary）→ 200 回写
// OpenAIResponsesCompactionResponse，Output 含 encrypted_content + summary，usage 映射
// 正确（input→prompt / output→completion / total）。返回 *dto.Usage（入口层无条件断言）。
func TestGrokCompactResponseHandler_Success(t *testing.T) {
	c, rec := newCompactTestContext(t)
	usageAny, apiErr := grokCompactResponseHandler(c, newJSONResponse(http.StatusOK, grokCompactUpstreamOK), &relaycommon.RelayInfo{})
	if apiErr != nil {
		t.Fatalf("unexpected error: %v", apiErr)
	}
	// 入口层 (responses_handler.go) 无条件做 usage.(*dto.Usage)，必须返回非 nil 指针。
	usage, ok := usageAny.(*dto.Usage)
	if !ok || usage == nil {
		t.Fatalf("usage return = %T (%v), want non-nil *dto.Usage", usageAny, usageAny)
	}
	if usage.PromptTokens != 11 || usage.CompletionTokens != 7 || usage.TotalTokens != 18 {
		t.Fatalf("usage mismatch: prompt=%d completion=%d total=%d, want 11/7/18", usage.PromptTokens, usage.CompletionTokens, usage.TotalTokens)
	}

	if rec.Code != http.StatusOK {
		t.Fatalf("http status = %d, want 200", rec.Code)
	}
	var resp dto.OpenAIResponsesCompactionResponse
	if err := common.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("body must be OpenAIResponsesCompactionResponse: %v; body=%s", err, rec.Body.String())
	}
	// Output 是 compaction item 数组：至少含一个带 encrypted_content 与 summary 的 item。
	enc := gjson.GetBytes(resp.Output, "0.encrypted_content").String()
	if enc != "ENC_BLOB" {
		t.Fatalf("Output[0].encrypted_content = %q, want ENC_BLOB; output=%s", enc, string(resp.Output))
	}
	summary := gjson.GetBytes(resp.Output, "0.summary").String()
	if summary != "the summary" {
		t.Fatalf("Output[0].summary = %q, want 'the summary'; output=%s", summary, string(resp.Output))
	}
	if resp.Usage == nil || resp.Usage.InputTokens != 11 || resp.Usage.OutputTokens != 7 {
		t.Fatalf("response usage mismatch: %+v", resp.Usage)
	}
}

// TestGrokCompactResponseHandler_MissingReasoningStableError 锁住：上游缺 encrypted
// reasoning 时返回稳定错误、绝不伪造 compaction item，且不回 200。
func TestGrokCompactResponseHandler_MissingReasoningStableError(t *testing.T) {
	c, _ := newCompactTestContext(t)
	body := `{"output":[{"type":"message","content":[{"type":"output_text","text":"summary"}]}],"usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}`
	usageAny, apiErr := grokCompactResponseHandler(c, newJSONResponse(http.StatusOK, body), &relaycommon.RelayInfo{})
	if apiErr == nil {
		t.Fatalf("missing encrypted reasoning must return a stable error, not fabricate an item")
	}
	// 即便报错，usage 仍须是 *dto.Usage（入口层无条件断言，nil 会 panic）。
	if _, ok := usageAny.(*dto.Usage); !ok {
		t.Fatalf("usage on error = %T, want *dto.Usage (entry point asserts unconditionally)", usageAny)
	}
}

// TestGrokCompactResponseHandler_Non200PreservesStatus 锁住：上游非 200 时保留状态码
// （重试/限流信号不丢失），且不把上游 body 当成功结果回写。
func TestGrokCompactResponseHandler_Non200PreservesStatus(t *testing.T) {
	c, _ := newCompactTestContext(t)
	usageAny, apiErr := grokCompactResponseHandler(c, newJSONResponse(http.StatusTooManyRequests, `{"error":"rate limited"}`), &relaycommon.RelayInfo{})
	if apiErr == nil {
		t.Fatalf("expected error for non-200 upstream")
	}
	if apiErr.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want 429 (must preserve upstream status)", apiErr.StatusCode)
	}
	if _, ok := usageAny.(*dto.Usage); !ok {
		t.Fatalf("usage on error = %T, want *dto.Usage", usageAny)
	}
}

// TestBuildCompactTurnRequestsEncryptedReasoningViaInclude 锁住 D 修复：encrypted
// reasoning 必须通过 include 数组请求（仓库三处先例形态），绝不能用布尔
// reasoning.encrypted_content=true——后者上游不会回 encrypted reasoning，会让
// ConvertCompactResponse 恒 ErrCompactMissingReasoning。
func TestBuildCompactTurnRequestsEncryptedReasoningViaInclude(t *testing.T) {
	in := []byte(`{"model":"grok-4","input":[{"role":"user","content":"hi"}]}`)
	out, err := BuildCompactTurn(in)
	if err != nil {
		t.Fatalf("build err %v", err)
	}
	inc := gjson.GetBytes(out, "include")
	if !inc.IsArray() {
		t.Fatalf("include must be an array, got %q", inc.Raw)
	}
	found := false
	for _, v := range inc.Array() {
		if v.String() == "reasoning.encrypted_content" {
			found = true
		}
	}
	if !found {
		t.Fatalf("include must contain reasoning.encrypted_content, got %q", inc.Raw)
	}
	// 绝不能是布尔形态：上游对布尔不回 encrypted reasoning。
	if gjson.GetBytes(out, "reasoning.encrypted_content").Type == gjson.True {
		t.Fatalf("must NOT set boolean reasoning.encrypted_content; got reasoning=%q", gjson.GetBytes(out, "reasoning").Raw)
	}
}

func TestBuildCompactTurnRejectsStreamTrue(t *testing.T) {
	in := []byte(`{"model":"grok-4","stream":true,"input":[]}`)
	if _, err := BuildCompactTurn(in); err != ErrCompactStreamUnsupported {
		t.Fatalf("stream=true must return ErrCompactStreamUnsupported, got %v", err)
	}
}

func TestBuildCompactTurnForcesNonStreamAndStore(t *testing.T) {
	in := []byte(`{"model":"grok-4","input":[{"role":"user","content":"hi"}]}`)
	out, err := BuildCompactTurn(in)
	if err != nil {
		t.Fatalf("build err %v", err)
	}
	if getBool(out, "stream") != false {
		t.Fatalf("compact must force stream=false")
	}
	if getBool(out, "store") != false {
		t.Fatalf("compact must force store=false")
	}
	if !hasSummaryItem(out) {
		t.Fatalf("compact must append server summary item")
	}
	if hasTopLevelKey(out, "tools") {
		t.Fatalf("compact must strip tools")
	}
}

func TestBuildCompactTurnRejectsNonArrayInput(t *testing.T) {
	in := []byte(`{"model":"grok-4","input":"hello world"}`)
	out, err := BuildCompactTurn(in)
	if err != ErrCompactInvalidInput {
		t.Fatalf("non-array input must fail, got %v", err)
	}
	if out != nil {
		t.Fatalf("rejected input must return nil body, got %s", out)
	}
}

// TestBuildCompactTurnRejectsScalarInclude 锁住 include 的对称守卫（review follow-up）：
// dto.OpenAIResponsesRequest.Include 是 json.RawMessage，客户端可传标量。非数组 include
// 下 sjson 的 "include.-1" 不是追加，而是把 include 变成 {"-1":...} 对象 → 非法上游请求
// → 恒 ErrCompactMissingReasoning。必须与 input 守卫一致硬拒。
func TestBuildCompactTurnRejectsScalarInclude(t *testing.T) {
	in := []byte(`{"model":"grok-4","input":[{"role":"user","content":"hi"}],"include":"foo"}`)
	out, err := BuildCompactTurn(in)
	if err != ErrCompactInvalidInclude {
		t.Fatalf("scalar include must fail with ErrCompactInvalidInclude, got %v", err)
	}
	if out != nil {
		t.Fatalf("rejected include must return nil body, got %s", out)
	}
}

// TestBuildCompactTurnRejectsObjectInclude 校验对象形态 include 同样被拒。
func TestBuildCompactTurnRejectsObjectInclude(t *testing.T) {
	in := []byte(`{"model":"grok-4","input":[{"role":"user","content":"hi"}],"include":{"a":1}}`)
	out, err := BuildCompactTurn(in)
	if err != ErrCompactInvalidInclude {
		t.Fatalf("object include must fail with ErrCompactInvalidInclude, got %v", err)
	}
	if out != nil {
		t.Fatalf("rejected include must return nil body, got %s", out)
	}
}

// TestBuildCompactTurnPreservesExistingIncludeArray 回归：客户端已传合法 include 数组时，
// 追加语义保留——结果同时含客户端原有项与 reasoning.encrypted_content。
func TestBuildCompactTurnPreservesExistingIncludeArray(t *testing.T) {
	in := []byte(`{"model":"grok-4","input":[{"role":"user","content":"hi"}],"include":["existing.item"]}`)
	out, err := BuildCompactTurn(in)
	if err != nil {
		t.Fatalf("legal include array must not fail, got %v", err)
	}
	inc := gjson.GetBytes(out, "include")
	if !inc.IsArray() {
		t.Fatalf("include must remain an array, got %q", inc.Raw)
	}
	var haveExisting, haveEnc bool
	for _, v := range inc.Array() {
		switch v.String() {
		case "existing.item":
			haveExisting = true
		case "reasoning.encrypted_content":
			haveEnc = true
		}
	}
	if !haveExisting || !haveEnc {
		t.Fatalf("include must keep existing.item and append reasoning.encrypted_content, got %q", inc.Raw)
	}
}

func TestConvertCompactResponseRequiresEncryptedReasoning(t *testing.T) {
	noReasoning := []byte(`{"output":[{"type":"message","content":[{"type":"output_text","text":"summary"}]}]}`)
	if _, err := ConvertCompactResponse(noReasoning); err != ErrCompactMissingReasoning {
		t.Fatalf("missing encrypted reasoning must fail, got %v", err)
	}
}

func TestConvertCompactResponseRequiresSummary(t *testing.T) {
	body := []byte(`{"output":[{"type":"reasoning","encrypted_content":"enc"}]}`)
	if _, err := ConvertCompactResponse(body); err != ErrCompactMissingSummary {
		t.Fatalf("missing summary must fail, got %v", err)
	}
}

func TestConvertCompactResponseSucceeds(t *testing.T) {
	ok := []byte(`{"output":[{"type":"reasoning","encrypted_content":"enc"},{"type":"message","content":[{"type":"output_text","text":"the summary"}]}]}`)
	item, err := ConvertCompactResponse(ok)
	if err != nil {
		t.Fatalf("convert err %v", err)
	}
	if item.EncryptedContent != "enc" || item.Summary == "" {
		t.Fatalf("compaction item malformed: %+v", item)
	}
}
