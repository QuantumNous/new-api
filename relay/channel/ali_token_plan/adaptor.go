package ali_token_plan

import (
	"fmt"

	"github.com/QuantumNous/new-api/relay/channel/ali"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
)

type Adaptor struct {
	ali.Adaptor
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if info.RelayFormat == types.RelayFormatClaude {
		return fmt.Sprintf("%s/compatible-mode/v1/chat/completions", info.ChannelBaseUrl), nil
	}

	switch info.RelayMode {
	case constant.RelayModeResponses:
		return fmt.Sprintf("%s/compatible-mode/v1/responses", info.ChannelBaseUrl), nil
	case constant.RelayModeEmbeddings:
		return fmt.Sprintf("%s/compatible-mode/v1/embeddings", info.ChannelBaseUrl), nil
	case constant.RelayModeCompletions:
		return fmt.Sprintf("%s/compatible-mode/v1/completions", info.ChannelBaseUrl), nil
	case constant.RelayModeImagesGenerations:
		return a.Adaptor.GetRequestURL(info)
	case constant.RelayModeImagesEdits:
		return a.Adaptor.GetRequestURL(info)
	case constant.RelayModeRerank:
		return fmt.Sprintf("%s/compatible-mode/v1/rerank", info.ChannelBaseUrl), nil
	default:
		return a.Adaptor.GetRequestURL(info)
	}
}

func (a *Adaptor) GetModelList() []string {
	return ali.ModelList
}

func (a *Adaptor) GetChannelName() string {
	return "ali_token_plan"
}
