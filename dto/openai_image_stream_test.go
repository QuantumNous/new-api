package dto

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestImageRequestStreamField(t *testing.T) {
	var r ImageRequest
	if err := common.Unmarshal([]byte(`{"model":"m","prompt":"p","stream":true}`), &r); err != nil {
		t.Fatal(err)
	}
	if r.Stream == nil || !*r.Stream {
		t.Fatal("stream:true must bind to the Stream field (not Extra)")
	}
	if _, leaked := r.Extra["stream"]; leaked {
		t.Fatal("stream must no longer land in Extra")
	}

	r.Stream = nil
	out, err := common.Marshal(r)
	if err != nil {
		t.Fatal(err)
	}
	var m map[string]any
	_ = common.Unmarshal(out, &m)
	if _, ok := m["stream"]; ok {
		t.Fatalf("nil Stream must be omitted: %s", out)
	}
}
