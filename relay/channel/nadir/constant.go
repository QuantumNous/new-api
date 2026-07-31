package nadir

// Nadir is an OpenAI-compatible router: send "auto" and it classifies the
// prompt, then routes to the cheapest model that clears its quality bar. The
// response `model` field reports the model it actually routed to.
var ModelList = []string{"auto"}

var ChannelName = "nadir"
