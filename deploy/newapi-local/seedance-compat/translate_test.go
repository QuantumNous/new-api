package main

import (
	"encoding/json"
	"testing"
)

func TestBuildNewAPIRequestFromSeedance(t *testing.T) {
	body := []byte(`{
		"model":"doubao-seedance-2-0-260128",
		"content":[
			{"type":"text","text":"A panda drinking coffee in a neon cafe","role":"system","style":"cinematic"},
			{"type":"text","text":"Add heavy rain","role":"user"},
			{"type":"video_url","video_url":{"url":"https://example.com/input.mp4","fps":24}}
		],
		"duration":5,
		"resolution":"720p",
		"ratio":"16:9",
		"watermark":false,
		"camera_movement":"pan_left",
		"tools":[{"type":"character_reference","strength":"high"}]
	}`)

	got, err := BuildNewAPIRequestFromSeedance(body)
	if err != nil {
		t.Fatalf("BuildNewAPIRequestFromSeedance returned error: %v", err)
	}

	if got.Model != "doubao-seedance-2-0-260128" {
		t.Fatalf("unexpected model: %q", got.Model)
	}
	if got.Prompt != "A panda drinking coffee in a neon cafe" {
		t.Fatalf("unexpected prompt: %q", got.Prompt)
	}
	if got.Seconds != "5" {
		t.Fatalf("unexpected seconds: %q", got.Seconds)
	}

	if got.Metadata["duration"] != float64(5) {
		t.Fatalf("unexpected metadata.duration: %#v", got.Metadata["duration"])
	}
	if got.Metadata["resolution"] != "720p" {
		t.Fatalf("unexpected metadata.resolution: %#v", got.Metadata["resolution"])
	}
	if got.Metadata["ratio"] != "16:9" {
		t.Fatalf("unexpected metadata.ratio: %#v", got.Metadata["ratio"])
	}
	if got.Metadata["watermark"] != false {
		t.Fatalf("unexpected metadata.watermark: %#v", got.Metadata["watermark"])
	}
	if got.Metadata["camera_movement"] != "pan_left" {
		t.Fatalf("unexpected metadata.camera_movement: %#v", got.Metadata["camera_movement"])
	}

	content, ok := got.Metadata["content"].([]any)
	if !ok {
		t.Fatalf("metadata.content missing or wrong type: %#v", got.Metadata["content"])
	}
	if len(content) != 3 {
		t.Fatalf("unexpected metadata.content length: %d", len(content))
	}
	first, ok := content[0].(map[string]any)
	if !ok {
		t.Fatalf("content[0] missing or wrong type: %#v", content[0])
	}
	if first["role"] != "system" || first["style"] != "cinematic" {
		t.Fatalf("content[0] extras not preserved: %#v", first)
	}
	videoItem, ok := content[2].(map[string]any)
	if !ok {
		t.Fatalf("content[2] missing or wrong type: %#v", content[2])
	}
	videoURL, ok := videoItem["video_url"].(map[string]any)
	if !ok || videoURL["fps"] != float64(24) {
		t.Fatalf("video extras not preserved: %#v", videoItem["video_url"])
	}
	tools, ok := got.Metadata["tools"].([]any)
	if !ok || len(tools) != 1 {
		t.Fatalf("metadata.tools missing or wrong type: %#v", got.Metadata["tools"])
	}
}

func TestBuildSeedanceSubmitResponseFromNewAPI(t *testing.T) {
	body := []byte(`{
		"id":"task_xxx",
		"task_id":"task_xxx",
		"object":"video",
		"model":"doubao-seedance-2-0-260128",
		"status":"queued",
		"progress":0,
		"created_at":1776323511,
		"metadata":{"url":"https://example.com/video.mp4"}
	}`)

	got, err := BuildSeedanceSubmitResponseFromNewAPI(body)
	if err != nil {
		t.Fatalf("BuildSeedanceSubmitResponseFromNewAPI returned error: %v", err)
	}

	var decoded map[string]any
	if err := json.Unmarshal(got, &decoded); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}

	if decoded["id"] != "task_xxx" {
		t.Fatalf("unexpected id: %#v", decoded["id"])
	}
	if decoded["status"] != "queued" {
		t.Fatalf("unexpected status: %#v", decoded["status"])
	}
	if decoded["model"] != "doubao-seedance-2-0-260128" {
		t.Fatalf("unexpected model: %#v", decoded["model"])
	}
	content, ok := decoded["content"].(map[string]any)
	if !ok || content["video_url"] != "https://example.com/video.mp4" {
		t.Fatalf("unexpected content translation: %#v", decoded["content"])
	}
}

func TestBuildSeedanceTaskResponseFromNewAPI(t *testing.T) {
	body := []byte(`{
		"id":"task_xxx",
		"task_id":"task_xxx",
		"object":"video",
		"model":"doubao-seedance-2-0-260128",
		"status":"completed",
		"progress":100,
		"created_at":1776323511,
		"completed_at":1776323522,
		"metadata":{"url":"https://example.com/video.mp4"},
		"error":{"code":"bad_request","message":"ignored"}
	}`)

	got, err := BuildSeedanceTaskResponseFromNewAPI(body)
	if err != nil {
		t.Fatalf("BuildSeedanceTaskResponseFromNewAPI returned error: %v", err)
	}

	var decoded map[string]any
	if err := json.Unmarshal(got, &decoded); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}

	if decoded["status"] != "succeeded" {
		t.Fatalf("unexpected status: %#v", decoded["status"])
	}
	if decoded["updated_at"] != float64(1776323522) {
		t.Fatalf("unexpected updated_at: %#v", decoded["updated_at"])
	}
	content, ok := decoded["content"].(map[string]any)
	if !ok || content["video_url"] != "https://example.com/video.mp4" {
		t.Fatalf("unexpected content translation: %#v", decoded["content"])
	}
}
