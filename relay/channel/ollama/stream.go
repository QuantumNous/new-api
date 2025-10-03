package ollama

import (
    "bufio"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "one-api/common"
    "one-api/dto"
    "one-api/logger"
    relaycommon "one-api/relay/common"
    "one-api/relay/helper"
    "one-api/service"
    "one-api/types"
    "strings"
    "time"

    "github.com/gin-gonic/gin"
)

type ollamaChatStreamChunk struct {
    Model            string `json:"model"`
    CreatedAt        string `json:"created_at"`
    // chat
    Message *struct {
        Role      string `json:"role"`
        Content   string `json:"content"`
        Thinking  json.RawMessage `json:"thinking"`
        ToolCalls []struct {
            Function struct {
                Name      string      `json:"name"`
                Arguments interface{} `json:"arguments"`
            } `json:"function"`
        } `json:"tool_calls"`
    } `json:"message"`
    // generate
    Response string `json:"response"`
    Done         bool    `json:"done"`
    DoneReason   string  `json:"done_reason"`
    TotalDuration int64  `json:"total_duration"`
    LoadDuration  int64  `json:"load_duration"`
    PromptEvalCount int  `json:"prompt_eval_count"`
    EvalCount       int  `json:"eval_count"`
    PromptEvalDuration int64 `json:"prompt_eval_duration"`
    EvalDuration       int64 `json:"eval_duration"`
}

func toUnix(ts string) int64 {
    if ts == "" { return time.Now().Unix() }
    // try time.RFC3339 or with nanoseconds
    t, err := time.Parse(time.RFC3339Nano, ts)
    if err != nil { t2, err2 := time.Parse(time.RFC3339, ts); if err2==nil { return t2.Unix() }; return time.Now().Unix() }
    return t.Unix()
}

func ollamaStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
    if resp == nil || resp.Body == nil { return nil, types.NewOpenAIError(fmt.Errorf("empty response"), types.ErrorCodeBadResponse, http.StatusBadRequest) }
    defer service.CloseResponseBodyGracefully(resp)

    helper.SetEventStreamHeaders(c)
    scanner := bufio.NewScanner(resp.Body)
    usage := &dto.Usage{}
    var model = info.UpstreamModelName
    var responseId = common.GetUUID()
    var created = time.Now().Unix()
    var toolCallIndex int
    start := helper.GenerateStartEmptyResponse(responseId, created, model, nil)
    if data, err := common.Marshal(start); err == nil { _ = helper.StringData(c, string(data)) }

    for scanner.Scan() {
        line := scanner.Text()
        line = strings.TrimSpace(line)
        if line == "" { continue }
        var chunk ollamaChatStreamChunk
        if err := json.Unmarshal([]byte(line), &chunk); err != nil {
            logger.LogError(c, "ollama stream json decode error: "+err.Error()+" line="+line)
            return usage, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
        }
        if chunk.Model != "" { model = chunk.Model }
        created = toUnix(chunk.CreatedAt)

        if !chunk.Done {
            // delta content
            var content string
            if chunk.Message != nil { content = chunk.Message.Content } else { content = chunk.Response }
            delta := dto.ChatCompletionsStreamResponse{
                Id:      responseId,
                Object:  "chat.completion.chunk",
                Created: created,
                Model:   model,
                Choices: []dto.ChatCompletionsStreamResponseChoice{ {
                    Index: 0,
                    Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ Role: "assistant" },
                } },
            }
            if content != "" { delta.Choices[0].Delta.SetContentString(content) }
            if chunk.Message != nil && len(chunk.Message.Thinking) > 0 {
                raw := strings.TrimSpace(string(chunk.Message.Thinking))
                if raw != "" && raw != "null" { delta.Choices[0].Delta.SetReasoningContent(raw) }
            }
            // tool calls
            if chunk.Message != nil && len(chunk.Message.ToolCalls) > 0 {
                delta.Choices[0].Delta.ToolCalls = make([]dto.ToolCallResponse,0,len(chunk.Message.ToolCalls))
                for _, tc := range chunk.Message.ToolCalls {
                    // arguments -> string
                    argBytes, _ := json.Marshal(tc.Function.Arguments)
                    toolId := fmt.Sprintf("call_%d", toolCallIndex)
                    tr := dto.ToolCallResponse{ID:toolId, Type:"function", Function: dto.FunctionResponse{Name: tc.Function.Name, Arguments: string(argBytes)}}
                    tr.SetIndex(toolCallIndex)
                    toolCallIndex++
                    delta.Choices[0].Delta.ToolCalls = append(delta.Choices[0].Delta.ToolCalls, tr)
                }
            }
            if data, err := common.Marshal(delta); err == nil { _ = helper.StringData(c, string(data)) }
            continue
        }
        // done frame
        // finalize once and break loop
        usage.PromptTokens = chunk.PromptEvalCount
        usage.CompletionTokens = chunk.EvalCount
        usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
    finishReason := chunk.DoneReason
    if finishReason == "" { finishReason = "stop" }
        // emit stop delta
        if stop := helper.GenerateStopResponse(responseId, created, model, finishReason); stop != nil {
            if data, err := common.Marshal(stop); err == nil { _ = helper.StringData(c, string(data)) }
        }
        // emit usage frame
        if final := helper.GenerateFinalUsageResponse(responseId, created, model, *usage); final != nil {
            if data, err := common.Marshal(final); err == nil { _ = helper.StringData(c, string(data)) }
        }
        // send [DONE]
        helper.Done(c)
        break
    }
    if err := scanner.Err(); err != nil && err != io.EOF { logger.LogError(c, "ollama stream scan error: "+err.Error()) }
    return usage, nil
}

