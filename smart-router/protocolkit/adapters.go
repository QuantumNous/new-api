package protocolkit

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"strings"

	"smart-router/api"
)

const (
	expectedText       = "ok"
	expectedToolName   = "weather"
	expectedToolArgs   = `{"city":"Paris"}`
	expectedInput      = 7
	expectedOutput     = 3
	expectedErrorClass = "rate_limit_error"
)

type normalizedResponse struct {
	Text         string
	ToolName     string
	ToolArgs     string
	InputTokens  int
	OutputTokens int
}

type adapterFixtures struct {
	Unary  []byte
	Stream []byte
	Error  []byte
}

type conformanceAdapter struct {
	path         string
	encode       func(string, bool) ([]byte, error)
	fixtures     func(CheckName) (adapterFixtures, error)
	decodeUnary  func([]byte) (normalizedResponse, error)
	decodeStream func([]byte) (string, error)
	decodeError  func([]byte) (string, error)
}

func (adapter conformanceAdapter) Path() string {
	return adapter.path
}

func (adapter conformanceAdapter) Run(modelID string, mutation CheckName) ([]Check, error) {
	for _, stream := range []bool{false, true} {
		request, err := adapter.encode(modelID, stream)
		if err != nil {
			return nil, err
		}
		if !json.Valid(request) {
			return nil, errors.New("adapter encoded invalid JSON")
		}
	}
	fixtures, err := adapter.fixtures(mutation)
	if err != nil {
		return nil, err
	}
	unary, err := adapter.decodeUnary(fixtures.Unary)
	if err != nil {
		return nil, err
	}
	streamed, err := adapter.decodeStream(fixtures.Stream)
	if err != nil {
		return nil, err
	}
	errorClass, err := adapter.decodeError(fixtures.Error)
	if err != nil {
		return nil, err
	}
	return []Check{
		check(CheckUnary, unary.Text == expectedText),
		check(CheckStream, streamed == expectedText),
		check(
			CheckTool,
			unary.ToolName == expectedToolName && unary.ToolArgs == expectedToolArgs,
		),
		check(
			CheckUsage,
			unary.InputTokens == expectedInput && unary.OutputTokens == expectedOutput,
		),
		check(CheckError, errorClass == expectedErrorClass),
	}, nil
}

func check(name CheckName, passed bool) Check {
	return Check{Name: name, Applicable: true, Passed: passed}
}

func protocolAdapters() map[api.Protocol]conformanceAdapter {
	return map[api.Protocol]conformanceAdapter{
		api.ProtocolChat: {
			path:         "openai/chat-completions",
			encode:       encodeChatRequest,
			fixtures:     chatFixtures,
			decodeUnary:  decodeChatUnary,
			decodeStream: decodeChatStream,
			decodeError:  decodeErrorEnvelope,
		},
		api.ProtocolResponses: {
			path:         "openai/responses",
			encode:       encodeResponsesRequest,
			fixtures:     responsesFixtures,
			decodeUnary:  decodeResponsesUnary,
			decodeStream: decodeResponsesStream,
			decodeError:  decodeErrorEnvelope,
		},
		api.ProtocolMessages: {
			path:         "anthropic/messages",
			encode:       encodeMessagesRequest,
			fixtures:     messagesFixtures,
			decodeUnary:  decodeMessagesUnary,
			decodeStream: decodeMessagesStream,
			decodeError:  decodeErrorEnvelope,
		},
	}
}

type errorEnvelope struct {
	Error struct {
		Type string `json:"type"`
	} `json:"error"`
}

func decodeErrorEnvelope(payload []byte) (string, error) {
	var envelope errorEnvelope
	if err := json.Unmarshal(payload, &envelope); err != nil {
		return "", err
	}
	return envelope.Error.Type, nil
}

func fixtureValues(mutation CheckName) (string, string, string, int, int, string) {
	text := expectedText
	streamText := expectedText
	toolName := expectedToolName
	inputTokens := expectedInput
	outputTokens := expectedOutput
	errorClass := expectedErrorClass
	switch mutation {
	case CheckUnary:
		text = "mutated"
	case CheckStream:
		streamText = "mutated"
	case CheckTool:
		toolName = "mutated"
	case CheckUsage:
		inputTokens++
	case CheckError:
		errorClass = "mutated"
	}
	return text, streamText, toolName, inputTokens, outputTokens, errorClass
}

