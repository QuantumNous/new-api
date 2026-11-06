package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	copilot "github.com/QuantumNous/new-api/service/githubcopilot"
)

func FetchCopilotChannelModels(channel *model.Channel) ([]string, error) {
	if channel == nil || channel.Type != constant.ChannelTypeGitHubCopilot {
		return nil, fmt.Errorf("channel type is not GitHub Copilot")
	}
	if channel.ChannelInfo.IsMultiKey {
		return nil, fmt.Errorf("GitHub Copilot channels do not support multi-key mode")
	}
	key, err := copilot.ParseChannelKey(strings.TrimSpace(channel.Key))
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	return copilot.GetModels(ctx, key)
}
