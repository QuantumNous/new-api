package dreambrand

import "slices"

var ImageModelList = []string{
	"seedream-5.0-lite",
	"seedream-4.5",
	"doubao-seedream-5.0-lite",
	"doubao-seedream-4.5",
}

var VideoModelList = []string{
	"seedance-2.0-standard",
	"seedance-2.0-fast",
	"doubao-seedance-2.0",
	"doubao-seedance-2.0-fast",
}

var ModelList = append(append([]string{}, ImageModelList...), VideoModelList...)

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

func IsImageModel(model string) bool {
	return slices.Contains(ImageModelList, model)
}

const (
	ChannelName     = "dreambrand"
	ImageCreatePath = "/ai/v1/images/generations"
	ImageQueryPath  = "/ai/v1/images/generations/%s"
)
