package agione

import (
	"fmt"
	"strings"

	channelconstant "github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
)

type Adaptor struct {
	openai.Adaptor
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	baseURL := info.ChannelBaseUrl
	if baseURL == "" {
		baseURL = channelconstant.ChannelBaseURLs[channelconstant.ChannelTypeAGIone]
	}

	if (info.RelayFormat == types.RelayFormatClaude || info.RelayFormat == types.RelayFormatGemini) &&
		info.RelayMode != relayconstant.RelayModeResponses &&
		info.RelayMode != relayconstant.RelayModeResponsesCompact {
		return fmt.Sprintf("%s/chat/completions", baseURL), nil
	}

	requestPath := info.RequestURLPath
	if requestPath == "" {
		return baseURL, nil
	}
	return fmt.Sprintf("%s%s", baseURL, strings.TrimPrefix(requestPath, "/v1")), nil
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