func marshalErrorFixture(errorClass string) ([]byte, error) {
	fixture := errorEnvelope{}
	fixture.Error.Type = errorClass
	return json.Marshal(fixture)
}

type chatRequest struct {
	Model    string        `json:"model"`
	Stream   bool          `json:"stream"`
	Messages []chatMessage `json:"messages"`
	Tools    []chatTool    `json:"tools"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatTool struct {
	Type     string       `json:"type"`
	Function chatFunction `json:"function"`
}

type chatFunction struct {
	Name       string          `json:"name"`
	Arguments  string          `json:"arguments,omitempty"`
	Parameters json.RawMessage `json:"parameters,omitempty"`
}

func encodeChatRequest(modelID string, stream bool) ([]byte, error) {
	return json.Marshal(chatRequest{
		Model:  modelID,
		Stream: stream,
		Messages: []chatMessage{{
			Role: "user", Content: "ping",
		}},
		Tools: []chatTool{{
			Type: "function",
			Function: chatFunction{
				Name:       expectedToolName,
				Parameters: json.RawMessage(`{"type":"object"}`),
			},
		}},
	})
}

type chatResponse struct {
	Choices []chatChoice `json:"choices"`
	Usage   chatUsage    `json:"usage"`
}

type chatChoice struct {
	Message chatResponseMessage `json:"message"`
	Delta   chatResponseMessage `json:"delta,omitempty"`
}

type chatResponseMessage struct {
	Content   string         `json:"content,omitempty"`
	ToolCalls []chatToolCall `json:"tool_calls,omitempty"`
}

type chatToolCall struct {
	Function chatFunction `json:"function"`
}

type chatUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
}

func chatFixtures(mutation CheckName) (adapterFixtures, error) {
	text, streamText, toolName, inputTokens, outputTokens, errorClass :=
		fixtureValues(mutation)
	unary, err := json.Marshal(chatResponse{
		Choices: []chatChoice{{
			Message: chatResponseMessage{
				Content: text,
				ToolCalls: []chatToolCall{{
					Function: chatFunction{
						Name: toolName, Arguments: expectedToolArgs,
					},
				}},
			},
		}},
		Usage: chatUsage{
			PromptTokens: inputTokens, CompletionTokens: outputTokens,
		},
	})
	if err != nil {
		return adapterFixtures{}, err
	}
	var stream bytes.Buffer
	for _, delta := range splitStreamText(streamText) {
		payload, err := json.Marshal(chatResponse{
			Choices: []chatChoice{{
				Delta: chatResponseMessage{Content: delta},
			}},
		})
		if err != nil {
			return adapterFixtures{}, err
		}
		stream.WriteString("data: ")
		stream.Write(payload)
		stream.WriteString("\n\n")
	}
	stream.WriteString("data: [DONE]\n\n")
	errorPayload, err := marshalErrorFixture(errorClass)
	return adapterFixtures{
		Unary: unary, Stream: stream.Bytes(), Error: errorPayload,
	}, err
}

func decodeChatUnary(payload []byte) (normalizedResponse, error) {
	var response chatResponse
	if err := json.Unmarshal(payload, &response); err != nil {
		return normalizedResponse{}, err
	}
	if len(response.Choices) != 1 ||
		len(response.Choices[0].Message.ToolCalls) != 1 {
		return normalizedResponse{}, errors.New("chat fixture shape is invalid")
	}
	message := response.Choices[0].Message
	return normalizedResponse{
		Text:         message.Content,
		ToolName:     message.ToolCalls[0].Function.Name,
		ToolArgs:     message.ToolCalls[0].Function.Arguments,
		InputTokens:  response.Usage.PromptTokens,
		OutputTokens: response.Usage.CompletionTokens,
	}, nil
}

func decodeChatStream(payload []byte) (string, error) {
	var text strings.Builder
	err := scanSSEData(payload, func(data []byte) error {
		var response chatResponse
		if err := json.Unmarshal(data, &response); err != nil {
			return err
		}
		if len(response.Choices) != 1 {
			return errors.New("chat stream fixture shape is invalid")
		}
		text.WriteString(response.Choices[0].Delta.Content)
		return nil
	})
	return text.String(), err
}

type responsesRequest struct {
	Model  string          `json:"model"`
	Stream bool            `json:"stream"`
	Input  string          `json:"input"`
	Tools  []responsesTool `json:"tools"`
}

type responsesTool struct {
	Type       string          `json:"type"`
	Name       string          `json:"name"`
	Parameters json.RawMessage `json:"parameters"`
}

func encodeResponsesRequest(modelID string, stream bool) ([]byte, error) {
	return json.Marshal(responsesRequest{
		Model: modelID, Stream: stream, Input: "ping",
		Tools: []responsesTool{{
			Type: "function", Name: expectedToolName,
			Parameters: json.RawMessage(`{"type":"object"}`),
		}},
	})
}

type responsesResponse struct {
	Output []responsesOutput `json:"output"`
	Usage  responsesUsage    `json:"usage"`
}

type responsesOutput struct {
	Type      string             `json:"type"`
	Content   []responsesContent `json:"content,omitempty"`
	Name      string             `json:"name,omitempty"`
	Arguments string             `json:"arguments,omitempty"`
}

type responsesContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type responsesUsage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

func responsesFixtures(mutation CheckName) (adapterFixtures, error) {
	text, streamText, toolName, inputTokens, outputTokens, errorClass :=
		fixtureValues(mutation)
	unary, err := json.Marshal(responsesResponse{
		Output: []responsesOutput{
			{
				Type: "message",
				Content: []responsesContent{{
					Type: "output_text", Text: text,
				}},
			},
			{
				Type: "function_call", Name: toolName,
				Arguments: expectedToolArgs,
			},
		},
		Usage: responsesUsage{
			InputTokens: inputTokens, OutputTokens: outputTokens,
		},
	})
	if err != nil {
		return adapterFixtures{}, err
	}
	var stream bytes.Buffer
	for _, delta := range splitStreamText(streamText) {
		payload, err := json.Marshal(struct {
			Delta string `json:"delta"`
		}{Delta: delta})
		if err != nil {
			return adapterFixtures{}, err
		}
		stream.WriteString("event: response.output_text.delta\n")
		stream.WriteString("data: ")
		stream.Write(payload)
		stream.WriteString("\n\n")
	}
	stream.WriteString("data: [DONE]\n\n")
	errorPayload, err := marshalErrorFixture(errorClass)
	return adapterFixtures{
		Unary: unary, Stream: stream.Bytes(), Error: errorPayload,
	}, err
}

func decodeResponsesUnary(payload []byte) (normalizedResponse, error) {
	var response responsesResponse
	if err := json.Unmarshal(payload, &response); err != nil {
		return normalizedResponse{}, err
	}
	var normalized normalizedResponse
	for _, output := range response.Output {
		switch output.Type {
		case "message":
			for _, content := range output.Content {
				if content.Type == "output_text" {
					normalized.Text += content.Text
				}
			}
		case "function_call":
			normalized.ToolName = output.Name
			normalized.ToolArgs = output.Arguments
		}
	}
	normalized.InputTokens = response.Usage.InputTokens
	normalized.OutputTokens = response.Usage.OutputTokens
	return normalized, nil
}

func decodeResponsesStream(payload []byte) (string, error) {
	var text strings.Builder
	err := scanSSEData(payload, func(data []byte) error {
		var event struct {
			Delta string `json:"delta"`
		}
		if err := json.Unmarshal(data, &event); err != nil {
			return err
		}
		text.WriteString(event.Delta)
		return nil
	})
	return text.String(), err
}

type messagesRequest struct {
	Model     string           `json:"model"`
	Stream    bool             `json:"stream"`
	MaxTokens int              `json:"max_tokens"`
	Messages  []messageRequest `json:"messages"`
	Tools     []messagesTool   `json:"tools"`
}

type messageRequest struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type messagesTool struct {
	Name        string          `json:"name"`
	InputSchema json.RawMessage `json:"input_schema"`
}

func encodeMessagesRequest(modelID string, stream bool) ([]byte, error) {
	return json.Marshal(messagesRequest{
		Model: modelID, Stream: stream, MaxTokens: 32,
		Messages: []messageRequest{{
			Role: "user", Content: "ping",
		}},
		Tools: []messagesTool{{
			Name:        expectedToolName,
			InputSchema: json.RawMessage(`{"type":"object"}`),
		}},
	})
}

type messagesResponse struct {
	Content []messagesContent `json:"content"`
	Usage   messagesUsage     `json:"usage"`
}

type messagesContent struct {
	Type  string          `json:"type"`
	Text  string          `json:"text,omitempty"`
	Name  string          `json:"name,omitempty"`
	Input json.RawMessage `json:"input,omitempty"`
}

type messagesUsage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

func messagesFixtures(mutation CheckName) (adapterFixtures, error) {
	text, streamText, toolName, inputTokens, outputTokens, errorClass :=
		fixtureValues(mutation)
	unary, err := json.Marshal(messagesResponse{
		Content: []messagesContent{
			{Type: "text", Text: text},
			{
				Type: "tool_use", Name: toolName,
				Input: json.RawMessage(expectedToolArgs),
			},
		},
		Usage: messagesUsage{
			InputTokens: inputTokens, OutputTokens: outputTokens,
		},
	})
	if err != nil {
		return adapterFixtures{}, err
	}
	var stream bytes.Buffer
	for _, delta := range splitStreamText(streamText) {
		payload, err := json.Marshal(struct {
			Delta struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"delta"`
		}{})
		if err != nil {
			return adapterFixtures{}, err
		}
		var event map[string]any
		if err := json.Unmarshal(payload, &event); err != nil {
			return adapterFixtures{}, err
		}
		event["delta"] = map[string]string{
			"type": "text_delta",
			"text": delta,
		}
		payload, err = json.Marshal(event)
		if err != nil {
			return adapterFixtures{}, err
		}
		stream.WriteString("event: content_block_delta\n")
		stream.WriteString("data: ")
		stream.Write(payload)
		stream.WriteString("\n\n")
	}
	stream.WriteString("data: [DONE]\n\n")
	errorPayload, err := marshalErrorFixture(errorClass)
	return adapterFixtures{
		Unary: unary, Stream: stream.Bytes(), Error: errorPayload,
	}, err
}

