package service

import "testing"

func TestDecodeBase64AudioDataStripsDataURLPrefix(t *testing.T) {
	const encoded = "AQIDBA=="

	got, err := DecodeBase64AudioData("data:audio/wav;base64," + encoded)
	if err != nil {
		t.Fatalf("DecodeBase64AudioData() unexpected error: %v", err)
	}
	if got != encoded {
		t.Fatalf("DecodeBase64AudioData() = %q, want %q", got, encoded)
	}
}

func TestDecodeBase64AudioDataRejectsArbitraryCommaPrefix(t *testing.T) {
	if _, err := DecodeBase64AudioData("filename.wav,AQIDBA=="); err == nil {
		t.Fatalf("DecodeBase64AudioData() expected error for non-data URL comma prefix")
	}
}
