package vllm

// ModelList is intentionally empty: vLLM instances serve whatever models are
// loaded at runtime. Users configure model names per-channel via model mapping.
var ModelList = []string{}

var ChannelName = "vLLM"
