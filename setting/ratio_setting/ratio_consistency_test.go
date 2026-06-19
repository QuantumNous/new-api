package ratio_setting

import (
	"sort"
	"testing"
)

// Every model that has a cache or cache-creation ratio configured is, by
// definition, a model we intend to serve and bill. If it lacks a *model* ratio
// (the input price), GetModelRatio returns found=false whenever self-use mode is
// off, and the relay rejects the request with "价格未配置 / price not configured".
//
// This guards against the recurring class of bug where a new model (or its
// -thinking twin) is added to cache_ratio.go but forgotten in defaultModelRatio.
func TestEveryCacheModelHasModelRatio(t *testing.T) {
	InitRatioSettings()

	intended := map[string]struct{}{}
	for k := range defaultCacheRatio {
		intended[k] = struct{}{}
	}
	for k := range defaultCreateCacheRatio {
		intended[k] = struct{}{}
	}

	var missing []string
	for name := range intended {
		if _, found, _ := GetModelRatio(name); !found {
			missing = append(missing, name)
		}
	}
	sort.Strings(missing)

	if len(missing) > 0 {
		t.Fatalf("%d model(s) have a cache/completion ratio but NO model ratio "+
			"(would fail with 价格未配置). Add them to defaultModelRatio: %v",
			len(missing), missing)
	}
}
