package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

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
								"createdAt": 1710000001000,
								"updatedAt": 1710000002000,
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
	if first.CreatedAt != 1710000001 {
		t.Fatalf("expected milliseconds to normalize to seconds, got %d", first.CreatedAt)
	}
	if first.UpdatedAt != 1710000002 {
		t.Fatalf("expected milliseconds to normalize to seconds, got %d", first.UpdatedAt)
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
					"status": "submitted"
				},
				{
					"id": "task-3",
					"status": "failed"
				}
			]
		}`,
	}

	assets := flattenCreativeCenterHistoryAssets(history, "bob")
	if len(assets) != 2 {
		t.Fatalf("expected 2 completed assets, got %d", len(assets))
	}

	first := assets[0]
	if first.AssetID != "cc:video:21:session-0:record-0:0" {
		t.Fatalf("unexpected first asset id: %s", first.AssetID)
	}
	if first.MediaURL != "https://example.com/video-a.mp4" {
		t.Fatalf("unexpected media url: %s", first.MediaURL)
	}
	if first.ThumbnailURL != "https://example.com/video-a.jpg" {
		t.Fatalf("unexpected thumbnail url: %s", first.ThumbnailURL)
	}
	if first.Status != "completed" {
		t.Fatalf("expected completed status, got %s", first.Status)
	}

	second := assets[1]
	if second.AssetID != "cc:video:21:session-0:record-0:1" {
		t.Fatalf("unexpected asset id: %s", second.AssetID)
	}
	if second.AssetType != "video" {
		t.Fatalf("unexpected asset type: %s", second.AssetType)
	}
	if second.MediaURL != "https://example.com/video-b.mp4" {
		t.Fatalf("unexpected result url fallback: %s", second.MediaURL)
	}
	if second.Status != "completed" {
		t.Fatalf("expected completed status, got %s", second.Status)
	}
}

func TestFlattenTaskAssetsImageUsesTaskData(t *testing.T) {
	task := &Task{
		ID:         31,
		TaskID:     "task-image-1",
		UserId:     7,
		Group:      "default",
		Action:     "imageGenerate",
		Status:     TaskStatusSuccess,
		SubmitTime: 1730000000,
		UpdatedAt:  1730000100,
		Properties: Properties{
			Input:           "draw a cat",
			OriginModelName: "nano-banana",
		},
	}
	task.SetData(map[string]any{
		"data": []any{
			map[string]any{"url": "https://example.com/image-a.png"},
			map[string]any{"resultUrl": "https://example.com/image-b.png"},
		},
	})

	assets := flattenTaskAssets(task, "alice")
	if len(assets) != 2 {
		t.Fatalf("expected 2 task assets, got %d", len(assets))
	}

	first := assets[0]
	if first.TaskID != "task-image-1" {
		t.Fatalf("unexpected task id: %s", first.TaskID)
	}
	if first.SessionName != "" {
		t.Fatalf("expected empty session name, got %q", first.SessionName)
	}
	if first.MediaURL != "https://example.com/image-a.png" {
		t.Fatalf("unexpected media url: %s", first.MediaURL)
	}
	if first.AssetType != "image" {
		t.Fatalf("unexpected asset type: %s", first.AssetType)
	}
}

func TestFlattenTaskAssetsVideoUsesResultAndThumbnail(t *testing.T) {
	task := &Task{
		ID:         32,
		TaskID:     "task-video-1",
		UserId:     9,
		Group:      "video-group",
		Action:     "textGenerate",
		Status:     TaskStatusSuccess,
		SubmitTime: 1740000000,
		FinishTime: 1740000060,
		UpdatedAt:  1740000060,
		Properties: Properties{
			Input:           "generate a trailer",
			OriginModelName: "veo31",
		},
		PrivateData: TaskPrivateData{
			ResultURL: "https://example.com/video-a.mp4",
		},
	}
	task.SetData(map[string]any{
		"creations": []any{
			map[string]any{
				"url":       "https://example.com/video-a.mp4",
				"cover_url": "https://example.com/video-a.jpg",
			},
		},
	})

	assets := flattenTaskAssets(task, "bob")
	if len(assets) != 1 {
		t.Fatalf("expected 1 task asset, got %d", len(assets))
	}

	first := assets[0]
	if first.MediaURL != "https://example.com/video-a.mp4" {
		t.Fatalf("unexpected media url: %s", first.MediaURL)
	}
	if first.ThumbnailURL != "https://example.com/video-a.jpg" {
		t.Fatalf("unexpected thumbnail url: %s", first.ThumbnailURL)
	}
	if first.Status != "completed" {
		t.Fatalf("unexpected status: %s", first.Status)
	}
}

func TestMatchesCreativeCenterAssetFilterMatchesTaskIDKeyword(t *testing.T) {
	asset := &dto.CreativeCenterAsset{
		AssetID:   "task:image:task-image-1:0",
		TaskID:    "task-image-1",
		AssetType: "image",
		ModelName: "nano-banana",
		Prompt:    "draw a cat",
		Status:    "completed",
		CreatedAt: common.GetTimestamp(),
	}

	if !matchesCreativeCenterAssetFilter(asset, CreativeCenterAssetQueryParams{Keyword: "task-image-1"}) {
		t.Fatalf("expected task id keyword to match asset filter")
	}
}