// non-stream handler for chat/generate
func ollamaChatHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
    body, err := io.ReadAll(resp.Body)
    if err != nil { return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError) }
    service.CloseResponseBodyGracefully(resp)
    raw := string(body)
    if common.DebugEnabled { println("ollama non-stream raw resp:", raw) }

    lines := strings.Split(raw, "\n")
    var (
        aggContent strings.Builder
        reasoningBuilder strings.Builder
        lastChunk ollamaChatStreamChunk
        parsedAny bool
    )
    for _, ln := range lines {
        ln = strings.TrimSpace(ln)
        if ln == "" { continue }
        var ck ollamaChatStreamChunk
        if err := json.Unmarshal([]byte(ln), &ck); err != nil {
            if len(lines) == 1 { return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError) }
            continue
        }
        parsedAny = true
        lastChunk = ck
        if ck.Message != nil && len(ck.Message.Thinking) > 0 {
            raw := strings.TrimSpace(string(ck.Message.Thinking))
            if raw != "" && raw != "null" { reasoningBuilder.WriteString(raw) }
        }
        if ck.Message != nil && ck.Message.Content != "" { aggContent.WriteString(ck.Message.Content) } else if ck.Response != "" { aggContent.WriteString(ck.Response) }
    }

    if !parsedAny {
        var single ollamaChatStreamChunk
        if err := json.Unmarshal(body, &single); err != nil { return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError) }
        lastChunk = single
        if single.Message != nil {
            if len(single.Message.Thinking) > 0 { raw := strings.TrimSpace(string(single.Message.Thinking)); if raw != "" && raw != "null" { reasoningBuilder.WriteString(raw) } }
            aggContent.WriteString(single.Message.Content)
        } else { aggContent.WriteString(single.Response) }
    }

    model := lastChunk.Model
    if model == "" { model = info.UpstreamModelName }
    created := toUnix(lastChunk.CreatedAt)
    usage := &dto.Usage{PromptTokens: lastChunk.PromptEvalCount, CompletionTokens: lastChunk.EvalCount, TotalTokens: lastChunk.PromptEvalCount + lastChunk.EvalCount}
    content := aggContent.String()
    finishReason := lastChunk.DoneReason
    if finishReason == "" { finishReason = "stop" }

    msg := dto.Message{Role: "assistant", Content: contentPtr(content)}
    if rc := reasoningBuilder.String(); rc != "" { msg.ReasoningContent = rc }
    full := dto.OpenAITextResponse{
        Id:      common.GetUUID(),
        Model:   model,
        Object:  "chat.completion",
        Created: created,
        Choices: []dto.OpenAITextResponseChoice{ {
            Index: 0,
            Message: msg,
            FinishReason: finishReason,
        } },
        Usage: *usage,
    }
    out, _ := common.Marshal(full)
    service.IOCopyBytesGracefully(c, resp, out)
    return usage, nil
}

func contentPtr(s string) *string { if s=="" { return nil }; return &s }
