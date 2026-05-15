package common

import (
	"context"
	"encoding/json"
)

// ConfigChangedChannel is the Redis pubsub channel used for config change notifications.
const ConfigChangedChannel = "new-api:config-changed"

// Scope values used in config-change messages. Subscribers map scope to a reload action.
const (
	ConfigScopeOptions  = "options"
	ConfigScopeChannels = "channels"
)

type configChangeMessage struct {
	Scope  string `json:"scope"`
	Source string `json:"source"`
}

// PublishConfigChanged notifies all replicas that a config of the given scope has changed.
// No-op when Redis is disabled. Errors are returned to the caller; the caller decides
// whether to log or ignore (write path should not fail just because pubsub failed).
func PublishConfigChanged(ctx context.Context, scope string) error {
	if !RedisEnabled || RDB == nil {
		return nil
	}
	payload, err := json.Marshal(configChangeMessage{Scope: scope, Source: GetReplicaID()})
	if err != nil {
		return err
	}
	return RDB.Publish(ctx, ConfigChangedChannel, payload).Err()
}
