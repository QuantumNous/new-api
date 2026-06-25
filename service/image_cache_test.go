package service

import "testing"

func TestExtractFirstImageURLFromResponse_syncData(t *testing.T) {
	body := []byte(`{"created":1,"data":[{"url":"https://apimaster.ai/imgs/abc.png"}]}`)
	if got := ExtractFirstImageURLFromResponse(body); got != "https://apimaster.ai/imgs/abc.png" {
		t.Fatalf("got %q", got)
	}
}

func TestExtractFirstImageURLFromResponse_asyncPoll(t *testing.T) {
	body := []byte(`{"data":{"status":"succeeded","result":{"images":[{"url":"https://apimaster.ai/imgs/def.jpg"}]}}}`)
	if got := ExtractFirstImageURLFromResponse(body); got != "https://apimaster.ai/imgs/def.jpg" {
		t.Fatalf("got %q", got)
	}
}

func TestIsValidMediaResultURL(t *testing.T) {
	cases := []struct {
		url  string
		want bool
	}{
		{"https://apimaster.ai/imgs/abc.png", true},
		{"http://example.com/a.jpg", true},
		{"upstream task failed", false},
		{"", false},
		{"not-a-url", false},
	}
	for _, c := range cases {
		if got := IsValidMediaResultURL(c.url); got != c.want {
			t.Errorf("IsValidMediaResultURL(%q) = %v, want %v", c.url, got, c.want)
		}
	}
}
