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
