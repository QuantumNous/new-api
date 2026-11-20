package minimax

// https://www.minimaxi.com/document/guides/chat-model/V2?id=65e0736ab2845de20908e2dd

var ModelList = []string{
	"abab6.5-chat",
	"abab6.5s-chat",
	"abab6-chat",
	"abab5.5-chat",
	"abab5.5s-chat",
	"MiniMax-M2.7",
	"MiniMax-M2.7-highspeed",
	"speech-2.5-hd-preview",
	"speech-2.5-turbo-preview",
	"speech-02-hd",
	"speech-02-turbo",
	"speech-01-hd",
	"speech-01-turbo",
	"MiniMax-M2.1",
	"MiniMax-M2.1-highspeed",
	"MiniMax-M2",
	"MiniMax-M2.5",
	"MiniMax-M2.5-highspeed",
	"image-01",
	"image-01-live",
	"MiniMax-H3-Image",
	"MiniMax-H3-Image-Highspeed",
}

// MiniMax H3 image limits, from the image generation
// documentation: at most 16 reference images, at most 10 outputs per request,
// and an explicit size between 655,360 and 20,000,000 pixels.
const (
	miniMaxH3MaxReferenceImages = 16
	miniMaxH3MaxN               = 10
	miniMaxH3MinPixels          = 655_360
	miniMaxH3MaxPixels          = 20_000_000
)

// The upstream streams one event per finished image and ends the stream with
// a summary event that carries the usage. The generation endpoint and the
// edit endpoint use the same event shapes with a different prefix.
const (
	miniMaxH3GenerationPartialSucceeded = "image_generation.partial_succeeded"
	miniMaxH3EditPartialSucceeded       = "image_edit.partial_succeeded"
)

var ChannelName = "minimax"
