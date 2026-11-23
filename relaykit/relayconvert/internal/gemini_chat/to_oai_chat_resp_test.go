package geminichat

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func renderGeminiTextParts(t *testing.T, texts []string) map[string]string {
	t.Helper()
	parts := make([]dto.GeminiPart, len(texts))
	for i, text := range texts {
		parts[i] = dto.GeminiPart{Text: text}
	}

	response := ResponseGeminiChat2OpenAI("chatcmpl-test", 1, &dto.GeminiChatResponse{Candidates: []dto.GeminiChatCandidate{{
		Content:      dto.GeminiChatContent{Role: "model", Parts: parts},
		FinishReason: kitutil.GetPointer("STOP"),
	}}})
	require.Len(t, response.Choices, 1)

	event, _ := StreamResponseGeminiChat2OpenAI(&dto.GeminiChatResponse{Candidates: []dto.GeminiChatCandidate{{
		Content: dto.GeminiChatContent{Role: "model", Parts: parts},
	}}})
	require.Len(t, event.Choices, 1)

	state := NewGeminiToChatStreamState("chatcmpl-test", 1)
	var streamed strings.Builder
	for _, part := range parts {
		chunks, err := state.ConvertChunk(&dto.GeminiChatResponse{Candidates: []dto.GeminiChatCandidate{{
			Content: dto.GeminiChatContent{Role: "model", Parts: []dto.GeminiPart{part}},
		}}}, "gemini-test", nil)
		require.NoError(t, err)
		for _, chunk := range chunks {
			for _, choice := range chunk.Choices {
				streamed.WriteString(choice.Delta.GetContentString())
			}
		}
	}

	return map[string]string{
		"non-stream":            response.Choices[0].Message.StringContent(),
		"one stream event":      event.Choices[0].Delta.GetContentString(),
		"stream event per part": streamed.String(),
	}
}

