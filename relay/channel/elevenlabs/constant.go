package elevenlabs

// ElevenLabs is a text-to-speech (voice) provider. It is NOT OpenAI-compatible:
// the voice id goes in the URL path, auth is the `xi-api-key` header, and the
// request body is {text, model_id, voice_settings}. Only TTS is supported here.

const (
	ChannelName = "elevenlabs"
	// Default "Rachel" voice — used when the request omits `voice`.
	defaultVoiceID = "21m00Tcm4TlvDq8ikWAM"
	defaultModelID = "eleven_multilingual_v2"
)

// ModelList is the set of ElevenLabs TTS model ids surfaced to the gateway.
// These map to the model_id field of the ElevenLabs TTS request and to the
// price keys in setting/ratio_setting/model_ratio.go.
var ModelList = []string{
	"eleven_multilingual_v2",
	"eleven_turbo_v2_5",
	"eleven_flash_v2_5",
	"eleven_multilingual_v1",
}
