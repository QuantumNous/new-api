package chatgpt_web

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

// doLiveConversation 复用适配器真实逻辑跑一遍 sentinel+PoW+conversation，返回上游 SSE Response。
// 仅用于 CGPT_LIVE=1 的人工集成测试；token 读自 /tmp/cgpt_tok.txt。
func doLiveConversation(t *testing.T, body *conversationRequest) *http.Response {
	t.Helper()
	raw, err := os.ReadFile("/tmp/cgpt_tok.txt")
	if err != nil {
		t.Fatal(err)
	}
	key, err := ParseWebKey(strings.TrimSpace(string(raw)))
	if err != nil {
		t.Fatalf("ParseWebKey: %v", err)
	}
	client := &http.Client{}
	headers := map[string]string{
		"Authorization":      "Bearer " + key.AccessToken,
		"chatgpt-account-id": key.AccountID,
		"OAI-Device-Id":      key.DeviceID,
		"OAI-Language":       "en-US",
		"User-Agent":         defaultUA,
		"Referer":            "https://chatgpt.com/",
		"Origin":             "https://chatgpt.com",
	}
	cr, err := fetchChatRequirements(client, "https://chatgpt.com", headers)
	if err != nil {
		t.Fatalf("fetchChatRequirements: %v", err)
	}
	t.Logf("persona=%s turnstile.required=%v pow.required=%v diff=%s",
		cr.Persona, cr.Turnstile.Required, cr.Proofofwork.Required, cr.Proofofwork.Difficulty)
	proof := ""
	if cr.Proofofwork.Required {
		proof = solveProofOfWork(cr.Proofofwork.Seed, cr.Proofofwork.Difficulty, defaultUA)
	}
	rawBody, _ := common.Marshal(body)
	req, _ := http.NewRequest(http.MethodPost, "https://chatgpt.com/backend-api/conversation", bytes.NewReader(rawBody))
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("OpenAI-Sentinel-Chat-Requirements-Token", cr.Token)
	if proof != "" {
		req.Header.Set("OpenAI-Sentinel-Proof-Token", proof)
	}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("conversation: %v", err)
	}
	t.Logf("conversation HTTP %d", resp.StatusCode)
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		t.Fatalf("status %d body=%s", resp.StatusCode, truncate(string(b), 500))
	}
	return resp
}

// scanAssistantText 用适配器的 deltaState 解析上游 SSE，返回拼出的 assistant 文本。
func scanAssistantText(t *testing.T, resp *http.Response) string {
	t.Helper()
	defer resp.Body.Close()
	state := &deltaState{}
	var full strings.Builder
	sc := bufio.NewScanner(resp.Body)
	sc.Buffer(make([]byte, 64*1024), 4*1024*1024)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(line[len("data:"):])
		delta, done := state.apply(data)
		if delta != "" {
			full.WriteString(delta)
		}
		if done {
			break
		}
	}
	return full.String()
}

// TestLiveChat 验证 chat/completions 路径：OpenAI messages -> conversation -> SSE -> 文本。
func TestLiveChat(t *testing.T) {
	if os.Getenv("CGPT_LIVE") != "1" {
		t.Skip("set CGPT_LIVE=1 to run live test")
	}
	msg := dto.Message{Role: "user"}
	msg.SetStringContent("3*7=? Reply with only the number.")
	body := buildConversationRequest([]dto.Message{msg}, "auto")
	resp := doLiveConversation(t, body)
	answer := scanAssistantText(t, resp)
	t.Logf("CHAT ANSWER: %q", answer)
	if !strings.Contains(answer, "21") {
		t.Fatalf("unexpected answer: %q", answer)
	}
}

// TestLiveResponses 验证 Responses 路径：responses Input -> conversation -> SSE -> 文本。
func TestLiveResponses(t *testing.T) {
	if os.Getenv("CGPT_LIVE") != "1" {
		t.Skip("set CGPT_LIVE=1 to run live test")
	}
	req := dto.OpenAIResponsesRequest{
		Model: "auto",
		Input: json.RawMessage(`"2+2=? Reply with only the number."`),
	}
	body, msgs := buildResponsesConversationRequest(req, "auto")
	if len(msgs) == 0 {
		t.Fatal("buildResponsesConversationRequest produced no messages")
	}
	resp := doLiveConversation(t, body)
	answer := scanAssistantText(t, resp)
	t.Logf("RESPONSES ANSWER: %q", answer)
	if !strings.Contains(answer, "4") {
		t.Fatalf("unexpected answer: %q", answer)
	}
}

// TestBuildResponsesRequest 纯单测：验证 responses Input（字符串/数组）解析。
func TestBuildResponsesRequest(t *testing.T) {
	// 字符串 input
	req := dto.OpenAIResponsesRequest{Input: json.RawMessage(`"hello"`)}
	_, msgs := buildResponsesConversationRequest(req, "auto")
	if len(msgs) != 1 || msgs[0].Role != "user" || msgs[0].StringContent() != "hello" {
		t.Fatalf("string input parse failed: %+v", msgs)
	}
	// 数组 input + instructions
	req2 := dto.OpenAIResponsesRequest{
		Instructions: json.RawMessage(`"be brief"`),
		Input:        json.RawMessage(`[{"role":"user","content":[{"type":"input_text","text":"hi"}]}]`),
	}
	_, msgs2 := buildResponsesConversationRequest(req2, "auto")
	if len(msgs2) != 2 || msgs2[0].Role != "system" || msgs2[1].StringContent() != "hi" {
		t.Fatalf("array input parse failed: %+v", msgs2)
	}
}
