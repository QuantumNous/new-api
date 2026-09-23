package service

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// Regression for #7540: streaming token count must not re-download a URL whose
// FileType is already known (e.g. image_url → FileTypeImage). Non-OpenAI models
// use a fixed 520-token estimate; forcing a fetch against a private/intranet URL
// triggers SSRF rejection and count_token_failed even though the bytes are unused.
func TestCountRequestTokenSkipsFetchForKnownImageURLOnStream(t *testing.T) {
	gin.SetMode(gin.TestMode)

	prevGetMedia := constant.GetMediaToken
	prevNotStream := constant.GetMediaTokenNotStream
	t.Cleanup(func() {
		constant.GetMediaToken = prevGetMedia
		constant.GetMediaTokenNotStream = prevNotStream
	})
	constant.GetMediaToken = true
	constant.GetMediaTokenNotStream = false

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(c, constant.ContextKeyOriginalModel, "qwen3.5-122b-a10b-fp8")

	meta := &types.TokenCountMeta{
		TokenType:     types.TokenTypeTokenizer,
		CombineText:   "这是什么？",
		MessagesCount: 1,
		Files: []*types.FileMeta{
			types.NewImageFileMeta(
				types.NewURLFileSource("http://10.0.0.1/internal-test.png"),
				"",
			),
		},
	}
	info := &relaycommon.RelayInfo{
		IsStream:    true,
		RelayFormat: types.RelayFormatOpenAI,
	}

	tokens, err := CountRequestToken(c, meta, info)
	require.NoError(t, err, "known image URL must not be fetched during stream token count")
	// 1 message framing (3) + format overhead (3) + fixed non-OpenAI image (520) + text tokens
	require.GreaterOrEqual(t, tokens, 520)
}
