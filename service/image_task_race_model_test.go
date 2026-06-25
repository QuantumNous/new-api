package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

func TestResolveChannelUpstreamModel(t *testing.T) {
	noMapping := &model.Channel{}
	if got := ResolveChannelUpstreamModel(noMapping, "gpt-image-2"); got != "gpt-image-2" {
		t.Fatalf("no mapping: got %q, want gpt-image-2", got)
	}

	official := &model.Channel{ModelMapping: strPtr(`{"gpt-image-2":"gpt-image-2-official"}`)}
	if got := ResolveChannelUpstreamModel(official, "gpt-image-2"); got != "gpt-image-2-official" {
		t.Fatalf("official mapping: got %q, want gpt-image-2-official", got)
	}
}

// A hedge to a no-mapping channel must NOT inherit the primary channel's mapped
// upstream name baked into the reused body — it should use the canonical model id.
func TestRewriteImageRequestModelForChannel_stripsPrimaryMapping(t *testing.T) {
	body := []byte(`{"model":"gpt-image-2-official","n":1,"size":"1:1","prompt":"x"}`)
	hedge := &model.Channel{} // roma-image style: no model mapping

	out := rewriteImageRequestModelForChannel(body, hedge, "gpt-image-2")

	var parsed map[string]interface{}
	if err := common.Unmarshal(out, &parsed); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if parsed["model"] != "gpt-image-2" {
		t.Fatalf("model = %v, want gpt-image-2", parsed["model"])
	}
	// other fields preserved
	if parsed["size"] != "1:1" || parsed["prompt"] != "x" {
		t.Fatalf("other fields not preserved: %+v", parsed)
	}
}

// A hedge to an official-tier channel keeps its own mapped upstream name.
func TestRewriteImageRequestModelForChannel_appliesHedgeMapping(t *testing.T) {
	body := []byte(`{"model":"gpt-image-2","n":1}`)
	hedge := &model.Channel{ModelMapping: strPtr(`{"gpt-image-2":"gpt-image-2-official"}`)}

	out := rewriteImageRequestModelForChannel(body, hedge, "gpt-image-2")

	var parsed map[string]interface{}
	if err := common.Unmarshal(out, &parsed); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if parsed["model"] != "gpt-image-2-official" {
		t.Fatalf("model = %v, want gpt-image-2-official", parsed["model"])
	}
}

// Client calling the official alias still resolves correctly for a no-mapping hedge.
func TestRewriteImageRequestModelForChannel_normalizesAliasCanonical(t *testing.T) {
	body := []byte(`{"model":"gpt-image-2-official"}`)
	hedge := &model.Channel{}

	out := rewriteImageRequestModelForChannel(body, hedge, "gpt-image-2-official")

	var parsed map[string]interface{}
	if err := common.Unmarshal(out, &parsed); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if parsed["model"] != "gpt-image-2" {
		t.Fatalf("model = %v, want gpt-image-2 (canonical)", parsed["model"])
	}
}
