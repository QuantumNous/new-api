package dreambrand

import dreambrandchannel "github.com/QuantumNous/new-api/relay/channel/dreambrand"

var VideoModelList = dreambrandchannel.VideoModelList

func ResolveModelName(model string) string {
	return dreambrandchannel.ResolveModelName(model)
}

const (
	ChannelName          = "dreambrand"
	VideoCreatePath      = "/ai/v1/videos/generations"
	VideoQueryPath       = "/ai/v1/videos/generations/%s"
	LegacyVideoQueryPath = "/ai/v1/images/generations/%s"
)
