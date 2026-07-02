package openai

import (
	"bytes"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func boolPtr(v bool) *bool { return &v }

// 当客户端显式传了 parallel_tool_calls 但未指定 tools 时，必须剔除该字段，
// 否则上游会报 "'parallel_tool_calls' is only allowed when 'tools' are specified"。
func TestConvertOpenAIRequest_DropParallelToolCallsWhenNoTools(t *testing.T) {
	gin.SetMode(gin.TestMode)

	cases := []struct {
		name  string
		tools []dto.ToolCallRequest
		input *bool
		want  *bool // 期望转发给上游的 parallel_tool_calls
	}{
		{
			name:  "empty tools slice drops parallel_tool_calls(false)",
			tools: []dto.ToolCallRequest{},
			input: boolPtr(false),
			want:  nil,
		},
		{
			name:  "nil tools drops parallel_tool_calls(true)",
			tools: nil,
			input: boolPtr(true),
			want:  nil,
		},
		{
			name:  "with tools keeps parallel_tool_calls(false)",
			tools: []dto.ToolCallRequest{{Type: "function"}},
			input: boolPtr(false),
			want:  boolPtr(false),
		},
		{
			name:  "no tools and nil parallel_tool_calls stays nil",
			tools: nil,
			input: nil,
			want:  nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(nil)
			info := &relaycommon.RelayInfo{
				OriginModelName: "gpt-4o",
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelType:       constant.ChannelTypeOpenAI,
					UpstreamModelName: "gpt-4o",
				},
			}
			request := &dto.GeneralOpenAIRequest{
				Model:            "gpt-4o",
				Tools:            tc.tools,
				ParallelTooCalls: tc.input,
			}

			out, err := (&Adaptor{}).ConvertOpenAIRequest(c, info, request)
			require.NoError(t, err)

			converted, ok := out.(*dto.GeneralOpenAIRequest)
			require.True(t, ok, "converted request type")

			if tc.want == nil {
				require.Nil(t, converted.ParallelTooCalls)
			} else {
				require.NotNil(t, converted.ParallelTooCalls)
				require.Equal(t, *tc.want, *converted.ParallelTooCalls)
			}
		})
	}
}

func TestConvertImageRequest_JimengZhizinanPreservesSupportedExtras(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var request dto.ImageRequest
	err := common.Unmarshal([]byte(`{
		"model":"jimeng-image-5.0-lite",
		"prompt":"a white cat",
		"negative_prompt":"blur",
		"ratio":"1:1",
		"resolution":"2k",
		"sample_strength":0.75,
		"response_format":"url",
		"filePath":"https://cdn.example.com/ref.png",
		"stream":true,
		"partial_images":2,
		"unsupported":"drop-me"
	}`), &request)
	require.NoError(t, err)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesGenerations,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeJimengZhizinan,
		},
	}

	out, err := (&Adaptor{}).ConvertImageRequest(c, info, request)
	require.NoError(t, err)

	encoded, err := common.Marshal(out)
	require.NoError(t, err)

	var body map[string]any
	require.NoError(t, common.Unmarshal(encoded, &body))
	require.Equal(t, "jimeng-image-5.0-lite", body["model"])
	require.Equal(t, "a white cat", body["prompt"])
	require.Equal(t, "blur", body["negative_prompt"])
	require.Equal(t, "1:1", body["ratio"])
	require.Equal(t, "2k", body["resolution"])
	require.Equal(t, 0.75, body["sample_strength"])
	require.Equal(t, "url", body["response_format"])
	require.Equal(t, "https://cdn.example.com/ref.png", body["filePath"])
	require.NotContains(t, body, "stream")
	require.NotContains(t, body, "partial_images")
	require.NotContains(t, body, "unsupported")
}

