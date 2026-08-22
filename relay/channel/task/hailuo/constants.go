package hailuo

const (
	ChannelName = "hailuo-video"
)

var ModelList = []string{
	"MiniMax-H3",
	"MiniMax-Hailuo-2.3",
	"MiniMax-Hailuo-2.3-Fast",
	"MiniMax-Hailuo-02",
	"T2V-01-Director",
	"T2V-01",
	"I2V-01-Director",
	"I2V-01-live",
	"I2V-01",
	"S2V-01",
}

const (
	TextToVideoEndpoint = "/v1/video_generation"
	QueryTaskEndpoint   = "/v1/query/video_generation"
)

const (
	// VideoGenerationV2Endpoint 是 MiniMax H3 V2 视频生成创建接口。
	VideoGenerationV2Endpoint = "/v2/video_generation"
	// QueryTaskV2Endpoint 是 MiniMax H3 V2 视频生成查询接口（task_id 走 path 参数）。
	QueryTaskV2Endpoint = "/v2/query/video_generation"
)

const (
	V2Resolution2K = "2K"

	V2MinDurationSeconds = 4
	V2MaxDurationSeconds = 15
	V2DefaultDuration    = 5

	// V2DefaultRatio 仅文本输入的文生视频场景下 ratio 必填且不能为 adaptive。
	V2DefaultRatio = "16:9"

	// V2ResolutionRatio2K 官方定价：2K 0.80 元/秒，768P 0.50 元/秒。
	V2ResolutionRatio2K = 1.6

	// V2MaxFrameImages 图生视频（首帧/首尾帧）最多 2 张图片。
	V2MaxFrameImages = 2
	// V2MaxReferenceImages / V2MaxReferenceVideos / V2MaxReferenceAudios 是多模态参考场景的输入数量上限。
	V2MaxReferenceImages = 9
	V2MaxReferenceVideos = 3
	V2MaxReferenceAudios = 3
)

const (
	V2StatusQueued    = "queued"
	V2StatusRunning   = "running"
	V2StatusSucceeded = "succeeded"
	V2StatusFailed    = "failed"
	V2StatusCancelled = "cancelled"
)

var V2AllowedRatios = []string{"adaptive", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"}

const (
	StatusSuccess    = 0
	StatusRateLimit  = 1002
	StatusAuthFailed = 1004
	StatusNoBalance  = 1008
	StatusSensitive  = 1026
	StatusParamError = 2013
	StatusInvalidKey = 2049
)

const (
	TaskStatusPreparing  = "Preparing"
	TaskStatusQueueing   = "Queueing"
	TaskStatusProcessing = "Processing"
	TaskStatusSuccess    = "Success"
	TaskStatusFailed     = "Fail"
)

const (
	Resolution512P  = "512P"
	Resolution720P  = "720P"
	Resolution768P  = "768P"
	Resolution1080P = "1080P"
)

const (
	DefaultDuration   = 6
	DefaultResolution = Resolution720P
)
