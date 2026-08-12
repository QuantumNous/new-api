package service

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func blockRunChannelWithSettings(channelType int, settings string) *model.Channel {
	return &model.Channel{Type: channelType, OtherSettings: settings}
}

func TestBlockRunSolanaEndpointAllowlist(t *testing.T) {
	gin.SetMode(gin.TestMode)
	solana := blockRunChannelWithSettings(constant.ChannelTypeBlockRun, `{"blockrun_payment_chain":"solana"}`)

	tests := []struct {
		method string
		path   string
		want   bool
	}{
		{http.MethodPost, "/v1/chat/completions", true},
		{http.MethodPost, "/v1/messages", true},
		{http.MethodPost, "/v1/responses", true},
		{http.MethodPost, "/v1/responses/compact", false},
		{http.MethodPost, "/v1/embeddings", false},
		{http.MethodPost, "/v1/images/generations", false},
		{http.MethodPost, "/v1/audio/speech", false},
		{http.MethodPost, "/v1/rerank", false},
		{http.MethodPost, "/v1/video/generations", false},
		{http.MethodPost, "/pg/chat/completions", false},
		{http.MethodGet, "/v1/responses", false},
	}

	for _, tc := range tests {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(tc.method, tc.path, nil)
			require.Equal(t, tc.want, ChannelSupportsRequestEndpoint(ctx, solana, "model"))
		})
	}
}

func TestBlockRunSolanaFilterDoesNotAffectBaseOrOtherBlockRunTypes(t *testing.T) {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)

	require.True(t, ChannelSupportsRequestEndpoint(ctx, blockRunChannelWithSettings(constant.ChannelTypeBlockRun, `{}`), "image-model"))
	require.True(t, ChannelSupportsRequestEndpoint(ctx, blockRunChannelWithSettings(constant.ChannelTypeBlockRun, `{"blockrun_payment_chain":"base"}`), "image-model"))
	require.True(t, ChannelSupportsRequestEndpoint(ctx, blockRunChannelWithSettings(constant.ChannelTypeBlockRunVideo, `{"blockrun_payment_chain":"solana"}`), "video-model"))
	require.True(t, ChannelSupportsRequestEndpoint(ctx, blockRunChannelWithSettings(constant.ChannelTypeBlockRunSeedance, `{"blockrun_payment_chain":"solana"}`), "video-model"))
}
