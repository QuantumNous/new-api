package model

import "testing"

func TestFlattenCreativeCenterHistoryAssetsImageSessions(t *testing.T) {
	history := &CreativeCenterHistory{
		ID:        11,
		UserId:    7,
		Tab:       "image",
		ModelName: "history-model",
		Group:     "history-group",
		Prompt:    "history prompt",
		CreatedAt: 1710000000,
		UpdatedAt: 1710000100,
		Payload: `{
			"sessions": [
				{
					"id": "sess-image",
					"name": "Image Session",
					"payload": {
						"entries": [
							{
								"id": "record-image",
								"prompt": "draw a cat",
								"modelName": "nano-banana",
								"group": "group-a",
								"status": "completed",
								"createdAt": 1710000001,
								"updatedAt": 1710000002,
								"images": [
									{ "url": "https://example.com/image-a.png" },
									{ "resultUrl": "https://example.com/image-b.png", "status": "success" },
									{ "status": "failed" }
								]
							}
						]
					}
				}
			]
		}`,
	}

	assets := flattenCreativeCenterHistoryAssets(history, "alice")
	if len(assets) != 2 {
		t.Fatalf("expected 2 assets, got %d", len(assets))
	}

	first := assets[0]
	if first.AssetID != "cc:image:11:sess-image:record-image:0" {
		t.Fatalf("unexpected first asset id: %s", first.AssetID)
	}
	if first.AssetType != "image" {
		t.Fatalf("unexpected asset type: %s", first.AssetType)
	}
	if first.Username != "alice" {
		t.Fatalf("unexpected username: %s", first.Username)
	}
	if first.MediaURL != "https://example.com/image-a.png" {
		t.Fatalf("unexpected media url: %s", first.MediaURL)
	}

	second := assets[1]
	if second.AssetID != "cc:image:11:sess-image:record-image:1" {
		t.Fatalf("unexpected second asset id: %s", second.AssetID)
	}
	if second.MediaURL != "https://example.com/image-b.png" {
		t.Fatalf("unexpected fallback result url: %s", second.MediaURL)
	}
	if second.Status != "completed" {
		t.Fatalf("expected normalized completed status, got %s", second.Status)
	}
}

func TestFlattenCreativeCenterHistoryAssetsVideoLegacyPayload(t *testing.T) {
	history := &CreativeCenterHistory{
		ID:        21,
		UserId:    9,
		Tab:       "video",
		ModelName: "veo-3",
		Group:     "video-group",
		Prompt:    "history video prompt",
		CreatedAt: 1720000000,
		UpdatedAt: 1720000100,
		Payload: `{
			"tasks": [
				{
					"id": "task-1",
					"url": "https://example.com/video-a.mp4",
					"status": "in_progress",
					"thumbnailUrl": "https://example.com/video-a.jpg"
				},
				{
					"id": "task-2",
					"resultUrl": "https://example.com/video-b.mp4",
					"status": "success"
				},
				{
					"id": "task-3",
					"status": "failed"
				}
			]
		}`,
	}

	assets := flattenCreativeCenterHistoryAssets(history, "bob")
	if len(assets) != 1 {
		t.Fatalf("expected 1 completed asset, got %d", len(assets))
	}

	first := assets[0]
	if first.AssetID != "cc:video:21:session-0:record-0:1" {
		t.Fatalf("unexpected asset id: %s", first.AssetID)
	}
	if first.AssetType != "video" {
		t.Fatalf("unexpected asset type: %s", first.AssetType)
	}
	if first.MediaURL != "https://example.com/video-b.mp4" {
		t.Fatalf("unexpected result url fallback: %s", first.MediaURL)
	}
	if first.Status != "completed" {
		t.Fatalf("expected completed status, got %s", first.Status)
	}
}
