package controller

import (
	"errors"
	"net/url"
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
)

func TestBuildChannelContributionHealthWorkUsesModelRoundRobinOrder(t *testing.T) {
	entries := []channelContributionHealthEntry{
		{
			Channel: &model.Channel{Id: 1},
			Specs: []channelContributionProbeSpec{
				{Model: "a-1", EndpointType: constant.EndpointTypeOpenAI},
				{Model: "a-2", EndpointType: constant.EndpointTypeOpenAI},
				{Model: "a-3", EndpointType: constant.EndpointTypeOpenAI},
			},
		},
		{
			Channel:  &model.Channel{Id: 2, Group: "channel-group"},
			Revision: &model.ChannelContributionRevision{Group: "revision-group"},
			Specs: []channelContributionProbeSpec{
				{Model: "b-1", EndpointType: constant.EndpointTypeOpenAI},
				{Model: "b-2", EndpointType: constant.EndpointTypeOpenAI},
			},
		},
	}

	work := buildChannelContributionHealthWork(entries)
	models := make([]string, 0, len(work))
	channelIDs := make([]int, 0, len(work))
	groups := make([]string, 0, len(work))
	for _, item := range work {
		models = append(models, item.Spec.Model)
		channelIDs = append(channelIDs, item.Channel.Id)
		groups = append(groups, item.Group)
	}
	assert.Equal(t, []string{"a-1", "b-1", "a-2", "b-2", "a-3"}, models)
	assert.Equal(t, []int{1, 2, 1, 2, 1}, channelIDs)
	assert.Equal(t, []string{"", "revision-group", "", "revision-group", ""}, groups)
}

func TestContributionHealthErrorRedactsSecretsAndPreservesUTF8(t *testing.T) {
	baseURL := "https://upstream.example/v1"
	channel := &model.Channel{
		Key:     "super-secret-key",
		BaseURL: &baseURL,
	}
	result := testResult{localErr: errors.New(
		baseURL + " rejected super-secret-key " + url.QueryEscape(channel.Key) +
			" Authorization: Bearer reflected-token: " + strings.Repeat("错误", 300),
	)}

	message := contributionHealthError(channel, result)

	assert.NotContains(t, message, baseURL)
	assert.NotContains(t, message, channel.Key)
	assert.NotContains(t, message, url.QueryEscape(channel.Key))
	assert.NotContains(t, message, "reflected-token")
	assert.Contains(t, message, "[UPSTREAM]")
	assert.Contains(t, message, "[REDACTED]")
	assert.LessOrEqual(t, len(message), 500)
	assert.True(t, utf8.ValidString(message))
}
