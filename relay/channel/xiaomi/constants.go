package xiaomi

// ModelList lists the models the MiMo platform serves. The MiMo-V2.5 and
// MiMo-V2.5-Pro chat models are left out: they forward to the V2.6 series and
// are retired on 2026-10-21.
var ModelList = []string{
	"mimo-v2.6-flash",
	"mimo-v2.6-pro",
	"mimo-v2.6-pro-ultraspeed",
	"mimo-v2.5-asr",
	"mimo-v2.5-tts",
	"mimo-v2.5-tts-voiceclone",
	"mimo-v2.5-tts-voicedesign",
}

var ChannelName = "xiaomi"
