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

func TestBuildCompactTurnRejectsNonArrayInput(t *testing.T) {
	in := []byte(`{"model":"grok-4","input":"hello world"}`)
	out, err := BuildCompactTurn(in)
	if err != ErrCompactInvalidInput {
		t.Fatalf("non-array input must fail, got %v", err)
	}
	if out != nil {
		t.Fatalf("rejected input must return nil body, got %s", out)
	}
}

func TestConvertCompactResponseRequiresEncryptedReasoning(t *testing.T) {
	noReasoning := []byte(`{"output":[{"type":"message","content":[{"type":"output_text","text":"summary"}]}]}`)
	if _, err := ConvertCompactResponse(noReasoning); err != ErrCompactMissingReasoning {
		t.Fatalf("missing encrypted reasoning must fail, got %v", err)
	}
}

func TestConvertCompactResponseRequiresSummary(t *testing.T) {
	body := []byte(`{"output":[{"type":"reasoning","encrypted_content":"enc"}]}`)
	if _, err := ConvertCompactResponse(body); err != ErrCompactMissingSummary {
		t.Fatalf("missing summary must fail, got %v", err)
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
