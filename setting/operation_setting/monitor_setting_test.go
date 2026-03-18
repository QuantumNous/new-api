package operation_setting

import "testing"

func TestParseMonitorKeywords(t *testing.T) {
	keywords := ParseMonitorKeywords(" Stream must be set to true \n\nFoo\r\n BAR ")
	if len(keywords) != 3 {
		t.Fatalf("expected 3 keywords, got %d", len(keywords))
	}
	if keywords[0] != "stream must be set to true" {
		t.Fatalf("unexpected first keyword: %q", keywords[0])
	}
	if keywords[1] != "foo" {
		t.Fatalf("unexpected second keyword: %q", keywords[1])
	}
	if keywords[2] != "bar" {
		t.Fatalf("unexpected third keyword: %q", keywords[2])
	}
}

func TestShouldRetryChannelTestWithStream(t *testing.T) {
	original := monitorSetting
	t.Cleanup(func() {
		monitorSetting = original
	})

	monitorSetting.ChannelTestStreamRetryEnabled = true
	monitorSetting.ChannelTestStreamRetryStatusCodes = "400,429"
	monitorSetting.ChannelTestStreamRetryKeywords = "stream must be set to true\nretry with stream"

	if !ShouldRetryChannelTestWithStream(400, "bad response status code 400, message: Stream must be set to true") {
		t.Fatal("expected retry to be enabled for matching status code and keyword")
	}
	if ShouldRetryChannelTestWithStream(500, "bad response status code 500, message: Stream must be set to true") {
		t.Fatal("did not expect retry for non-matching status code")
	}
	if ShouldRetryChannelTestWithStream(400, "bad response status code 400, message: invalid request") {
		t.Fatal("did not expect retry for non-matching keyword")
	}

	monitorSetting.ChannelTestStreamRetryEnabled = false
	if ShouldRetryChannelTestWithStream(400, "bad response status code 400, message: Stream must be set to true") {
		t.Fatal("did not expect retry when setting disabled")
	}
}