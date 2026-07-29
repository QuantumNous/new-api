package dreambrand

var ModelList = []string{
	"seedream-5.0-lite",
	"seedream-4.5",
	"seedance-2.0-standard",
	"seedance-2.0-fast",
	"doubao-seedream-5.0-lite",
	"doubao-seedream-4.5",
	"doubao-seedance-2.0",
	"doubao-seedance-2.0-fast",
}

var modelAliases = map[string]string{
	"doubao-seedream-5.0-lite": "seedream-5.0-lite",
	"doubao-seedream-4.5":      "seedream-4.5",
	"doubao-seedance-2.0":      "seedance-2.0-standard",
	"doubao-seedance-2.0-fast": "seedance-2.0-fast",
}

func ResolveModelName(model string) string {
	if upstreamModel, ok := modelAliases[model]; ok {
		return upstreamModel
	}
	return model
}

const (
	ChannelName          = "dreambrand"
	ImageCreatePath      = "/ai/v1/images/generations"
	ImageQueryPath       = "/ai/v1/images/generations/%s"
	VideoCreatePath      = "/ai/v1/videos/generations"
	VideoQueryPath       = "/ai/v1/videos/generations/%s"
	LegacyVideoQueryPath = "/ai/v1/images/generations/%s"
)
