package setting

// StreamCacheQueueLength controls the optional stream-mode response cache.
// It is unrelated to sensitive-word filtering and remains an Option-backed
// setting for backwards compatibility with existing deployments.
var StreamCacheQueueLength = 0
