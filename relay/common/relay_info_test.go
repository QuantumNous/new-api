package common

import "testing"

func TestTaskSubmitReqHasImageFromMessages(t *testing.T) {
	req := TaskSubmitReq{
		Messages: []byte(`[
			{
				"role": "user",
				"content": [
					{
						"type": "text",
						"text": "show the product"
					},
					{
						"type": "image_url",
						"image_url": {
							"url": "https://img688.com/file/demo.jpg"
						}
					}
				]
			}
		]`),
	}

	if !req.HasImage() {
		t.Fatalf("expected HasImage to detect image_url inside messages")
	}
}
