package zzdh

const (
	ChannelName   = "zz"
	createPath    = "/v8/videos/generations"
	queryPathPref = "/v8/videos/generations/"
	defaultBase   = "https://www.zizidonghua.com"
	defaultFPS    = 24
	defaultDurSec = 5
	minDurSec     = 5
	maxDurSec     = 15
)

// ModelList is the default client-facing logical model list.
// Resolution (default 720p) selects upstream zzdh-Minimax-h3-{480p|720p|1080p|2k}.
var ModelList = []string{
	logicMinimaxH3,
}

var allowedAspectRatios = map[string]struct{}{
	"16:9": {},
	"9:16": {},
	"1:1":  {},
	"4:3":  {},
	"3:4":  {},
	"21:9": {},
}