func TestGeminiToChatJoinsTextPartsVerbatim(t *testing.T) {
	for _, tt := range []struct {
		name  string
		texts []string
		want  string
		json  bool
	}{
		{name: "split word", texts: []string{"hel", "lo"}, want: "hello"},
		{name: "empty part", texts: []string{"a", "", "b"}, want: "ab"},
		{name: "newline only", texts: []string{"\n"}, want: "\n"},
		{name: "newline part", texts: []string{"a", "\n", "b"}, want: "a\nb"},
		{name: "trailing newline", texts: []string{"a\n", "b"}, want: "a\nb"},
		{name: "consecutive newline parts", texts: []string{"a", "\n", "\n", "b"}, want: "a\n\nb"},
		{name: "crlf part", texts: []string{"a", "\r\n", "b"}, want: "a\r\nb"},
		{name: "spaces backslashes and unicode", texts: []string{"  路径 C:\\", "temp\\n ", "😀\t"}, want: "  路径 C:\\temp\\n 😀\t"},
		{name: "json split in key", texts: []string{`{"reply`, `":"你好","reactions":[]}`}, want: `{"reply":"你好","reactions":[]}`, json: true},
		{name: "json split in chinese value", texts: []string{`{"reply":"你`, `好","reactions":[]}`}, want: `{"reply":"你好","reactions":[]}`, json: true},
		{name: "json split in number", texts: []string{`{"count":12`, `345}`}, want: `{"count":12345}`, json: true},
		{name: "json split in escape", texts: []string{`{"quote":"say \`, `"hi\"\u4f`, `60"}`}, want: `{"quote":"say \"hi\"\u4f60"}`, json: true},
		{name: "json split at whitespace boundary", texts: []string{`{"a":1,`, `"b":[1,2]}`}, want: `{"a":1,"b":[1,2]}`, json: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			for form, got := range renderGeminiTextParts(t, tt.texts) {
				assert.Equal(t, tt.want, got, form)
				if tt.json {
					assert.True(t, kitutil.Valid([]byte(got)), form)
				}
			}
		})
	}
}

func TestGeminiToChatRestoresJSONSplitAtEveryCharacterBoundary(t *testing.T) {
	const original = `{"reply":"你好，\"世界\"\n","reactions":[],"count":-12.5e3}`
	require.True(t, kitutil.Valid([]byte(original)))
	for offset := range original {
		if offset == 0 {
			continue
		}
		for form, got := range renderGeminiTextParts(t, []string{original[:offset], original[offset:]}) {
			assert.Equal(t, original, got, "split at byte %d, %s", offset, form)
		}
	}
}

func TestGeminiToChatSeparatesOnlyStructuredBlocks(t *testing.T) {
	image := dto.GeminiPart{InlineData: &dto.GeminiInlineData{MimeType: "image/png", Data: "iVBO"}}
	code := dto.GeminiPart{ExecutableCode: &dto.GeminiPartExecutableCode{Language: "python", Code: "print(1)"}}
	output := dto.GeminiPart{CodeExecutionResult: &dto.GeminiPartCodeExecutionResult{Outcome: "OUTCOME_OK", Output: "1"}}
	call := dto.GeminiPart{FunctionCall: &dto.FunctionCall{ID: "call_weather", FunctionName: "get_weather", Arguments: map[string]any{"city": "Paris"}}}
	for _, tt := range []struct {
		name       string
		parts      []dto.GeminiPart
		want       string
		wantStream string
		toolCalls  int
	}{
		{
			name:       "text around image",
			parts:      []dto.GeminiPart{{Text: "See"}, {Text: " this:"}, image, {Text: "Done"}, {Text: "."}},
			want:       "See this:\n![image](data:image/png;base64,iVBO)\nDone.",
			wantStream: "See this:\n![image](data:image/png;base64,iVBO)\nDone.",
		},
		{
			name:       "empty text beside image",
			parts:      []dto.GeminiPart{{Text: ""}, image, {Text: ""}, {Text: "ok"}},
			want:       "![image](data:image/png;base64,iVBO)\nok",
			wantStream: "![image](data:image/png;base64,iVBO)\nok",
		},
		{
			name:       "code execution",
			parts:      []dto.GeminiPart{{Text: "Run"}, {Text: "ning:"}, code, output, {Text: "Result"}, {Text: " is 1."}},
			want:       "Running:\n```python\nprint(1)\n```\n```output\n1\n```\nResult is 1.",
			wantStream: "Running:\n```python\nprint(1)\n```\n\n```output\n1\n```\n\nResult is 1.",
		},
		{
			name:       "text around tool call",
			parts:      []dto.GeminiPart{{Text: "Checking"}, call, {Text: " weather."}},
			want:       "Checking weather.",
			wantStream: "Checking weather.",
			toolCalls:  1,
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			response := ResponseGeminiChat2OpenAI("chatcmpl-test", 1, &dto.GeminiChatResponse{Candidates: []dto.GeminiChatCandidate{{
				Content:      dto.GeminiChatContent{Role: "model", Parts: tt.parts},
				FinishReason: kitutil.GetPointer("STOP"),
			}}})
			require.Len(t, response.Choices, 1)
			choice := response.Choices[0]
			assert.Equal(t, tt.want, choice.Message.StringContent())
			assert.Len(t, choice.Message.ParseToolCalls(), tt.toolCalls)
			wantFinish := types.FinishReasonStop
			if tt.toolCalls > 0 {
				wantFinish = types.FinishReasonToolCalls
			}
			assert.Equal(t, wantFinish, choice.FinishReason)

			event, _ := StreamResponseGeminiChat2OpenAI(&dto.GeminiChatResponse{Candidates: []dto.GeminiChatCandidate{{
				Content: dto.GeminiChatContent{Role: "model", Parts: tt.parts},
			}}})
			require.Len(t, event.Choices, 1)
			assert.Equal(t, tt.wantStream, event.Choices[0].Delta.GetContentString())
			assert.Len(t, event.Choices[0].Delta.ToolCalls, tt.toolCalls)
		})
	}
}

type groundingCitation struct {
	start int
	end   int
	text  string
}

func citedText(t *testing.T, content string, annotations []byte) []groundingCitation {
	t.Helper()
	if len(annotations) == 0 {
		return nil
	}
	var decoded []struct {
		URLCitation struct {
			StartIndex int `json:"start_index"`
			EndIndex   int `json:"end_index"`
		} `json:"url_citation"`
	}
	require.NoError(t, kitutil.Unmarshal(annotations, &decoded))
	runes := []rune(content)
	citations := make([]groundingCitation, 0, len(decoded))
	for _, annotation := range decoded {
		start, end := annotation.URLCitation.StartIndex, annotation.URLCitation.EndIndex
		require.True(t, start >= 0 && start < end && end <= len(runes), "citation [%d,%d) outside %q", start, end, content)
		citations = append(citations, groundingCitation{start: start, end: end, text: string(runes[start:end])})
	}
	return citations
}

func geminiGroundingMetadata(supports string) *dto.GeminiGroundingMetadata {
	return &dto.GeminiGroundingMetadata{
		GroundingChunks:   []byte(`[{"web":{"uri":"https://example.com/source","title":"Source"}}]`),
		GroundingSupports: []byte(supports),
	}
}

func TestGeminiToChatGroundingMatchesVerbatimText(t *testing.T) {
	image := dto.GeminiPart{InlineData: &dto.GeminiInlineData{MimeType: "image/png", Data: "iVBO"}}
	code := dto.GeminiPart{ExecutableCode: &dto.GeminiPartExecutableCode{Language: "python", Code: "print(1)"}}
	for _, tt := range []struct {
		name       string
		parts      []dto.GeminiPart
		supports   string
		want       []groundingCitation
		wantStream []groundingCitation
	}{
		{
			name:     "chinese parts",
			parts:    []dto.GeminiPart{{Text: "你好"}, {Text: "世界"}},
			supports: `[{"segment":{"partIndex":1,"startIndex":0,"endIndex":6,"text":"世界"},"groundingChunkIndices":[0]}]`,
			want:     []groundingCitation{{start: 2, end: 4, text: "世界"}},
		},
		{
			name:  "repeated text",
			parts: []dto.GeminiPart{{Text: "ab"}, {Text: "ab"}},
			supports: `[{"segment":{"partIndex":0,"startIndex":0,"endIndex":2,"text":"ab"},"groundingChunkIndices":[0]},` +
				`{"segment":{"partIndex":1,"startIndex":0,"endIndex":2,"text":"ab"},"groundingChunkIndices":[0]}]`,
			want: []groundingCitation{{start: 0, end: 2, text: "ab"}, {start: 2, end: 4, text: "ab"}},
		},
		{
			name:  "standalone newline",
			parts: []dto.GeminiPart{{Text: "今天"}, {Text: "\n"}, {Text: "晴"}},
			supports: `[{"segment":{"partIndex":1,"startIndex":0,"endIndex":1,"text":"\n"},"groundingChunkIndices":[0]},` +
				`{"segment":{"partIndex":2,"startIndex":0,"endIndex":3,"text":"晴"},"groundingChunkIndices":[0]}]`,
			want: []groundingCitation{{start: 2, end: 3, text: "\n"}, {start: 3, end: 4, text: "晴"}},
		},
		{
			name:  "standalone newline after image",
			parts: []dto.GeminiPart{image, {Text: "\n"}, {Text: "b"}},
			supports: `[{"segment":{"partIndex":1,"startIndex":0,"endIndex":1,"text":"\n"},"groundingChunkIndices":[0]},` +
				`{"segment":{"partIndex":2,"startIndex":0,"endIndex":1,"text":"b"},"groundingChunkIndices":[0]}]`,
			want: []groundingCitation{{start: 37, end: 38, text: "\n"}, {start: 38, end: 39, text: "b"}},
		},
		{
			name:       "text also inside code block",
			parts:      []dto.GeminiPart{code, {Text: "1"}},
			supports:   `[{"segment":{"partIndex":1,"startIndex":0,"endIndex":1,"text":"1"},"groundingChunkIndices":[0]}]`,
			want:       []groundingCitation{{start: 23, end: 24, text: "1"}},
			wantStream: []groundingCitation{{start: 24, end: 25, text: "1"}},
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			wantStream := tt.wantStream
			if wantStream == nil {
				wantStream = tt.want
			}
			candidate := dto.GeminiChatCandidate{
				Content:           dto.GeminiChatContent{Role: "model", Parts: tt.parts},
				GroundingMetadata: geminiGroundingMetadata(tt.supports),
			}

			response := ResponseGeminiChat2OpenAI("chatcmpl-test", 1, &dto.GeminiChatResponse{Candidates: []dto.GeminiChatCandidate{candidate}})
			require.Len(t, response.Choices, 1)
			message := response.Choices[0].Message
			assert.Equal(t, tt.want, citedText(t, message.StringContent(), message.Annotations), "non-stream")

			event, _ := StreamResponseGeminiChat2OpenAI(&dto.GeminiChatResponse{Candidates: []dto.GeminiChatCandidate{candidate}})
			require.Len(t, event.Choices, 1)
			delta := event.Choices[0].Delta
			assert.Equal(t, wantStream, citedText(t, delta.GetContentString(), delta.Annotations), "one stream event")

			state := NewGeminiToChatStreamState("chatcmpl-test", 1)
			chunks, err := state.ConvertChunk(&dto.GeminiChatResponse{Candidates: []dto.GeminiChatCandidate{candidate}}, "gemini-test", nil)
			require.NoError(t, err)
			require.NotEmpty(t, chunks)
			delta = chunks[0].Choices[0].Delta
			assert.Equal(t, wantStream, citedText(t, delta.GetContentString(), delta.Annotations), "stateful stream")
		})
	}
}

func TestGeminiToChatKeepsCandidateTextIndependent(t *testing.T) {
	candidates := []dto.GeminiChatCandidate{
		{Index: 0, Content: dto.GeminiChatContent{Role: "model", Parts: []dto.GeminiPart{{Text: `{"a`}, {Text: `":1}`}}}},
		{Index: 1, Content: dto.GeminiChatContent{Role: "model", Parts: []dto.GeminiPart{{Text: "x"}, {Text: "\n"}}}},
	}
	want := map[int]string{0: `{"a":1}`, 1: "x\n"}

	response := ResponseGeminiChat2OpenAI("chatcmpl-test", 1, &dto.GeminiChatResponse{Candidates: candidates})
	require.Len(t, response.Choices, 2)
	for _, choice := range response.Choices {
		assert.Equal(t, want[choice.Index], choice.Message.StringContent())
	}

	event, _ := StreamResponseGeminiChat2OpenAI(&dto.GeminiChatResponse{Candidates: candidates})
	require.Len(t, event.Choices, 2)
	for _, choice := range event.Choices {
		assert.Equal(t, want[choice.Index], choice.Delta.GetContentString())
	}
}

func TestGeminiToChatStreamGroundingArrivingLaterMatchesVerbatimText(t *testing.T) {
	state := NewGeminiToChatStreamState("chatcmpl-test", 1)
	var content strings.Builder
	var citations []groundingCitation
	for _, event := range []dto.GeminiChatCandidate{
		{Content: dto.GeminiChatContent{Role: "model", Parts: []dto.GeminiPart{{Text: "今天"}}}},
		{Content: dto.GeminiChatContent{Role: "model", Parts: []dto.GeminiPart{{Text: "\n"}}}},
		{Content: dto.GeminiChatContent{Role: "model", Parts: []dto.GeminiPart{{Text: "天气"}, {Text: "晴"}}}},
		{
			Content:      dto.GeminiChatContent{Role: "model"},
			FinishReason: kitutil.GetPointer("STOP"),
			GroundingMetadata: geminiGroundingMetadata(`[` +
				`{"segment":{"partIndex":0,"startIndex":0,"endIndex":7,"text":"今天\n"},"groundingChunkIndices":[0]},` +
				`{"segment":{"partIndex":0,"startIndex":0,"endIndex":13,"text":"今天\n天气"},"groundingChunkIndices":[0]},` +
				`{"segment":{"partIndex":1,"startIndex":0,"endIndex":3,"text":"晴"},"groundingChunkIndices":[0]}]`),
		},
	} {
		chunks, err := state.ConvertChunk(&dto.GeminiChatResponse{Candidates: []dto.GeminiChatCandidate{event}}, "gemini-test", nil)
		require.NoError(t, err)
		for _, chunk := range chunks {
			for _, choice := range chunk.Choices {
				content.WriteString(choice.Delta.GetContentString())
				if len(choice.Delta.Annotations) > 0 {
					citations = append(citations, citedText(t, content.String(), choice.Delta.Annotations)...)
				}
			}
		}
	}

	assert.Equal(t, "今天\n天气晴", content.String())
	assert.Equal(t, []groundingCitation{
		{start: 0, end: 3, text: "今天\n"},
		{start: 0, end: 5, text: "今天\n天气"},
		{start: 5, end: 6, text: "晴"},
	}, citations)
}
