package xaigrok

// Grok Imagine exposes two video models. Clients submit the OpenAI-style video
// request ({model, prompt, image?, duration?}); the adaptor maps it to the
// upstream Grok video wire format. Model names are forwarded verbatim upstream.
const (
	ModelGrokImagineVideo   = "grok-imagine-video"
	ModelGrokImagineVideo15 = "grok-imagine-video-1.5"
)

var ModelList = []string{
	ModelGrokImagineVideo,
	ModelGrokImagineVideo15,
}

// isSupportedModel reports whether the given model is one of the registered
// Grok Imagine video models.
func isSupportedModel(model string) bool {
	switch model {
	case ModelGrokImagineVideo, ModelGrokImagineVideo15:
		return true
	default:
		return false
	}
}

// ChannelName is an internal/admin-facing identifier only. It is never returned
// to end customers (the task relay path does not surface it), so it is safe to
// keep it descriptive.
const ChannelName = "xai-grok-video"

// maxDurationSeconds is the upstream ceiling for the optional duration field.
const maxDurationSeconds = 15

// defaultBillingSeconds is the duration assumed for billing when the client
// omits it. Upstream bills per generated second, so we must pre-consume against
// a concrete length; this mirrors sora's fallback.
const defaultBillingSeconds = 5
