package paratera

const (
	ChannelName = "paratera-video"

	TextToVideoEndpoint  = "/v1/p004/video_generation"
	QueryTaskEndpoint    = "/v1/p004/query/video_generation"
	FileRetrieveEndpoint = "/v1/p004/files/retrieve"
)

var ModelList = []string{
	"MiniMax-T2V-01",
	"MiniMax-T2V-01-Director",
	"MiniMax-Hailuo-02",
	"MiniMax-I2V-01",
	"MiniMax-I2V-01-Live",
	"MiniMax-I2V-01-Director",
}
