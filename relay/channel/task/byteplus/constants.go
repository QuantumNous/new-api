package byteplus

import "strings"

const ChannelName = "BytePlus"

var ModelList = []string{
	"seedance-2.0",
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
		{hasVideo: false}:                46.0,
		{hasVideo: true}:                 28.0,
		{is1080p: true, hasVideo: false}: 51.0,
		{is1080p: true, hasVideo: true}:  31.0,
		{is4k: true, hasVideo: false}:    26.0,
		{is4k: true, hasVideo: true}:     16.0,
	},
	"seedance-2.0-fast": {
		{hasVideo: false}: 37.0,
		{hasVideo: true}:  22.0,
	},
	"seedance-2.0-mini": {
		{hasVideo: false}: 23.0,
		{hasVideo: true}:  14.0,
	},
}

func getVideoInputRatio(modelName, resolution string, hasVideo bool) (float64, bool) {
	prices, ok := videoPriceTable[strings.TrimSpace(modelName)]
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
