package dto

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestOpenAIResponsesParseInputIncludesFileDataAndDirectItems(t *testing.T) {
	t.Parallel()
	request := &OpenAIResponsesRequest{Input: json.RawMessage(`[
		{"type":"input_file","filename":"direct.pdf","file_data":"data:application/pdf;base64,JVBERg=="},
		{"role":"user","content":[
			{"type":"input_text","text":"read it"},
			{"type":"input_file","file_name":"nested.pdf","file_url":"https://example.com/nested.pdf"}
		]}
	]`)}

	inputs := request.ParseInput()
	require.Len(t, inputs, 3)
	require.Equal(t, "direct.pdf", inputs[0].Filename)
	require.Equal(t, "data:application/pdf;base64,JVBERg==", inputs[0].FileData)
	require.Equal(t, "read it", inputs[1].Text)
	require.Equal(t, "nested.pdf", inputs[2].Filename)
	require.Equal(t, "https://example.com/nested.pdf", inputs[2].FileUrl)
}

func TestOpenAIResponsesTokenMetaCountsInlineFileData(t *testing.T) {
	t.Parallel()
	request := &OpenAIResponsesRequest{Input: json.RawMessage(`[
		{"role":"user","content":[{"type":"input_file","filename":"doc.pdf","mime_type":"application/pdf","file_data":"JVBERg=="}]}
	]`)}
	meta := request.GetTokenCountMeta()
	require.Len(t, meta.Files, 1)
	require.False(t, meta.Files[0].Source.IsURL())
	require.Equal(t, "JVBERg==", meta.Files[0].Source.GetRawData())
}
