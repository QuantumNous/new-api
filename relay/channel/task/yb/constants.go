package yb

const (
	ChannelName  = "yb"
	createPath   = "/video/generations"
	queryPathFmt = "/video/generations/"
)

// ModelList is the suggested client-facing model list for yb (yabaoai).
// Upstream model IDs are passed through as configured on the channel.
var ModelList = []string{
	"doubao-seedance-2-0-mini-260615",
}
