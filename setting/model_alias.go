package setting

import (
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

// globalModelAlias maps a client-supplied model name to the canonical model
// name actually configured on channels. Typical use case: the deployment has
// migrated to openrouter-style "vendor/model" ids (e.g. openai/gpt-4o) but
// legacy clients still send the bare name (gpt-4o). The operator configures
// {"gpt-4o": "openai/gpt-4o"} here and legacy clients keep working without
// touching every channel's model_mapping. Lookup is one hop only; aliases
// are not chained.
var (
	globalModelAlias      = map[string]string{}
	globalModelAliasMutex sync.RWMutex
)

// UpdateGlobalModelAliasByJSONString replaces the alias map from a JSON
// object string. Empty / whitespace input clears the map. Entries whose key
// or value is empty (after trimming) are dropped, so a misconfigured
// {"gpt-4o": ""} cannot rewrite a request model to an empty string.
func UpdateGlobalModelAliasByJSONString(jsonStr string) error {
	trimmed := strings.TrimSpace(jsonStr)
	raw := map[string]string{}
	if trimmed != "" && trimmed != "null" {
		if err := common.Unmarshal([]byte(trimmed), &raw); err != nil {
			return err
		}
	}
	next := make(map[string]string, len(raw))
	for k, v := range raw {
		k = strings.TrimSpace(k)
		v = strings.TrimSpace(v)
		if k == "" || v == "" {
			continue
		}
		next[k] = v
	}
	globalModelAliasMutex.Lock()
	defer globalModelAliasMutex.Unlock()
	globalModelAlias = next
	return nil
}

// GlobalModelAlias2JSONString returns the current alias map as a JSON string.
func GlobalModelAlias2JSONString() string {
	globalModelAliasMutex.RLock()
	defer globalModelAliasMutex.RUnlock()
	if len(globalModelAlias) == 0 {
		return "{}"
	}
	b, err := common.Marshal(globalModelAlias)
	if err != nil {
		return "{}"
	}
	return string(b)
}

// GetGlobalModelAlias returns the canonical model name configured for the
// given client-supplied name, or empty string when no alias is set.
func GetGlobalModelAlias(name string) string {
	if name == "" {
		return ""
	}
	globalModelAliasMutex.RLock()
	defer globalModelAliasMutex.RUnlock()
	return globalModelAlias[name]
}
