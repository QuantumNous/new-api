package helper

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
)

// FilterOpenAITextCompletion scans assistant output and either replaces the whole
// reply with the configured block message, or masks matched words in place.
// Returns true when the response was modified.
func FilterOpenAITextCompletion(c *gin.Context, info *relaycommon.RelayInfo, response *dto.OpenAITextResponse) bool {
	if !setting.ShouldCheckCompletionSensitive() || response == nil || len(response.Choices) == 0 {
		return false
	}
	var combined strings.Builder
	for i := range response.Choices {
		combined.WriteString(response.Choices[i].Message.StringContent())
		combined.WriteString(response.Choices[i].Message.GetReasoningContent())
	}
	hit, words := service.CheckSensitiveText(combined.String())
	if !hit {
		return false
	}
	service.RecordSensitiveBlockLog(c, info, words, true)
	reply := setting.GetSensitiveBlockReply()
	if setting.StopOnSensitiveEnabled || !service.SensitiveWordsAreSubstrings(combined.String(), words) {
		for i := range response.Choices {
			response.Choices[i].Message.SetStringContent(reply)
			response.Choices[i].Message.ReasoningContent = nil
			response.Choices[i].Message.Reasoning = nil
			response.Choices[i].FinishReason = "stop"
		}
		return true
	}
	for i := range response.Choices {
		content := response.Choices[i].Message.StringContent()
		_, _, replaced := service.SensitiveWordReplace(content, false)
		response.Choices[i].Message.SetStringContent(replaced)
		if reasoning := response.Choices[i].Message.GetReasoningContent(); reasoning != "" {
			_, _, replacedReasoning := service.SensitiveWordReplace(reasoning, false)
			response.Choices[i].Message.ReasoningContent = &replacedReasoning
			response.Choices[i].Message.Reasoning = nil
		}
	}
	return true
}

// FilterClaudeTextCompletion scans Claude message content blocks for sensitive words.
func FilterClaudeTextCompletion(c *gin.Context, info *relaycommon.RelayInfo, response *dto.ClaudeResponse) bool {
	if !setting.ShouldCheckCompletionSensitive() || response == nil {
		return false
	}
	var combined strings.Builder
	for _, block := range response.Content {
		if block.Type == "text" {
			combined.WriteString(block.GetText())
		}
		if block.Thinking != nil {
			combined.WriteString(*block.Thinking)
		}
	}
	hit, words := service.CheckSensitiveText(combined.String())
	if !hit {
		return false
	}
	service.RecordSensitiveBlockLog(c, info, words, true)
	reply := setting.GetSensitiveBlockReply()
	if setting.StopOnSensitiveEnabled || !service.SensitiveWordsAreSubstrings(combined.String(), words) {
		text := dto.ClaudeMediaMessage{Type: "text"}
		text.SetText(reply)
		response.Content = []dto.ClaudeMediaMessage{text}
		response.StopReason = "end_turn"
		return true
	}
	for i := range response.Content {
		if response.Content[i].Type == "text" {
			_, _, replaced := service.SensitiveWordReplace(response.Content[i].GetText(), false)
			response.Content[i].SetText(replaced)
		}
		if response.Content[i].Thinking != nil {
			_, _, replaced := service.SensitiveWordReplace(*response.Content[i].Thinking, false)
			response.Content[i].Thinking = &replaced
		}
	}
	return true
}

// CheckAccumulatedCompletion returns whether accumulated output hits the word list.
func CheckAccumulatedCompletion(text string) (bool, []string) {
	if !setting.ShouldCheckCompletionSensitive() {
		return false, nil
	}
	return service.CheckSensitiveText(text)
}

// CheckAccumulatedCompletionSuffix scans only newly appended stream text (with
// keyword-length overlap). previouslyChecked/newChecked are byte offsets into text.
func CheckAccumulatedCompletionSuffix(text string, previouslyChecked int) (bool, []string, int) {
	if !setting.ShouldCheckCompletionSensitive() {
		return false, nil, len(text)
	}
	return service.CheckSensitiveTextSuffix(text, previouslyChecked)
}

// EmitOpenAIStreamSensitiveStop appends a configured reply and finishes the stream.
func EmitOpenAIStreamSensitiveStop(c *gin.Context, responseID string, created int64, modelName string) {
	if responseID == "" {
		responseID = GetResponseID(c)
	}
	if created == 0 {
		created = common.GetTimestamp()
	}
	SetEventStreamHeaders(c)
	reply := setting.GetSensitiveBlockReply()
	contentChunk := &dto.ChatCompletionsStreamResponse{
		Id:      responseID,
		Object:  "chat.completion.chunk",
		Created: created,
		Model:   modelName,
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{}},
		},
	}
	contentChunk.Choices[0].Delta.SetContentString("\n" + reply)
	_ = ObjectData(c, contentChunk)
	if stop := GenerateStopResponse(responseID, created, modelName, "stop"); stop != nil {
		_ = ObjectData(c, stop)
	}
	Done(c)
}

// EmitClaudeStreamSensitiveStop finishes a Claude SSE stream after an output hit.
func EmitClaudeStreamSensitiveStop(c *gin.Context) {
	SetEventStreamHeaders(c)
	reply := setting.GetSensitiveBlockReply()
	index := 0
	delta := dto.ClaudeMediaMessage{Type: "text_delta"}
	delta.SetText("\n" + reply)
	_ = ClaudeData(c, dto.ClaudeResponse{
		Type:  "content_block_delta",
		Index: &index,
		Delta: &delta,
	})
	_ = ClaudeData(c, dto.ClaudeResponse{
		Type:  "content_block_stop",
		Index: &index,
	})
	_ = ClaudeData(c, dto.ClaudeResponse{
		Type: "message_delta",
		Usage: &dto.ClaudeUsage{
			OutputTokens: 0,
		},
		Delta: &dto.ClaudeMediaMessage{
			StopReason: common.GetPointer("end_turn"),
		},
	})
	_ = ClaudeData(c, dto.ClaudeResponse{Type: "message_stop"})
}

// EmitGeminiStreamSensitiveStop finishes a Gemini SSE stream after an output hit.
func EmitGeminiStreamSensitiveStop(c *gin.Context) {
	SetEventStreamHeaders(c)
	reply := setting.GetSensitiveBlockReply()
	finishReason := "STOP"
	payload, err := common.Marshal(dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{
			{
				Content: dto.GeminiChatContent{
					Role: "model",
					Parts: []dto.GeminiPart{
						{Text: "\n" + reply},
					},
				},
				FinishReason: &finishReason,
				Index:        0,
			},
		},
	})
	if err != nil {
		return
	}
	c.Render(-1, common.CustomEvent{Data: "data: " + string(payload)})
	_ = FlushWriter(c)
}
