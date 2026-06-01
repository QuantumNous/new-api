package claude

import (
	"encoding/json"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

const (
	respEventCreated                   = "response.created"
	respEventInProgress                = "response.in_progress"
	respEventCompleted                 = "response.completed"
	respEventFailed                    = "response.failed"
	respEventIncomplete                = "response.incomplete"
	respEventOutputItemAdded           = "response.output_item.added"
	respEventOutputItemDone            = "response.output_item.done"
	respEventContentPartAdded          = "response.content_part.added"
	respEventContentPartDone           = "response.content_part.done"
	respEventOutputTextDelta           = "response.output_text.delta"
	respEventOutputTextDone            = "response.output_text.done"
	respEventOutputTextAnnotationAdded = "response.output_text.annotation.added"
	respEventReasoningSummaryPartAdded = "response.reasoning_summary_part.added"
	respEventReasoningSummaryPartDone  = "response.reasoning_summary_part.done"
	respEventReasoningSummaryTextDelta = "response.reasoning_summary_text.delta"
	respEventReasoningSummaryTextDone  = "response.reasoning_summary_text.done"
	respEventFnCallArgsDelta           = "response.function_call_arguments.delta"
	respEventFnCallArgsDone            = "response.function_call_arguments.done"
	respEventCustomToolInputDelta      = "response.custom_tool_call_input.delta"
	respEventCustomToolInputDone       = "response.custom_tool_call_input.done"
)

type responsesBlockKind int

const (
	blockUnknown responsesBlockKind = iota
	blockText
	blockThinking
	blockRedactedThinking
	blockToolUse
	blockCustomToolCall
)

const customToolNamesContextKey = "claude_responses_custom_tool_names"

type responsesOutputItem struct {
	kind             responsesBlockKind
	outputIndex      int
	itemID           string
	role             string
	text             strings.Builder
	thinking         strings.Builder
	signature        strings.Builder
	toolCallID       string
	toolName         string
	toolArgs         strings.Builder
	annotations      []any
	redactedData     string
	customInput      string
	customStreamer   *customInputStreamer
	emittedSummary   bool
	emittedContent   bool
	emittedItemAdded bool
}

// Claude content_block 的索引与 Responses output_index 不是 1:1 — 按收到顺序自增 outputIndex。
type ClaudeResponsesStreamState struct {
	ResponseID      string
	Model           string
	CreatedAt       int64
	StopReason      string
	Usage           *dto.ClaudeUsage
	Outputs         []*responsesOutputItem
	CustomToolNames map[string]bool
	blockToOutput   map[int]*responsesOutputItem
	nextOutputIdx   int
	seq             int
	createdEmitted  bool
}

func NewClaudeResponsesStreamState(model string) *ClaudeResponsesStreamState {
	return &ClaudeResponsesStreamState{
		Model:         model,
		blockToOutput: make(map[int]*responsesOutputItem),
	}
}

func (s *ClaudeResponsesStreamState) nextSeq() int {
	n := s.seq
	s.seq++
	return n
}

func (s *ClaudeResponsesStreamState) Snapshot(status string) *dto.OpenAIResponsesResponse {
	resp := &dto.OpenAIResponsesResponse{
		ID:        s.ResponseID,
		Object:    "response",
		CreatedAt: int(s.CreatedAt),
		Model:     s.Model,
		Output:    make([]dto.ResponsesOutput, 0, len(s.Outputs)),
	}
	if status != "" {
		raw, _ := common.Marshal(status)
		resp.Status = raw
	}
	for _, it := range s.Outputs {
		resp.Output = append(resp.Output, it.toOutput())
	}
	if s.Usage != nil {
		resp.Usage = buildResponsesUsage(s.Usage)
	}
	return resp
}

func (it *responsesOutputItem) toOutput() dto.ResponsesOutput {
	switch it.kind {
	case blockText:
		return dto.ResponsesOutput{
			Type:   "message",
			ID:     it.itemID,
			Status: "completed",
			Role:   "assistant",
			Content: []dto.ResponsesOutputContent{{
				Type:        "output_text",
				Text:        it.text.String(),
				Annotations: it.annotations,
			}},
		}
	case blockThinking:
		out := dto.ResponsesOutput{
			Type:             "reasoning",
			ID:               it.itemID,
			Status:           "completed",
			Summary:          []dto.ResponsesReasoningSummaryPart{},
			EncryptedContent: EncodeThinkingSignature(it.signature.String()),
		}
		text := it.thinking.String()
		if text != "" {
			out.Summary = []dto.ResponsesReasoningSummaryPart{{Type: "summary_text", Text: text}}
		}
		return out
	case blockRedactedThinking:
		return dto.ResponsesOutput{
			Type:             "reasoning",
			ID:               it.itemID,
			Status:           "completed",
			Summary:          []dto.ResponsesReasoningSummaryPart{},
			EncryptedContent: EncodeRedactedThinking(it.redactedData),
		}
	case blockToolUse:
		args := it.toolArgs.String()
		if args == "" {
			args = "{}"
		}
		return dto.ResponsesOutput{
			Type:      "function_call",
			ID:        it.itemID,
			Status:    "completed",
			CallId:    it.toolCallID,
			Name:      it.toolName,
			Arguments: argumentsAsJSONString(args),
		}
	case blockCustomToolCall:
		return dto.ResponsesOutput{
			Type:   "custom_tool_call",
			ID:     it.itemID,
			Status: "completed",
			CallId: it.toolCallID,
			Name:   it.toolName,
			Input:  it.customInput,
		}
	}
	return dto.ResponsesOutput{Type: "unknown", ID: it.itemID}
}

func buildResponsesUsage(u *dto.ClaudeUsage) *dto.Usage {
	if u == nil {
		return nil
	}
	usage := &dto.Usage{
		UsageSemantic: "openai",
		InputTokens:   u.InputTokens,
		OutputTokens:  u.OutputTokens,
		PromptTokens:  u.InputTokens,
		CompletionTokens: u.OutputTokens,
		InputTokensDetails: &dto.InputTokenDetails{
			CachedTokens:         u.CacheReadInputTokens,
			CachedCreationTokens: u.CacheCreationInputTokens,
		},
	}
	usage.TotalTokens = usage.InputTokens + usage.OutputTokens
	return usage
}

func (s *ClaudeResponsesStreamState) HandleClaudeChunk(chunk *dto.ClaudeResponse) []dto.ResponsesStreamResponse {
	if chunk == nil {
		return nil
	}
	events := make([]dto.ResponsesStreamResponse, 0, 4)
	switch chunk.Type {
	case "message_start":
		if chunk.Message != nil {
			if chunk.Message.Id != "" {
				s.ResponseID = chunk.Message.Id
			}
			if chunk.Message.Model != "" {
				s.Model = chunk.Message.Model
			}
			if chunk.Message.Usage != nil {
				s.Usage = chunk.Message.Usage
			}
		}
		events = append(events, s.emitCreated())
		events = append(events, s.emitInProgress())
	case "content_block_start":
		events = append(events, s.handleBlockStart(chunk)...)
	case "content_block_delta":
		events = append(events, s.handleBlockDelta(chunk)...)
	case "content_block_stop":
		events = append(events, s.handleBlockStop(chunk)...)
	case "message_delta":
		if chunk.Delta != nil && chunk.Delta.StopReason != nil {
			s.StopReason = *chunk.Delta.StopReason
		}
		if chunk.Usage != nil {
			s.mergeUsage(chunk.Usage)
		}
	case "message_stop":
		// 最终完成事件由 caller（FinalEvents）发出，保证 message_stop 之后才补 usage
	}
	return events
}

func (s *ClaudeResponsesStreamState) FinalEvents() []dto.ResponsesStreamResponse {
	status := "completed"
	switch s.StopReason {
	case "max_tokens":
		status = "incomplete"
	case "refusal":
		status = "completed"
	}
	resp := s.Snapshot(status)
	evtType := respEventCompleted
	if status == "incomplete" {
		evtType = respEventIncomplete
		resp.IncompleteDetails = &dto.IncompleteDetails{Reason: "max_output_tokens"}
	}
	return []dto.ResponsesStreamResponse{{
		Type:           evtType,
		Response:       resp,
		SequenceNumber: s.nextSeq(),
	}}
}

func (s *ClaudeResponsesStreamState) FailedEvent(errMsg string) dto.ResponsesStreamResponse {
	resp := s.Snapshot("failed")
	resp.Error = map[string]string{
		"code":    "upstream_error",
		"message": errMsg,
	}
	return dto.ResponsesStreamResponse{
		Type:           respEventFailed,
		Response:       resp,
		SequenceNumber: s.nextSeq(),
	}
}

func (s *ClaudeResponsesStreamState) mergeUsage(u *dto.ClaudeUsage) {
	if s.Usage == nil {
		s.Usage = &dto.ClaudeUsage{}
	}
	if u.InputTokens > 0 {
		s.Usage.InputTokens = u.InputTokens
	}
	if u.CacheReadInputTokens > 0 {
		s.Usage.CacheReadInputTokens = u.CacheReadInputTokens
	}
	if u.CacheCreationInputTokens > 0 {
		s.Usage.CacheCreationInputTokens = u.CacheCreationInputTokens
	}
	if u.OutputTokens > 0 {
		s.Usage.OutputTokens = u.OutputTokens
	}
}

func (s *ClaudeResponsesStreamState) emitCreated() dto.ResponsesStreamResponse {
	s.createdEmitted = true
	return dto.ResponsesStreamResponse{
		Type:           respEventCreated,
		Response:       s.Snapshot("in_progress"),
		SequenceNumber: s.nextSeq(),
	}
}

func (s *ClaudeResponsesStreamState) emitInProgress() dto.ResponsesStreamResponse {
	return dto.ResponsesStreamResponse{
		Type:           respEventInProgress,
		Response:       s.Snapshot("in_progress"),
		SequenceNumber: s.nextSeq(),
	}
}

func (s *ClaudeResponsesStreamState) handleBlockStart(chunk *dto.ClaudeResponse) []dto.ResponsesStreamResponse {
	if chunk.ContentBlock == nil {
		return nil
	}
	blockIdx := chunk.GetIndex()

	kind := classifyClaudeBlock(chunk.ContentBlock.Type)
	if kind == blockUnknown {
		return nil
	}
	if kind == blockToolUse && s.CustomToolNames[chunk.ContentBlock.Name] {
		kind = blockCustomToolCall
	}

	it := &responsesOutputItem{
		kind:        kind,
		outputIndex: s.nextOutputIdx,
	}
	s.nextOutputIdx++

	events := make([]dto.ResponsesStreamResponse, 0, 2)
	switch kind {
	case blockText:
		it.itemID = "msg_" + s.ResponseID + "_" + strconv.Itoa(it.outputIndex)
		it.role = "assistant"
		events = append(events, s.emitOutputItemAdded(it))
		events = append(events, s.emitContentPartAdded(it))
		it.emittedContent = true
	case blockThinking:
		it.itemID = "rs_" + s.ResponseID + "_" + strconv.Itoa(it.outputIndex)
		if chunk.ContentBlock.Thinking != nil {
			it.thinking.WriteString(*chunk.ContentBlock.Thinking)
		}
		if chunk.ContentBlock.Signature != "" {
			it.signature.WriteString(chunk.ContentBlock.Signature)
		}
		events = append(events, s.emitOutputItemAdded(it))
		events = append(events, s.emitSummaryPartAdded(it))
		it.emittedSummary = true
	case blockRedactedThinking:
		it.itemID = "rs_redacted_" + s.ResponseID + "_" + strconv.Itoa(it.outputIndex)
		it.redactedData = chunk.ContentBlock.Data
		events = append(events, s.emitOutputItemAdded(it))
	case blockToolUse:
		it.toolCallID = chunk.ContentBlock.Id
		it.toolName = chunk.ContentBlock.Name
		it.itemID = "fc_" + it.toolCallID
		events = append(events, s.emitOutputItemAdded(it))
	case blockCustomToolCall:
		it.toolCallID = chunk.ContentBlock.Id
		it.toolName = chunk.ContentBlock.Name
		it.itemID = "ctc_" + it.toolCallID
		it.customStreamer = newCustomInputStreamer()
		events = append(events, s.emitOutputItemAdded(it))
	}
	s.blockToOutput[blockIdx] = it
	s.Outputs = append(s.Outputs, it)
	it.emittedItemAdded = true
	return events
}

// Claude 的 server_tool_use / web_search_tool_result / code_execution_tool_result 等 server-side 块
// 在 Responses API 里没有 1:1 对应类型，目前直接丢弃以避免产出 type:"unknown" 污染 output；
// 等后续单独映射成 web_search_call/code_interpreter_call 时再扩展这个分类器。
func classifyClaudeBlock(blockType string) responsesBlockKind {
	switch blockType {
	case "text":
		return blockText
	case "thinking":
		return blockThinking
	case "redacted_thinking":
		return blockRedactedThinking
	case "tool_use":
		return blockToolUse
	}
	return blockUnknown
}

func (s *ClaudeResponsesStreamState) handleBlockDelta(chunk *dto.ClaudeResponse) []dto.ResponsesStreamResponse {
	if chunk.Delta == nil {
		return nil
	}
	blockIdx := chunk.GetIndex()
	it, ok := s.blockToOutput[blockIdx]
	if !ok {
		return nil
	}
	events := make([]dto.ResponsesStreamResponse, 0, 1)
	switch chunk.Delta.Type {
	case "text_delta":
		if chunk.Delta.Text != nil && *chunk.Delta.Text != "" {
			it.text.WriteString(*chunk.Delta.Text)
			events = append(events, dto.ResponsesStreamResponse{
				Type:           respEventOutputTextDelta,
				ItemID:         it.itemID,
				OutputIndex:    intPtr(it.outputIndex),
				ContentIndex:   intPtr(0),
				Delta:          *chunk.Delta.Text,
				SequenceNumber: s.nextSeq(),
			})
		}
	case "thinking_delta":
		if chunk.Delta.Thinking != nil && *chunk.Delta.Thinking != "" {
			it.thinking.WriteString(*chunk.Delta.Thinking)
			events = append(events, dto.ResponsesStreamResponse{
				Type:           respEventReasoningSummaryTextDelta,
				ItemID:         it.itemID,
				OutputIndex:    intPtr(it.outputIndex),
				SummaryIndex:   intPtr(0),
				Delta:          *chunk.Delta.Thinking,
				SequenceNumber: s.nextSeq(),
			})
		}
	case "signature_delta":
		if chunk.Delta.Signature != "" {
			it.signature.WriteString(chunk.Delta.Signature)
		}
	case "input_json_delta":
		if chunk.Delta.PartialJson != nil && *chunk.Delta.PartialJson != "" {
			it.toolArgs.WriteString(*chunk.Delta.PartialJson)
			if it.kind == blockCustomToolCall {
				if it.customStreamer == nil {
					it.customStreamer = newCustomInputStreamer()
				}
				delta := it.customStreamer.Feed(*chunk.Delta.PartialJson)
				if delta != "" {
					events = append(events, dto.ResponsesStreamResponse{
						Type:           respEventCustomToolInputDelta,
						ItemID:         it.itemID,
						OutputIndex:    intPtr(it.outputIndex),
						Delta:          delta,
						SequenceNumber: s.nextSeq(),
					})
				}
				break
			}
			events = append(events, dto.ResponsesStreamResponse{
				Type:           respEventFnCallArgsDelta,
				ItemID:         it.itemID,
				OutputIndex:    intPtr(it.outputIndex),
				Delta:          *chunk.Delta.PartialJson,
				SequenceNumber: s.nextSeq(),
			})
		}
	case "citations_delta":
		events = append(events, s.handleCitationDelta(it, chunk.Delta))
	}
	return events
}

func (s *ClaudeResponsesStreamState) handleCitationDelta(it *responsesOutputItem, delta *dto.ClaudeMediaMessage) dto.ResponsesStreamResponse {
	idx := len(it.annotations)
	it.annotations = append(it.annotations, delta)
	return dto.ResponsesStreamResponse{
		Type:            respEventOutputTextAnnotationAdded,
		ItemID:          it.itemID,
		OutputIndex:     intPtr(it.outputIndex),
		ContentIndex:    intPtr(0),
		AnnotationIndex: intPtr(idx),
		Annotation:      delta,
		SequenceNumber:  s.nextSeq(),
	}
}

func (s *ClaudeResponsesStreamState) handleBlockStop(chunk *dto.ClaudeResponse) []dto.ResponsesStreamResponse {
	blockIdx := chunk.GetIndex()
	it, ok := s.blockToOutput[blockIdx]
	if !ok {
		return nil
	}
	events := make([]dto.ResponsesStreamResponse, 0, 4)
	switch it.kind {
	case blockText:
		text := it.text.String()
		events = append(events, dto.ResponsesStreamResponse{
			Type:           respEventOutputTextDone,
			ItemID:         it.itemID,
			OutputIndex:    intPtr(it.outputIndex),
			ContentIndex:   intPtr(0),
			Text:           text,
			SequenceNumber: s.nextSeq(),
		})
		events = append(events, dto.ResponsesStreamResponse{
			Type:         respEventContentPartDone,
			ItemID:       it.itemID,
			OutputIndex:  intPtr(it.outputIndex),
			ContentIndex: intPtr(0),
			Part: map[string]any{
				"type":        "output_text",
				"text":        text,
				"annotations": it.annotations,
			},
			SequenceNumber: s.nextSeq(),
		})
	case blockThinking:
		text := it.thinking.String()
		events = append(events, dto.ResponsesStreamResponse{
			Type:           respEventReasoningSummaryTextDone,
			ItemID:         it.itemID,
			OutputIndex:    intPtr(it.outputIndex),
			SummaryIndex:   intPtr(0),
			Text:           text,
			SequenceNumber: s.nextSeq(),
		})
		events = append(events, dto.ResponsesStreamResponse{
			Type:         respEventReasoningSummaryPartDone,
			ItemID:       it.itemID,
			OutputIndex:  intPtr(it.outputIndex),
			SummaryIndex: intPtr(0),
			Part: map[string]any{
				"type": "summary_text",
				"text": text,
			},
			SequenceNumber: s.nextSeq(),
		})
	case blockToolUse:
		args := it.toolArgs.String()
		if args == "" {
			args = "{}"
		}
		events = append(events, dto.ResponsesStreamResponse{
			Type:           respEventFnCallArgsDone,
			ItemID:         it.itemID,
			OutputIndex:    intPtr(it.outputIndex),
			Arguments:      args,
			SequenceNumber: s.nextSeq(),
		})
	case blockCustomToolCall:
		// streamer Parsed=true 用解析结果；否则用完整 raw JSON 兜底（含 input 缺失、非字符串、嵌套等异常）。
		// 失败兜底比"返回空字符串"安全：宁可让客户端拿到原始 JSON 也不能丢 Codex 等关键内容。
		if it.customStreamer != nil && it.customStreamer.Parsed() {
			it.customInput = it.customStreamer.FinalInput()
		} else {
			it.customInput = extractCustomToolInput(it.toolArgs.String())
			if streamed := it.customStreamer.FinalInput(); it.customInput != streamed && it.customInput != "" {
				if remainder, ok := strings.CutPrefix(it.customInput, streamed); ok && remainder != "" {
					events = append(events, dto.ResponsesStreamResponse{
						Type:           respEventCustomToolInputDelta,
						ItemID:         it.itemID,
						OutputIndex:    intPtr(it.outputIndex),
						Delta:          remainder,
						SequenceNumber: s.nextSeq(),
					})
				} else {
					events = append(events, dto.ResponsesStreamResponse{
						Type:           respEventCustomToolInputDelta,
						ItemID:         it.itemID,
						OutputIndex:    intPtr(it.outputIndex),
						Delta:          it.customInput,
						SequenceNumber: s.nextSeq(),
					})
				}
			}
		}
		events = append(events, dto.ResponsesStreamResponse{
			Type:           respEventCustomToolInputDone,
			ItemID:         it.itemID,
			OutputIndex:    intPtr(it.outputIndex),
			Input:          it.customInput,
			SequenceNumber: s.nextSeq(),
		})
	}
	if it.kind != blockUnknown {
		item := it.toOutput()
		events = append(events, dto.ResponsesStreamResponse{
			Type:           respEventOutputItemDone,
			OutputIndex:    intPtr(it.outputIndex),
			Item:           &item,
			SequenceNumber: s.nextSeq(),
		})
	}
	return events
}

func (s *ClaudeResponsesStreamState) emitOutputItemAdded(it *responsesOutputItem) dto.ResponsesStreamResponse {
	item := it.toOutput()
	item.Status = "in_progress"
	if it.kind == blockText {
		item.Content = []dto.ResponsesOutputContent{}
	}
	if it.kind == blockToolUse {
		item.Arguments = nil
	}
	return dto.ResponsesStreamResponse{
		Type:           respEventOutputItemAdded,
		OutputIndex:    intPtr(it.outputIndex),
		Item:           &item,
		SequenceNumber: s.nextSeq(),
	}
}

func (s *ClaudeResponsesStreamState) emitContentPartAdded(it *responsesOutputItem) dto.ResponsesStreamResponse {
	return dto.ResponsesStreamResponse{
		Type:         respEventContentPartAdded,
		ItemID:       it.itemID,
		OutputIndex:  intPtr(it.outputIndex),
		ContentIndex: intPtr(0),
		Part: map[string]any{
			"type":        "output_text",
			"text":        "",
			"annotations": []any{},
		},
		SequenceNumber: s.nextSeq(),
	}
}

func (s *ClaudeResponsesStreamState) emitSummaryPartAdded(it *responsesOutputItem) dto.ResponsesStreamResponse {
	return dto.ResponsesStreamResponse{
		Type:         respEventReasoningSummaryPartAdded,
		ItemID:       it.itemID,
		OutputIndex:  intPtr(it.outputIndex),
		SummaryIndex: intPtr(0),
		Part: map[string]any{
			"type": "summary_text",
			"text": "",
		},
		SequenceNumber: s.nextSeq(),
	}
}

func ConvertClaudeResponseToResponses(claudeResp *dto.ClaudeResponse, customToolNames map[string]bool) *dto.OpenAIResponsesResponse {
	if claudeResp == nil {
		return nil
	}
	resp := &dto.OpenAIResponsesResponse{
		ID:        claudeResp.Id,
		Object:    "response",
		CreatedAt: 0,
		Model:     claudeResp.Model,
		Output:    make([]dto.ResponsesOutput, 0, len(claudeResp.Content)),
	}
	status := mapClaudeStopReasonToResponsesStatus(claudeResp.StopReason)
	statusRaw, _ := common.Marshal(status)
	resp.Status = statusRaw
	if status == "incomplete" {
		resp.IncompleteDetails = &dto.IncompleteDetails{Reason: "max_output_tokens"}
	}

	idx := 0
	for _, block := range claudeResp.Content {
		switch block.Type {
		case "text":
			resp.Output = append(resp.Output, dto.ResponsesOutput{
				Type:   "message",
				ID:     "msg_" + claudeResp.Id + "_" + strconv.Itoa(idx),
				Status: "completed",
				Role:   "assistant",
				Content: []dto.ResponsesOutputContent{{
					Type:        "output_text",
					Text:        block.GetText(),
					Annotations: []any{},
				}},
			})
		case "thinking":
			out := dto.ResponsesOutput{
				Type:    "reasoning",
				ID:      "rs_" + claudeResp.Id + "_" + strconv.Itoa(idx),
				Status:  "completed",
				Summary: []dto.ResponsesReasoningSummaryPart{},
			}
			if block.Thinking != nil && *block.Thinking != "" {
				out.Summary = []dto.ResponsesReasoningSummaryPart{{
					Type: "summary_text",
					Text: *block.Thinking,
				}}
			}
			if block.Signature != "" {
				out.EncryptedContent = EncodeThinkingSignature(block.Signature)
			}
			resp.Output = append(resp.Output, out)
		case "redacted_thinking":
			resp.Output = append(resp.Output, dto.ResponsesOutput{
				Type:             "reasoning",
				ID:               "rs_redacted_" + claudeResp.Id + "_" + strconv.Itoa(idx),
				Status:           "completed",
				Summary:          []dto.ResponsesReasoningSummaryPart{},
				EncryptedContent: EncodeRedactedThinking(block.Data),
			})
		case "tool_use":
			if customToolNames[block.Name] {
				inputStr := ""
				if raw, marshalErr := common.Marshal(block.Input); marshalErr == nil {
					inputStr = extractCustomToolInput(string(raw))
				}
				resp.Output = append(resp.Output, dto.ResponsesOutput{
					Type:   "custom_tool_call",
					ID:     "ctc_" + block.Id,
					Status: "completed",
					CallId: block.Id,
					Name:   block.Name,
					Input:  inputStr,
				})
				break
			}
			args, marshalErr := common.Marshal(block.Input)
			if marshalErr != nil || len(args) == 0 {
				args = []byte("{}")
			}
			resp.Output = append(resp.Output, dto.ResponsesOutput{
				Type:      "function_call",
				ID:        "fc_" + block.Id,
				Status:    "completed",
				CallId:    block.Id,
				Name:      block.Name,
				Arguments: argumentsAsJSONString(string(args)),
			})
		}
		idx++
	}

	if claudeResp.Usage != nil {
		resp.Usage = buildResponsesUsage(claudeResp.Usage)
	}
	return resp
}

func mapClaudeStopReasonToResponsesStatus(reason string) string {
	switch reason {
	case "max_tokens":
		return "incomplete"
	case "refusal":
		return "completed"
	case "":
		return "completed"
	}
	return "completed"
}

func intPtr(i int) *int { return &i }

// 把 Claude 累积的 tool_use input JSON 抽成 custom_tool_call 的 raw string。
// 入口侧把 custom tool 降级成 function tool with {input: string} schema，所以模型生成的
// tool_use.input 应该是 {"input":"<raw>"}；解析失败则回退用整段 JSON 当 raw input 避免丢失。
// extractCustomToolInput 区分 input 字段的三种状态：
//   - 存在且是 string → 返回该 string（包括空串）
//   - 缺失或非 string → 返回整段 raw JSON，避免模型不按 schema 输出时丢内容
func extractCustomToolInput(rawJSON string) string {
	if rawJSON == "" {
		return ""
	}
	var probe map[string]json.RawMessage
	if err := common.UnmarshalJsonStr(rawJSON, &probe); err != nil {
		return rawJSON
	}
	raw, ok := probe["input"]
	if !ok {
		return rawJSON
	}
	var s string
	if err := common.Unmarshal(raw, &s); err == nil {
		return s
	}
	return rawJSON
}

// OpenAI Responses 协议规定 function_call.arguments 在 wire 上是 string（客户端用 JSON.parse 解析），
// 而我们底层 raw 是 JSON object/array 字面字节。这里把它再 quote 一层，
// 使 json.RawMessage 序列化时输出 "{\"cmd\":...}" 而不是 {"cmd":...}。
func argumentsAsJSONString(rawJSON string) json.RawMessage {
	if rawJSON == "" {
		rawJSON = "{}"
	}
	quoted, err := common.Marshal(rawJSON)
	if err != nil {
		return json.RawMessage(`"{}"`)
	}
	return json.RawMessage(quoted)
}
