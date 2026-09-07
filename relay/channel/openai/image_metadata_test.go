package openai

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/png"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestImageJSONAddsConsistentMetadata(t *testing.T) {
	var buffer bytes.Buffer
	require.NoError(t, png.Encode(&buffer, image.NewNRGBA(image.Rect(0, 0, 2, 3))))
	encoded := base64.StdEncoding.EncodeToString(buffer.Bytes())
	body, err := common.Marshal(map[string]any{"created": 123, "data": []any{map[string]any{"b64_json": encoded, "custom": "preserved"}}, "usage": map[string]int{"input_tokens": 7, "output_tokens": 3}})
	require.NoError(t, err)
	c, recorder, response, info := newImageTestContext(t, string(body), "application/json", false)
	response.Header.Set("ETag", "upstream-body-hash")
	response.Header.Set("Content-Length", strconv.Itoa(len(body)))
	usage, apiErr := OpenaiImageHandler(c, info, response)
	require.Nil(t, apiErr)
	result := recorder.Body.String()
	assert.Empty(t, recorder.Header().Get("ETag"))
	assert.Equal(t, strconv.Itoa(len(recorder.Body.Bytes())), recorder.Header().Get("Content-Length"))
	assert.EqualValues(t, 2, gjson.Get(result, "data.0.width").Int())
	assert.EqualValues(t, 3, gjson.Get(result, "data.0.height").Int())
	assert.Equal(t, "2x3", gjson.Get(result, "data.0.size").String())
	assert.Equal(t, "png", gjson.Get(result, "data.0.output_format").String())
	assert.Equal(t, encoded, gjson.Get(result, "data.0.b64_json").String())
	assert.Equal(t, "preserved", gjson.Get(result, "data.0.custom").String())
	assert.Equal(t, "null", gjson.Get(result, "quality").Raw)
	assert.Equal(t, "null", gjson.Get(result, "background").Raw)
	assert.EqualValues(t, 7, usage.PromptTokens)
	assert.EqualValues(t, 3, usage.CompletionTokens)
}
