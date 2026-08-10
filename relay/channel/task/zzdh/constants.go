package zzdh

const (
	ChannelName   = "ZiZiDongHua"
	createPath    = "/v8/videos/generations"
	queryPathPref = "/v8/videos/generations/"
	defaultBase   = "https://www.zizidonghua.com"
	defaultFPS    = 24
	defaultDurSec = 5
	minDurSec     = 5
	maxDurSec     = 15
)

// ModelList is the default client-facing model list (resolution locked by name).
var ModelList = []string{
	"zzdh-Minimax-h3-480p",
	"zzdh-Minimax-h3-720p",
	"zzdh-Minimax-h3-1080p",
	"zzdh-Minimax-h3-2k",
}

var allowedAspectRatios = map[string]struct{}{
	"16:9": {},
	"9:16": {},
	"1:1":  {},
	"4:3":  {},
	"3:4":  {},
	"21:9": {},
}