func decodeMessagesUnary(payload []byte) (normalizedResponse, error) {
	var response messagesResponse
	if err := json.Unmarshal(payload, &response); err != nil {
		return normalizedResponse{}, err
	}
	var normalized normalizedResponse
	for _, content := range response.Content {
		switch content.Type {
		case "text":
			normalized.Text += content.Text
		case "tool_use":
			normalized.ToolName = content.Name
			normalized.ToolArgs = string(content.Input)
		}
	}
	normalized.InputTokens = response.Usage.InputTokens
	normalized.OutputTokens = response.Usage.OutputTokens
	return normalized, nil
}

func decodeMessagesStream(payload []byte) (string, error) {
	var text strings.Builder
	err := scanSSEData(payload, func(data []byte) error {
		var event struct {
			Delta struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"delta"`
		}
		if err := json.Unmarshal(data, &event); err != nil {
			return err
		}
		if event.Delta.Type != "text_delta" {
			return errors.New("messages stream delta type is invalid")
		}
		text.WriteString(event.Delta.Text)
		return nil
	})
	return text.String(), err
}

func scanSSEData(payload []byte, visit func([]byte) error) error {
	scanner := bufio.NewScanner(bytes.NewReader(payload))
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			continue
		}
		if err := visit([]byte(data)); err != nil {
			return err
		}
	}
	return scanner.Err()
}

func splitStreamText(text string) []string {
	if len(text) < 2 {
		return []string{text}
	}
	middle := len(text) / 2
	return []string{text[:middle], text[middle:]}
}
