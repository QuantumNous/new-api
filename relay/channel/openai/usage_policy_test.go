package openai

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
)

func TestApplyUsagePostProcessingTrustUpstreamUsageDefaultSkipsUpstreamBody(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeZhipu_v4,
		},
	}
	usage := &dto.Usage{}

	applyUsagePostProcessing(info, usage, []byte(`{"usage":{"prompt_tokens_details":{"cached_tokens":9}}}`))

	assert.Equal(t, 0, usage.PromptTokensDetails.CachedTokens)
}

func TestApplyUsagePostProcessingTrustUpstreamUsageTrueReadsUpstreamBody(t *testing.T) {
	value := true
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeZhipu_v4,
			ChannelOtherSettings: dto.ChannelOtherSettings{
				TrustUpstreamUsage: &value,
			},
		},
	}
	usage := &dto.Usage{}

	applyUsagePostProcessing(info, usage, []byte(`{"usage":{"prompt_tokens_details":{"cached_tokens":9}}}`))

	assert.Equal(t, 9, usage.PromptTokensDetails.CachedTokens)
}
