package siftq

const (
	ChannelName    = "siftq-video"
	ModelName      = "MiniMax-H3"
	DefaultBaseURL = "https://siftq.com/api/minimax/"

	createVideoPath = "v2/video_generation"
	queryVideoPath  = "v2/query/video_generation"

	defaultDuration   = 5
	defaultResolution = "768P"
	defaultTextRatio  = "16:9"
	adaptiveRatio     = "adaptive"
	maxRequestBytes   = 64 << 20
)

var ModelList = []string{ModelName}

var validResolutions = map[string]struct{}{
	"768P": {},
	"2K":   {},
}

var validRatios = map[string]struct{}{
	"adaptive": {},
	"21:9":     {},
	"16:9":     {},
	"4:3":      {},
	"1:1":      {},
	"3:4":      {},
	"9:16":     {},
}
