package aws

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/color"
	"image/jpeg"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestDoAwsClientRequest_AppliesRuntimeHeaderOverrideToAnthropicBeta(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)

	info := &relaycommon.RelayInfo{
		OriginModelName:           "claude-3-5-sonnet-20240620",
		IsStream:                  false,
		UseRuntimeHeadersOverride: true,
		RuntimeHeadersOverride: map[string]any{
			"anthropic-beta": "computer-use-2025-01-24",
		},
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey:            "access-key|secret-key|us-east-1",
			UpstreamModelName: "claude-3-5-sonnet-20240620",
		},
	}

	requestBody := bytes.NewBufferString(`{"messages":[{"role":"user","content":"hello"}],"max_tokens":128}`)
	adaptor := &Adaptor{}

	_, err := doAwsClientRequest(ctx, info, adaptor, requestBody)
	require.NoError(t, err)

	awsReq, ok := adaptor.AwsReq.(*bedrockruntime.InvokeModelInput)
	require.True(t, ok)

	var payload map[string]any
	require.NoError(t, common.Unmarshal(awsReq.Body, &payload))

	anthropicBeta, exists := payload["anthropic_beta"]
	require.True(t, exists)

	values, ok := anthropicBeta.([]any)
	require.True(t, ok)
	require.Equal(t, []any{"computer-use-2025-01-24"}, values)
}

// makeBigJPEG 生成一张 w×h 像素、质量 q 的 JPEG 图片字节。
func makeBigJPEG(t *testing.T, w, h, q int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{R: uint8(x), G: uint8(y), B: 128, A: 255})
		}
	}
	var buf bytes.Buffer
	require.NoError(t, jpeg.Encode(&buf, img, &jpeg.Options{Quality: q}))
	return buf.Bytes()
}

// TestConvertClaudeRequest_CompressesOversizedURLImage 验证 AWS 适配器
// ConvertClaudeRequest 对超限 URL 图片执行压缩，输出 base64 且字节不超过 AWS 默认阈值。
// 注意：本测试不可并行（需修改包级 FetchSetting）。
func TestConvertClaudeRequest_CompressesOversizedURLImage(t *testing.T) {
	// 暂时关闭 SSRF 防护，允许 httptest.Server（loopback）地址。
	fs := system_setting.GetFetchSetting()
	origSSRF := fs.EnableSSRFProtection
	origPriv := fs.AllowPrivateIp
	fs.EnableSSRFProtection = false
	fs.AllowPrivateIp = true
	t.Cleanup(func() {
		fs.EnableSSRFProtection = origSSRF
		fs.AllowPrivateIp = origPriv
	})

	// 确保 HTTP client 已初始化（测试环境中无 main 函数调用 InitHttpClient）。
	service.InitHttpClient()

	// 设置文件下载大小上限（生产环境由 common.Init() 从环境变量读取，测试中手动设置）。
	if constant.MaxFileDownloadMB == 0 {
		constant.MaxFileDownloadMB = 64
	}

	// 构造超出 AWS 默认 MaxBytes（3.75 MB）的大尺寸 JPEG。
	body := makeBigJPEG(t, 3000, 3000, 92)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/jpeg")
		_, _ = w.Write(body)
	}))
	defer srv.Close()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeAws,
		},
	}

	// 构造含 1 个 text block + 1 个 url image block 的 Claude 请求。
	textBlock := dto.ClaudeMediaMessage{Type: "text"}
	textBlock.SetText("hello")

	imageBlock := dto.ClaudeMediaMessage{
		Type: "image",
		Source: &dto.ClaudeMessageSource{
			Type: "url",
			Url:  srv.URL + "/image.jpg",
		},
	}

	contentBlocks := []dto.ClaudeMediaMessage{textBlock, imageBlock}
	request := &dto.ClaudeRequest{
		Messages: []dto.ClaudeMessage{{Role: "user"}},
	}
	request.Messages[0].SetContent(contentBlocks)

	a := &Adaptor{}
	converted, err := a.ConvertClaudeRequest(ctx, info, request)
	require.NoError(t, err)

	out := converted.(*dto.ClaudeRequest)
	content, err := out.Messages[0].ParseContent()
	require.NoError(t, err)

	var imgBlock *dto.ClaudeMediaMessage
	for i := range content {
		if content[i].Type == "image" {
			imgBlock = &content[i]
			break
		}
	}
	require.NotNil(t, imgBlock, "输出消息中应存在 image block")
	require.NotNil(t, imgBlock.Source, "image block 应有 Source 字段")
	require.Equal(t, "base64", imgBlock.Source.Type, "压缩后 Source.Type 应为 base64")
	require.True(t, strings.HasPrefix(imgBlock.Source.MediaType, "image/"),
		"Source.MediaType 应以 image/ 开头，实际: %s", imgBlock.Source.MediaType)

	// Source.Data 经压缩后是 string（base64 编码）。
	dataStr, ok := imgBlock.Source.Data.(string)
	require.True(t, ok, "Source.Data 应为 string 类型")

	decoded, err := base64.StdEncoding.DecodeString(dataStr)
	require.NoError(t, err, "Source.Data 应为合法 base64")

	defaultC := setting.DefaultConstraintFor(constant.ChannelTypeAws)
	require.LessOrEqual(t, int64(len(decoded)), defaultC.MaxBytes,
		"压缩后图片字节数 (%d) 应不超过 AWS 默认 MaxBytes (%d)", len(decoded), defaultC.MaxBytes)
}
