package claude

import (
	"bufio"
	"fmt"
	"net/http"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type claudeBufferedStreamAccumulator struct {
	response     dto.ClaudeResponse
	stopSequence *string
	blocks       map[int]*dto.ClaudeMediaMessage
	toolInputs   map[int]*strings.Builder
	started      bool
	stopped      bool
}

type claudeBufferedResponse struct {
	*dto.ClaudeResponse
	StopSequence *string `json:"stop_sequence"`
}

func newClaudeBufferedStreamAccumulator() *claudeBufferedStreamAccumulator {
	return &claudeBufferedStreamAccumulator{
		response: dto.ClaudeResponse{
			Type: "message",
			Role: "assistant",
		},
		blocks:     make(map[int]*dto.ClaudeMediaMessage),
		toolInputs: make(map[int]*strings.Builder),
	}
}

func cloneClaudeUsage(usage *dto.ClaudeUsage) *dto.ClaudeUsage {
	if usage == nil {
		return nil
	}
	cloned := *usage
	if usage.CacheCreation != nil {
		cacheCreation := *usage.CacheCreation
		cloned.CacheCreation = &cacheCreation
	}
	if usage.ServerToolUse != nil {
		serverToolUse := *usage.ServerToolUse
		cloned.ServerToolUse = &serverToolUse
	}
	cloned.BillingUsage = dto.CloneBillingUsage(usage.BillingUsage)
	return &cloned
}

func mergeClaudeUsage(target **dto.ClaudeUsage, incoming *dto.ClaudeUsage) {
	if incoming == nil {
		return
	}
	if *target == nil {
		*target = cloneClaudeUsage(incoming)
		return
	}

	usage := *target
	if incoming.InputTokens > 0 {
		usage.InputTokens = incoming.InputTokens
	}
	if incoming.CacheCreationInputTokens > 0 {
		usage.CacheCreationInputTokens = incoming.CacheCreationInputTokens
	}
	if incoming.CacheReadInputTokens > 0 {
		usage.CacheReadInputTokens = incoming.CacheReadInputTokens
	}
	if incoming.OutputTokens > 0 {
		usage.OutputTokens = incoming.OutputTokens
	}
	if incoming.ClaudeCacheCreation5mTokens > 0 {
		usage.ClaudeCacheCreation5mTokens = incoming.ClaudeCacheCreation5mTokens
	}
	if incoming.ClaudeCacheCreation1hTokens > 0 {
		usage.ClaudeCacheCreation1hTokens = incoming.ClaudeCacheCreation1hTokens
	}
	if incoming.CacheCreation != nil {
		if usage.CacheCreation == nil {
			cacheCreation := *incoming.CacheCreation
			usage.CacheCreation = &cacheCreation
		} else {
			if incoming.CacheCreation.Ephemeral5mInputTokens > 0 {
				usage.CacheCreation.Ephemeral5mInputTokens = incoming.CacheCreation.Ephemeral5mInputTokens
			}
			if incoming.CacheCreation.Ephemeral1hInputTokens > 0 {
				usage.CacheCreation.Ephemeral1hInputTokens = incoming.CacheCreation.Ephemeral1hInputTokens
			}
		}
	}
	if incoming.ServerToolUse != nil {
		serverToolUse := *incoming.ServerToolUse
		usage.ServerToolUse = &serverToolUse
	}
	if incoming.BillingUsage != nil {
		usage.BillingUsage = dto.CloneBillingUsage(incoming.BillingUsage)
	}
}

func (a *claudeBufferedStreamAccumulator) block(index int) *dto.ClaudeMediaMessage {
	block, ok := a.blocks[index]
	if ok {
		return block
	}
	block = &dto.ClaudeMediaMessage{}
	a.blocks[index] = block
	return block
}

func (a *claudeBufferedStreamAccumulator) finalizeToolInput(index int) error {
	builder, ok := a.toolInputs[index]
	if !ok {
		return nil
	}
	delete(a.toolInputs, index)

	input := make(map[string]interface{})
	partialJSON := strings.TrimSpace(builder.String())
	if partialJSON != "" {
		if err := common.Unmarshal([]byte(partialJSON), &input); err != nil {
			return fmt.Errorf("invalid Claude tool input at content block %d: %w", index, err)
		}
	}
	a.block(index).Input = input
	return nil
}

func (a *claudeBufferedStreamAccumulator) process(event *dto.ClaudeResponse) error {
	if event == nil {
		return nil
	}

	switch event.Type {
	case "message_start":
		if event.Message == nil {
			return fmt.Errorf("Claude message_start is missing message")
		}
		a.started = true
		a.response.Id = event.Message.Id
		a.response.Model = event.Message.Model
		if event.Message.Type != "" {
			a.response.Type = event.Message.Type
		}
		if event.Message.Role != "" {
			a.response.Role = event.Message.Role
		}
		if event.Message.StopReason != nil {
			a.response.StopReason = *event.Message.StopReason
		}
		a.stopSequence = event.Message.StopSequence
		mergeClaudeUsage(&a.response.Usage, event.Message.Usage)
	case "content_block_start":
		if event.ContentBlock == nil {
			return fmt.Errorf("Claude content_block_start is missing content_block")
		}
		contentBlock := *event.ContentBlock
		a.blocks[event.GetIndex()] = &contentBlock
	case "content_block_delta":
		if event.Delta == nil {
			return fmt.Errorf("Claude content_block_delta is missing delta")
		}
		index := event.GetIndex()
		block := a.block(index)
		switch event.Delta.Type {
		case "text_delta":
			block.Type = "text"
			if event.Delta.Text != nil {
				text := block.GetText() + *event.Delta.Text
				block.Text = &text
			}
		case "thinking_delta":
			block.Type = "thinking"
			if event.Delta.Thinking != nil {
				thinking := ""
				if block.Thinking != nil {
					thinking = *block.Thinking
				}
				thinking += *event.Delta.Thinking
				block.Thinking = &thinking
			}
		case "signature_delta":
			block.Signature += event.Delta.Signature
		case "input_json_delta":
			if event.Delta.PartialJson != nil {
				builder, ok := a.toolInputs[index]
				if !ok {
					builder = &strings.Builder{}
					a.toolInputs[index] = builder
				}
				builder.WriteString(*event.Delta.PartialJson)
			}
		}
	case "content_block_stop":
		return a.finalizeToolInput(event.GetIndex())
	case "message_delta":
		if event.Delta != nil {
			if event.Delta.StopReason != nil {
				a.response.StopReason = *event.Delta.StopReason
			}
			if event.Delta.StopSequence != nil {
				a.stopSequence = event.Delta.StopSequence
			}
		}
		mergeClaudeUsage(&a.response.Usage, event.Usage)
	case "message_stop":
		a.stopped = true
		return nil
	case "ping":
		return nil
	}
	return nil
}

func (a *claudeBufferedStreamAccumulator) finalResponse(model string) (*claudeBufferedResponse, error) {
	if !a.started {
		return nil, fmt.Errorf("Claude stream ended without message_start")
	}
	if !a.stopped {
		return nil, fmt.Errorf("Claude stream ended without message_stop")
	}
	for index := range a.toolInputs {
		if err := a.finalizeToolInput(index); err != nil {
			return nil, err
		}
	}

	indices := make([]int, 0, len(a.blocks))
	for index := range a.blocks {
		indices = append(indices, index)
	}
	sort.Ints(indices)
	a.response.Content = make([]dto.ClaudeMediaMessage, 0, len(indices))
	for _, index := range indices {
		a.response.Content = append(a.response.Content, *a.blocks[index])
	}

	if a.response.Model == "" {
		a.response.Model = model
	}
	if a.response.Usage == nil {
		a.response.Usage = &dto.ClaudeUsage{}
	}
	return &claudeBufferedResponse{
		ClaudeResponse: &a.response,
		StopSequence:   a.stopSequence,
	}, nil
}

func ClaudeBufferedStreamHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse)
	}
	defer service.CloseResponseBodyGracefully(resp)

	accumulator := newClaudeBufferedStreamAccumulator()
	scanner := helper.NewStreamScanner(resp.Body)
	scanner.Split(bufio.ScanLines)
	for scanner.Scan() {
		line := scanner.Text()
		if len(line) < 5 || line[:5] != "data:" {
			continue
		}
		data := strings.TrimSpace(line[5:])
		if data == "" || data == "[DONE]" {
			continue
		}

		info.SetFirstResponseTime()
		info.ReceivedResponseCount++

		var event dto.ClaudeResponse
		if err := common.UnmarshalJsonStr(data, &event); err != nil {
			return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
		}
		if claudeError := event.GetClaudeError(); claudeError != nil && claudeError.Type != "" {
			return nil, types.WithClaudeError(*claudeError, http.StatusInternalServerError)
		}
		if err := accumulator.process(&event); err != nil {
			return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
		}
		if event.Type == "message_stop" {
			break
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponse)
	}

	response, err := accumulator.finalResponse(info.UpstreamModelName)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	responseBody, err := common.Marshal(response)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeJsonMarshalFailed)
	}

	resp.Header.Set("Content-Type", "application/json; charset=utf-8")
	claudeInfo := &ClaudeResponseInfo{Usage: &dto.Usage{}}
	if handleErr := HandleClaudeResponseData(c, info, claudeInfo, resp, responseBody); handleErr != nil {
		return nil, handleErr
	}
	return claudeInfo.Usage, nil
}
