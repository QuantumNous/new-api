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

func TestBuildSeedanceTaskResponseFromWrappedNewAPI(t *testing.T) {
	body := []byte(`{
		"code":"success",
		"message":"",
		"data":{
			"id":57,
			"created_at":1780389828,
			"updated_at":1780390030,
			"task_id":"task_qRfhNbI2cHkWv4flHf0EZitKIjHbI3Vo",
			"status":"SUCCESS",
			"data":{
				"content":{"video_url":"https://example.com/video.mp4"},
				"created_at":1780389828,
				"duration":5,
				"generate_audio":false,
				"id":"cgt-20260602164348-wzmk9",
				"model":"doubao-seedance-2-0-260128",
				"ratio":"16:9",
				"resolution":"720p",
				"status":"succeeded",
				"updated_at":1780390016,
				"usage":{"completion_tokens":108900,"total_tokens":108900}
			}
		}
	}`)

	got, err := BuildSeedanceTaskResponseFromNewAPI(body)
	if err != nil {
		t.Fatalf("BuildSeedanceTaskResponseFromNewAPI returned error: %v", err)
	}

	var decoded map[string]any
	if err := json.Unmarshal(got, &decoded); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}

	if _, exists := decoded["code"]; exists {
		t.Fatalf("expected raw Ark task object, got wrapper: %#v", decoded)
	}
	if decoded["id"] != "cgt-20260602164348-wzmk9" {
		t.Fatalf("unexpected id: %#v", decoded["id"])
	}
	if decoded["task_id"] != "task_qRfhNbI2cHkWv4flHf0EZitKIjHbI3Vo" {
		t.Fatalf("unexpected task_id: %#v", decoded["task_id"])
	}
	if decoded["status"] != "succeeded" {
		t.Fatalf("unexpected status: %#v", decoded["status"])
	}
	if decoded["model"] != "doubao-seedance-2-0-260128" {
		t.Fatalf("unexpected model: %#v", decoded["model"])
	}
	if decoded["duration"] != float64(5) {
		t.Fatalf("unexpected duration: %#v", decoded["duration"])
	}
	if decoded["ratio"] != "16:9" {
		t.Fatalf("unexpected ratio: %#v", decoded["ratio"])
	}
	if decoded["resolution"] != "720p" {
		t.Fatalf("unexpected resolution: %#v", decoded["resolution"])
	}
	if decoded["generate_audio"] != false {
		t.Fatalf("unexpected generate_audio: %#v", decoded["generate_audio"])
	}
	content, ok := decoded["content"].(map[string]any)
	if !ok || content["video_url"] != "https://example.com/video.mp4" {
		t.Fatalf("unexpected content: %#v", decoded["content"])
	}
	usage, ok := decoded["usage"].(map[string]any)
	if !ok || usage["total_tokens"] != float64(108900) {
		t.Fatalf("unexpected usage: %#v", decoded["usage"])
	}
}
