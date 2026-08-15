package volcengine

var ModelList = []string{
	// Doubao Seed 2.0 (current). Ark accepts both the un-dated alias and the
	// dated model ID; the dated form is what the console shows.
	"doubao-seed-2.0-pro",
	"doubao-seed-2-0-pro-260215",
	"doubao-seed-2.0-lite",
	"doubao-seed-2.0-mini",
	// DeepSeek hosted on Ark (same VOLCENGINE_API_KEY as the Doubao models).
	// Ark dispatches dated ids; the undated aliases resolve on the Coding /
	// Agent Plan endpoints.
	"deepseek-v4-pro",
	"deepseek-v4-flash",
	"deepseek-v3-1-250821",
	"deepseek-r1-250120",
	// Seedream / Seedance (image + video generation)
	"doubao-seedance-2-5-260628",
	"doubao-seedream-5.0",
	"doubao-seedream-5-0-260128",
	"doubao-seedream-4.5",
	"doubao-seedance-2.0",
	"doubao-seedance-2-0-260128",
	"doubao-seedance-2.0-fast",
	"doubao-seedance-2-0-fast-260128",
	// previous generations
	"Doubao-pro-128k",
	"Doubao-pro-32k",
	"Doubao-pro-4k",
	"Doubao-lite-128k",
	"Doubao-lite-32k",
	"Doubao-lite-4k",
	"Doubao-embedding",
	"doubao-seedream-4-0-250828",
	"seedream-4-0-250828",
	"doubao-seedance-1-0-pro-250528",
	"seedance-1-0-pro-250528",
	"doubao-seed-1-6-thinking-250715",
	"seed-1-6-thinking-250715",
}

var ChannelName = "volcengine"
