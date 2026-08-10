package byteplus

import "strings"

const ChannelName = "BytePlus"

var ModelList = []string{
	"seedance-2.0",
	"seedance2.0-pro",
	"seedance-2.0-fast",
	"seedance-2.0-mini",
}

type videoPriceKey struct {
	is1080p  bool
	is4k     bool
	hasVideo bool
}

var videoPriceTable = map[string]map[videoPriceKey]float64{
	"seedance-2.0": {
		{hasVideo: false}:                70.0,
		{hasVideo: true}:                 43.0,
		{is1080p: true, hasVideo: false}: 77.0,
		{is1080p: true, hasVideo: true}:  47.0,
		{is4k: true, hasVideo: false}:    40.0,
		{is4k: true, hasVideo: true}:     24.0,
	},
	"seedance-2.0-fast": {
		{hasVideo: false}: 56.0,
		{hasVideo: true}:  33.0,
	},
	"seedance-2.0-mini": {
		{hasVideo: false}: 35.0,
		{hasVideo: true}:  21.0,
	},
}

var videoPriceModelAliases = map[string]string{
	"seedance2.0-pro": "seedance-2.0",
	"Seedance2.0-pro": "seedance-2.0",
}

func getVideoInputRatio(modelName, resolution string, hasVideo bool) (float64, bool) {
	modelName = strings.TrimSpace(modelName)
	if canonical, ok := videoPriceModelAliases[modelName]; ok {
		modelName = canonical
	}
	prices, ok := videoPriceTable[modelName]
	if !ok {
		return 0, false
	}
	base := prices[videoPriceKey{}]
	if base <= 0 {
		return 0, false
	}
	res := strings.ToLower(strings.TrimSpace(resolution))
	price, ok := prices[videoPriceKey{is1080p: res == "1080p", is4k: res == "4k", hasVideo: hasVideo}]
	if !ok {
		price, ok = prices[videoPriceKey{hasVideo: hasVideo}]
	}
	if !ok || price <= 0 {
		return 0, false
	}
	return price / base, true
}
