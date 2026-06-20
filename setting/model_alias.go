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
//
// NOTE: the rewrite happens before the token model-limit check and channel
// selection in middleware/distributor.go. That means per-token model
// allow-lists must contain the post-alias (namespaced) names — a legacy
// client sending "gpt-4o" with a token limit of ["gpt-4o"] will be rejected
// once the alias points at "openai/gpt-4o".
var (
	globalModelAlias      = map[string]string{}
	globalModelAliasMutex sync.RWMutex
)

// parseAliasJSON parses a JSON object string into a clean alias map.
// Empty / "null" / whitespace input yields an empty map without error.
// Entries are dropped when, after trimming, the key or value is empty or
// the two sides are identical (a same-name "alias" is a no-op).
func parseAliasJSON(jsonStr string) (map[string]string, error) {
	trimmed := strings.TrimSpace(jsonStr)
	raw := map[string]string{}
	if trimmed != "" && trimmed != "null" {
		if err := common.Unmarshal([]byte(trimmed), &raw); err != nil {
			return nil, err
		}
	}
	clean := make(map[string]string, len(raw))
	for k, v := range raw {
		k = strings.TrimSpace(k)
		v = strings.TrimSpace(v)
		if k == "" || v == "" || k == v {
			continue
		}
		clean[k] = v
	}
	return clean, nil
}

// CheckGlobalModelAliasJSON validates a JSON alias map without mutating state.
// Used by controller-level option validation; the actual apply lives in
// UpdateGlobalModelAliasByJSONString which is invoked from updateOptionMap.
func CheckGlobalModelAliasJSON(jsonStr string) error {
	_, err := parseAliasJSON(jsonStr)
	return err
}

// UpdateGlobalModelAliasByJSONString replaces the in-memory alias map from a
// JSON object string. See parseAliasJSON for the input contract.
func UpdateGlobalModelAliasByJSONString(jsonStr string) error {
	next, err := parseAliasJSON(jsonStr)
	if err != nil {
		return err
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
