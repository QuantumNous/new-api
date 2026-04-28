package volcadapter

// ChannelName is the display identifier used in model marketplace listings.
var ChannelName = "volc-adapter"

// ModelList contains the default models surfaced by the VolcAdapter channel type.
// Seedream models are synchronous image-generation models served via
// /api/v3/images/generations; Seedance models are async video-task models
// served via /api/v3/contents/generations/tasks.
var ModelList = []string{
	// Seedream image (full doubao-prefixed IDs)
	"doubao-seedream-5-0-260128",
	"doubao-seedream-5-0-lite-260128",
	"doubao-seedream-4-5-251128",
	"doubao-seedream-4-0-250828",
	"doubao-seedream-3-0-t2i-250415",
	// Seedream image (bare aliases without doubao- prefix)
	"seedream-5-0-260128",
	"seedream-5-0-lite-260128",
	"seedream-4-5-251128",
	"seedream-4-0-250828",
	"seedream-3-0-t2i-250415",
	// Seedance video (full doubao-prefixed IDs)
	"doubao-seedance-2-0-260128",
	"doubao-seedance-2-0-fast-260128",
	"doubao-seedance-1-5-pro-251215",
	"doubao-seedance-1-0-pro-fast-251015",
	"doubao-seedance-1-0-pro-250528",
	"doubao-seedance-1-0-lite-i2v-250428",
	"doubao-seedance-1-0-lite-t2v-250428",
	// Seedance video (bare aliases without doubao- prefix)
	"seedance-2-0-260128",
	"seedance-2-0-fast-260128",
	"seedance-1-5-pro-251215",
	"seedance-1-0-pro-fast-251015",
	"seedance-1-0-pro-250528",
	"seedance-1-0-lite-i2v-250428",
	"seedance-1-0-lite-t2v-250428",
}
