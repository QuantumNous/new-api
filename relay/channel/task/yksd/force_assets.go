package yksd

import (
	"fmt"
	"strings"
	"sync"
)

type mediaJob struct {
	field     string
	assetType string // Image / Video / Audio
	index     int    // -1 for single fields
	raw       string
}

// forceAssetsInBody uploads/validates all media URLs and rewrites them to assetId:// refs.
func forceAssetsInBody(client *assetClient, body map[string]interface{}) error {
	if body == nil || client == nil {
		return nil
	}
	jobs := collectMediaJobs(body)
	if len(jobs) == 0 {
		return nil
	}

	type result struct {
		job mediaJob
		ref string
		err error
	}
	results := make([]result, len(jobs))
	var wg sync.WaitGroup
	wg.Add(len(jobs))
	for i, job := range jobs {
		i, job := i, job
		go func() {
			defer wg.Done()
			ref, err := ensureAssetRef(client, job.assetType, job.raw)
			results[i] = result{job: job, ref: ref, err: err}
		}()
	}
	wg.Wait()

	for _, r := range results {
		if r.err != nil {
			return r.err
		}
	}

	// Apply rewrites: rebuild slice fields in original order.
	sliceFields := map[string][]string{
		"reference_images": nil,
		"reference_videos": nil,
		"reference_audios": nil,
	}
	for _, r := range results {
		switch r.job.field {
		case "first_image", "last_image":
			body[r.job.field] = r.ref
		case "reference_images", "reference_videos", "reference_audios":
			sliceFields[r.job.field] = append(sliceFields[r.job.field], r.ref)
		}
	}
	for k, vals := range sliceFields {
		if vals != nil {
			body[k] = vals
		}
	}
	return nil
}

func collectMediaJobs(body map[string]interface{}) []mediaJob {
	var jobs []mediaJob
	appendSlice := func(field, assetType string) {
		for i, u := range extractStringList(body[field]) {
			jobs = append(jobs, mediaJob{field: field, assetType: assetType, index: i, raw: u})
		}
	}
	appendSingle := func(field, assetType string) {
		if u := extractSingleString(body[field]); u != "" {
			jobs = append(jobs, mediaJob{field: field, assetType: assetType, index: -1, raw: u})
		}
	}
	appendSlice("reference_images", "Image")
	appendSlice("reference_videos", "Video")
	appendSlice("reference_audios", "Audio")
	appendSingle("first_image", "Image")
	appendSingle("last_image", "Image")
	return jobs
}

func ensureAssetRef(client *assetClient, assetType, raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", fmt.Errorf("empty media url")
	}
	if looksLikeDataURL(raw) || strings.HasPrefix(strings.ToLower(raw), "file:") {
		return "", fmt.Errorf("base64/local media is not supported; use a public URL or assetId://")
	}

	if looksLikeAssetRef(raw) {
		id := normalizeAssetID(raw)
		info, err := client.waitActive(id)
		if err != nil {
			return "", err
		}
		return toAssetRef(info.AssetID), nil
	}

	if !looksLikeHTTPURL(raw) {
		return "", fmt.Errorf("unsupported media reference %q; use http(s) URL or assetId://", raw)
	}

	uploaded, err := client.upload(assetType, raw, assetType+"-auto")
	if err != nil {
		return "", err
	}
	info, err := client.waitActive(uploaded.AssetID)
	if err != nil {
		return "", err
	}
	return toAssetRef(info.AssetID), nil
}

func extractStringList(v interface{}) []string {
	if v == nil {
		return nil
	}
	switch t := v.(type) {
	case []string:
		out := make([]string, 0, len(t))
		for _, s := range t {
			if u := strings.TrimSpace(s); u != "" {
				out = append(out, u)
			}
		}
		return out
	case []interface{}:
		out := make([]string, 0, len(t))
		for _, item := range t {
			if s, ok := item.(string); ok {
				if u := strings.TrimSpace(s); u != "" {
					out = append(out, u)
				}
			}
		}
		return out
	case string:
		if u := strings.TrimSpace(t); u != "" {
			return []string{u}
		}
	}
	return nil
}

func extractSingleString(v interface{}) string {
	list := extractStringList(v)
	if len(list) == 0 {
		return ""
	}
	return list[0]
}
