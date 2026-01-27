package constant

type TaskPlatform string

const (
	TaskPlatformSuno       TaskPlatform = "suno"
	TaskPlatformMidjourney              = "mj"
)

const (
	SunoActionMusic  = "MUSIC"
	SunoActionLyrics = "LYRICS"

	TaskActionGenerate          = "generate"
	TaskActionTextGenerate      = "textGenerate"
	TaskActionFirstTailGenerate = "firstTailGenerate"
	TaskActionReferenceGenerate = "referenceGenerate"
	TaskActionRemix             = "remixGenerate"
	TaskActionText2Audio        = "text2audio"
	TaskActionAudioTTS          = "audioTTS"
	TaskActionExtend            = "extend"
	TaskActionUpscale           = "upscale"
	TaskActionAdOneClick        = "adOneClick"
	TaskActionTrendingReplicate = "trendingReplicate"
	TaskActionMV                = "mv"
	TaskActionMultiFrame        = "multiframe"
	TaskActionReplace           = "replace"
)

var SunoModel2Action = map[string]string{
	"suno_music":  SunoActionMusic,
	"suno_lyrics": SunoActionLyrics,
}
