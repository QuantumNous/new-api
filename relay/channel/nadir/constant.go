package nadir

// ModelList is the set of model ids this channel exposes.
//
// Nadir is an OpenAI-compatible router: send "auto" and it classifies the
// prompt, then routes to the cheapest model that clears its quality bar. The
// response `model` field reports the model it actually routed to. Only "auto"
// is listed, because pinning a concrete model here would bypass the routing
// that is the whole point of the channel.
var ModelList = []string{"auto"}

// ChannelName is the adaptor name reported for this channel, and is what
// surfaces as the model owner in /v1/models responses.
var ChannelName = "nadir"
