package main

import (
	"encoding/json"
	"testing"
)

func TestBuildNewAPIRequestFromSeedance(t *testing.T) {
	body := []byte(`{
		"model":"doubao-seedance-2-0-260128",
		"content":[
			{"type":"text","text":"A panda drinking coffee in a neon cafe"},
			{"type":"video_url","video_url":{"url":"https://example.com/input.mp4"}}
		],
		"duration":5,
		"resolution":"720p",
		"ratio":"16:9",
		"watermark":false
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

	if got.Metadata["duration"] != 5 {
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

	content, ok := got.Metadata["content"].([]any)
	if !ok {
		t.Fatalf("metadata.content missing or wrong type: %#v", got.Metadata["content"])
	}
	if len(content) != 2 {
		t.Fatalf("unexpected metadata.content length: %d", len(content))
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
		"created_at":1776323511
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
}
