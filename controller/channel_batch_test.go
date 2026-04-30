package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestBuildBatchAddChannelsAppendsAwsRegionSuffixAndModelMappingOverrides(t *testing.T) {
	baseMapping := `{"claude-sonnet-4.5":"base-model"}`
	request := AddChannelRequest{
		BatchAddAwsRegionSuffix2Name: true,
		BatchModelMappingsByKey: map[string]string{
			"AK11111111333|SK11111111333|us-east-1": `{"claude-sonnet-4.5":"arn:aws:bedrock:us-east-1::foundation-model/model-a"}`,
			"AK11111111333|SK11111111333|us-east-2": `{"claude-sonnet-4.5":"arn:aws:bedrock:us-east-2::foundation-model/model-b"}`,
		},
		Channel: &model.Channel{
			Type:         constant.ChannelTypeAws,
			Name:         "AWS1",
			ModelMapping: common.GetPointer(baseMapping),
		},
	}
	keys := []string{
		"AK11111111333|SK11111111333|us-east-1",
		"AK11111111333|SK11111111333|us-east-2",
	}

	channels := buildBatchAddChannels(request, keys)

	require.Len(t, channels, 2)
	require.Equal(t, "AWS1-us-east-1", channels[0].Name)
	require.Equal(t, "AWS1-us-east-2", channels[1].Name)
	require.NotNil(t, channels[0].ModelMapping)
	require.NotNil(t, channels[1].ModelMapping)
	require.Equal(t, `{"claude-sonnet-4.5":"arn:aws:bedrock:us-east-1::foundation-model/model-a"}`, *channels[0].ModelMapping)
	require.Equal(t, `{"claude-sonnet-4.5":"arn:aws:bedrock:us-east-2::foundation-model/model-b"}`, *channels[1].ModelMapping)
}

func TestGetAwsBatchKeyRegionSupportsApiKeyMode(t *testing.T) {
	region := getAwsBatchKeyRegion("API_KEY_VALUE|eu-west-1", "api_key")
	require.Equal(t, "eu-west-1", region)
}

func TestApplyDefaultBatchChannelTagUsesChannelNameWhenEmpty(t *testing.T) {
	request := &AddChannelRequest{
		Mode: "batch",
		Channel: &model.Channel{
			Name: "AWS1",
		},
	}

	applyDefaultBatchChannelTag(request)

	require.NotNil(t, request.Channel.Tag)
	require.Equal(t, "AWS1", *request.Channel.Tag)
}

func TestApplyDefaultBatchChannelTagPreservesManualTag(t *testing.T) {
	request := &AddChannelRequest{
		Mode: "batch",
		Channel: &model.Channel{
			Name: "AWS1",
			Tag:  common.GetPointer("manual-tag"),
		},
	}

	applyDefaultBatchChannelTag(request)

	require.NotNil(t, request.Channel.Tag)
	require.Equal(t, "manual-tag", *request.Channel.Tag)
}
