package ratio_setting

import (
	"bufio"
	"os"
	"sort"
	"strings"
	"testing"
)

// scripts/seed-models/channels.yaml is what an operator runs to provision every
// upstream channel. Any model it seeds is a model we intend to serve — if it has
// neither a model ratio (token pricing) nor a model price (per-call pricing),
// the relay rejects the request with "价格未配置 / price not configured" and the
// operator only finds out when a customer hits it.
//
// This test walks the seed file and asserts every model on an *enabled* channel
// is priced. Channels marked `enabled: false` are skipped — they are opt-in and
// intentionally carry unpriced entries.
// Pre-existing pricing debt, inherited by the 2026-08 catalogue refresh rather
// than introduced by it. Each entry is seeded today but has no list price in
// this package, so it already fails at request time with 价格未配置.
//
// TODO: price these (Tencent Hunyuan and 01.AI list prices are RMB-denominated
// and need a per-tier lookup; Qwen-VL / qwen-long are per-context-tier) or drop
// the channels from channels.yaml. Do NOT add new entries here — the point of
// the allowlist is that it only ever shrinks.
var knownUnpricedSeedModels = map[string]bool{
	"hunyuan-lite":          true,
	"hunyuan-pro":           true,
	"hunyuan-standard":      true,
	"hunyuan-standard-256K": true,
	"hunyuan-vision":        true,
	"moonshot-v1-auto":      true,
	"pixtral-large-latest":  true,
	"qwen-long":             true,
	"qwen-vl-max":           true,
	"qwen-vl-plus":          true,
	"yi-lightning":          true,
}

func TestSeededModelsArePriced(t *testing.T) {
	InitRatioSettings()

	models, err := seededModels("../../scripts/seed-models/channels.yaml")
	if err != nil {
		t.Fatalf("reading seed file: %v", err)
	}
	if len(models) == 0 {
		t.Fatal("parsed 0 models from channels.yaml — the parser or the file layout changed")
	}

	var unpriced []string
	for _, name := range models {
		if knownUnpricedSeedModels[name] {
			continue
		}
		if _, found, _ := GetModelRatio(name); found {
			continue
		}
		if _, found := GetModelPrice(name, false); found {
			continue
		}
		unpriced = append(unpriced, name)
	}
	sort.Strings(unpriced)

	if len(unpriced) > 0 {
		t.Fatalf("%d seeded model(s) have no price configured (requests would fail with 价格未配置). "+
			"Add them to defaultModelRatio/defaultModelPrice, or drop them from channels.yaml: %v",
			len(unpriced), unpriced)
	}
}

// seededModels extracts the `models:` entries of every channel that is not
// explicitly disabled. Deliberately a small line scanner rather than a YAML
// dependency: the file shape is fixed and this keeps the test hermetic.
func seededModels(path string) ([]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var (
		out      []string
		pending  []string
		enabled  = true
		inModels bool
		flush    = func() { // commit the channel we just finished reading
			if enabled {
				out = append(out, pending...)
			}
			pending = nil
			enabled = true
			inModels = false
		}
	)

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}

		// New channel entry: "  - name: ..."
		if strings.HasPrefix(line, "  - name:") {
			flush()
			continue
		}
		if strings.HasPrefix(line, "    enabled:") {
			enabled = strings.Contains(trimmed, "true")
			inModels = false
			continue
		}
		if strings.HasPrefix(line, "    models:") {
			inModels = true
			continue
		}
		// Any other 4-space key ends the models block.
		if strings.HasPrefix(line, "    ") && !strings.HasPrefix(line, "     ") {
			inModels = false
			continue
		}
		if inModels && strings.HasPrefix(trimmed, "- ") {
			model := strings.TrimSpace(strings.TrimPrefix(trimmed, "- "))
			if i := strings.Index(model, " #"); i >= 0 {
				model = strings.TrimSpace(model[:i])
			}
			if model != "" {
				pending = append(pending, model)
			}
		}
	}
	flush()
	return out, scanner.Err()
}
