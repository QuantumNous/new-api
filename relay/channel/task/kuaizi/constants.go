package kuaizi

// Kuaizi 丽帧视频 2.0 only differentiates output quality via the `mode` field.
// Expose two pseudo-model names so admins can charge / bill them separately.

const (
	ModelLizhenFast = "kuaizi-lizhen-fast"
	ModelLizhenPro  = "kuaizi-lizhen-pro"

	ModeFast = "fast"
	ModePro  = "pro"
)

var ModelList = []string{
	ModelLizhenFast,
	ModelLizhenPro,
}

// ModelToMode maps a pseudo-model exposed to clients to the upstream mode flag.
// Returns false when the model is not one of the registered pseudo-models —
// callers turn this into a request-validation error.
func ModelToMode(model string) (string, bool) {
	switch model {
	case ModelLizhenFast:
		return ModeFast, true
	case ModelLizhenPro:
		return ModePro, true
	default:
		return "", false
	}
}

const ChannelName = "kuaizi-lizhen"
