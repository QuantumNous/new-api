package groksubscription

import "testing"

func TestBuildCompactTurnRejectsStreamTrue(t *testing.T) {
	in := []byte(`{"model":"grok-4","stream":true,"input":[]}`)
	if _, err := BuildCompactTurn(in); err != ErrCompactStreamUnsupported {
		t.Fatalf("stream=true must return ErrCompactStreamUnsupported, got %v", err)
	}
}

func TestBuildCompactTurnForcesNonStreamAndStore(t *testing.T) {
	in := []byte(`{"model":"grok-4","input":[{"role":"user","content":"hi"}]}`)
	out, err := BuildCompactTurn(in)
	if err != nil {
		t.Fatalf("build err %v", err)
	}
	if getBool(out, "stream") != false {
		t.Fatalf("compact must force stream=false")
	}
	if getBool(out, "store") != false {
		t.Fatalf("compact must force store=false")
	}
	if !hasSummaryItem(out) {
		t.Fatalf("compact must append server summary item")
	}
	if hasTopLevelKey(out, "tools") {
		t.Fatalf("compact must strip tools")
	}
}

func TestConvertCompactResponseRequiresEncryptedReasoning(t *testing.T) {
	noReasoning := []byte(`{"output":[{"type":"message","content":[{"type":"output_text","text":"summary"}]}]}`)
	if _, err := ConvertCompactResponse(noReasoning); err != ErrCompactMissingReasoning {
		t.Fatalf("missing encrypted reasoning must fail, got %v", err)
	}
}

func TestConvertCompactResponseSucceeds(t *testing.T) {
	ok := []byte(`{"output":[{"type":"reasoning","encrypted_content":"enc"},{"type":"message","content":[{"type":"output_text","text":"the summary"}]}]}`)
	item, err := ConvertCompactResponse(ok)
	if err != nil {
		t.Fatalf("convert err %v", err)
	}
	if item.EncryptedContent != "enc" || item.Summary == "" {
		t.Fatalf("compaction item malformed: %+v", item)
	}
}
