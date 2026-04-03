package constant

type TaskPlatform string

const (
	TaskPlatformSuno       TaskPlatform = "suno"
	TaskPlatformMidjourney              = "mj"
)

const (
	SunoActionMusic  = "MUSIC"
	SunoActionLyrics = "LYRICS"

	TaskActionImageGenerate     = "imageGenerate"
	TaskActionImageEdit         = "imageEdit"
	TaskActionGenerate          = "generate"
	TaskActionTextGenerate      = "textGenerate"
	TaskActionFirstTailGenerate = "firstTailGenerate"
	TaskActionReferenceGenerate = "referenceGenerate"
	TaskActionRemix             = "remixGenerate"
)

var SunoModel2Action = map[string]string{
	"suno_music":  SunoActionMusic,
	"suno_lyrics": SunoActionLyrics,
}
