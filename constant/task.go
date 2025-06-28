package constant

type TaskPlatform string

const (
	TaskPlatformSuno       TaskPlatform = "suno"
	TaskPlatformMidjourney              = "mj"
	TaskPlatformKling      TaskPlatform = "kling"

	TaskPlatformCustomPass TaskPlatform = "custompass"
	TaskPlatformJimeng     TaskPlatform = "jimeng"
)

const (
	SunoActionMusic  = "MUSIC"
	SunoActionLyrics = "LYRICS"
)

var SunoModel2Action = map[string]string{
	"suno_music":  SunoActionMusic,
	"suno_lyrics": SunoActionLyrics,
}
