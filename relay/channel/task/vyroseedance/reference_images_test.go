package vyroseedance

import "testing"

func TestSetSeedance20ReferenceImagePayload(t *testing.T) {
	t.Run("empty", func(t *testing.T) {
		payload := map[string]interface{}{}
		setSeedance20ReferenceImagePayload(payload, nil)
		if len(payload) != 0 {
			t.Fatalf("payload = %#v", payload)
		}
	})

	t.Run("single", func(t *testing.T) {
		payload := map[string]interface{}{}
		setSeedance20ReferenceImagePayload(payload, []string{"https://example.com/a.png"})
		if payload["image_url"] != "https://example.com/a.png" {
			t.Fatalf("payload = %#v", payload)
		}
		if _, ok := payload["image_urls"]; ok {
			t.Fatalf("should not set image_urls for single image")
		}
	})

	t.Run("multiple", func(t *testing.T) {
		payload := map[string]interface{}{}
		urls := []string{"https://example.com/a.png", "https://example.com/b.png"}
		setSeedance20ReferenceImagePayload(payload, urls)
		got, ok := payload["image_urls"].([]string)
		if !ok {
			t.Fatalf("payload = %#v", payload)
		}
		if len(got) != 2 || got[0] != urls[0] || got[1] != urls[1] {
			t.Fatalf("image_urls = %#v", got)
		}
	})
}