func TestConvertImageRequest_JimengZhizinanJSONEditsPreservesAdapterFields(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var request dto.ImageRequest
	err := common.Unmarshal([]byte(`{
		"model":"jimeng-image-5.0-lite",
		"prompt":"turn it into a product shot",
		"image":"data:image/png;base64,QUJDRA==",
		"size":"1536x1024",
		"negative_prompt":"blur",
		"sample_strength":0.35,
		"response_format":"b64_json",
		"n":1,
		"mask":"data:image/png;base64,TUFTSw==",
		"stream":true,
		"partial_images":2,
		"unsupported":"drop-me"
	}`), &request)
	require.NoError(t, err)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", nil)
	c.Request.Header.Set("Content-Type", "application/json")
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesEdits,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeJimengZhizinan,
		},
	}

	out, err := (&Adaptor{}).ConvertImageRequest(c, info, request)
	require.NoError(t, err)

	encoded, err := common.Marshal(out)
	require.NoError(t, err)

	var body map[string]any
	require.NoError(t, common.Unmarshal(encoded, &body))
	require.Equal(t, "jimeng-image-5.0-lite", body["model"])
	require.Equal(t, "turn it into a product shot", body["prompt"])
	require.Equal(t, "data:image/png;base64,QUJDRA==", body["image"])
	require.Equal(t, "1536x1024", body["size"])
	require.Equal(t, "blur", body["negative_prompt"])
	require.Equal(t, 0.35, body["sample_strength"])
	require.Equal(t, "b64_json", body["response_format"])
	require.Equal(t, float64(1), body["n"])
	require.NotContains(t, body, "mask")
	require.NotContains(t, body, "stream")
	require.NotContains(t, body, "partial_images")
	require.NotContains(t, body, "unsupported")
}

func TestConvertImageRequest_JimengZhizinanMultipartEditsDropsUnsupportedMask(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var requestBody bytes.Buffer
	writer := multipart.NewWriter(&requestBody)
	require.NoError(t, writer.WriteField("model", "jimeng-image-5.0-lite"))
	require.NoError(t, writer.WriteField("prompt", "turn it into a product shot"))
	require.NoError(t, writer.WriteField("negative_prompt", "blur"))
	require.NoError(t, writer.WriteField("sample_strength", "0.35"))
	require.NoError(t, writer.WriteField("size", "1536x1024"))
	require.NoError(t, writer.WriteField("response_format", "url"))
	require.NoError(t, writer.WriteField("mask", "data:image/png;base64,TUFTSw=="))
	imagePart, err := writer.CreateFormFile("image", "source.png")
	require.NoError(t, err)
	_, err = imagePart.Write([]byte("image-bytes"))
	require.NoError(t, err)
	maskPart, err := writer.CreateFormFile("mask", "mask.png")
	require.NoError(t, err)
	_, err = maskPart.Write([]byte("mask-bytes"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", &requestBody)
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesEdits,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeJimengZhizinan,
		},
	}
	request := dto.ImageRequest{
		Model:  "jimeng-image-5.0-lite",
		Prompt: "turn it into a product shot",
	}

	out, err := (&Adaptor{}).ConvertImageRequest(c, info, request)
	require.NoError(t, err)
	outReader, ok := out.(io.Reader)
	require.True(t, ok)
	outBody, err := io.ReadAll(outReader)
	require.NoError(t, err)

	mediaType, params, err := mime.ParseMediaType(c.Request.Header.Get("Content-Type"))
	require.NoError(t, err)
	require.Equal(t, "multipart/form-data", mediaType)
	form, err := multipart.NewReader(bytes.NewReader(outBody), params["boundary"]).ReadForm(int64(len(outBody)))
	require.NoError(t, err)

	require.Equal(t, []string{"jimeng-image-5.0-lite"}, form.Value["model"])
	require.Equal(t, []string{"turn it into a product shot"}, form.Value["prompt"])
	require.Equal(t, []string{"blur"}, form.Value["negative_prompt"])
	require.Equal(t, []string{"0.35"}, form.Value["sample_strength"])
	require.Equal(t, []string{"1536x1024"}, form.Value["size"])
	require.Equal(t, []string{"url"}, form.Value["response_format"])
	require.Len(t, form.File["image"], 1)
	require.NotContains(t, form.Value, "mask")
	require.NotContains(t, form.File, "mask")
}
