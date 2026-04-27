package volcengine

var ModelList = []string{
	// LLM
	"Doubao-pro-128k",
	"Doubao-pro-32k",
	"Doubao-pro-4k",
	"Doubao-lite-128k",
	"Doubao-lite-32k",
	"Doubao-lite-4k",
	"Doubao-embedding",
	"doubao-seed-1-6-thinking-250715",
	"seed-1-6-thinking-250715",
	// Image generation (Seedream) — synchronous via /api/v3/images/generations
	"doubao-seedream-5-0-260128",
	"doubao-seedream-5-0-lite-260128",
	"doubao-seedream-4-5-251128",
	"doubao-seedream-4-0-250828",
	"doubao-seedream-3-0-t2i-250415",
	"seedream-5-0-260128",
	"seedream-5-0-lite-260128",
	"seedream-4-5-251128",
	"seedream-4-0-250828",
	"seedream-3-0-t2i-250415",
}

var ChannelName = "volcengine"
