package techmobi

import "strings"

const ChannelName = "techmobi-video"

var ModelList = []string{
	"doubao/doubao-seedance-2-0-260128",
}

type videoGenerationPriceKey struct {
	is1080p  bool
	is4k     bool
	hasVideo bool
}

var videoGenerationPriceTable = map[string]map[videoGenerationPriceKey]float64{
	"doubao/doubao-seedance-2-0-260128": seedance20VideoGenerationPrices,
	"doubao-seedance-2-0-260128":        seedance20VideoGenerationPrices,
}

var seedance20VideoGenerationPrices = map[videoGenerationPriceKey]float64{
	{hasVideo: false}:                46.0,
	{hasVideo: true}:                 28.0,
	{is1080p: true, hasVideo: false}: 51.0,
	{is1080p: true, hasVideo: true}:  31.0,
	{is4k: true, hasVideo: false}:    26.0,
	{is4k: true, hasVideo: true}:     16.0,
}

func GetVideoGenerationRatio(modelName, resolution string, hasVideo bool) (float64, bool) {
	prices, ok := videoGenerationPriceTable[strings.TrimSpace(modelName)]
	if !ok {
		return 0, false
	}
	base := prices[videoGenerationPriceKey{}]
	if base <= 0 {
		return 0, false
	}
	res := strings.ToLower(strings.TrimSpace(resolution))
	price, ok := prices[videoGenerationPriceKey{
		is1080p:  res == "1080p",
		is4k:     res == "4k",
		hasVideo: hasVideo,
	}]
	if !ok {
		price = base
	}
	return price / base, true
}
