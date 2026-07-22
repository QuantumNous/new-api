package facepass

import (
	"fmt"
	"io"
	"mime/multipart"
	"strings"
)

// CollectImageURLs gathers unique http(s) image URLs from body keys.
func CollectImageURLs(body map[string]interface{}, keys []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0)
	add := func(u string) {
		u = strings.TrimSpace(u)
		if u == "" || !strings.HasPrefix(strings.ToLower(u), "http") {
			return
		}
		if _, ok := seen[u]; ok {
			return
		}
		seen[u] = struct{}{}
		out = append(out, u)
	}
	if body == nil {
		return out
	}
	for _, key := range keys {
		v, ok := body[key]
		if !ok {
			continue
		}
		switch t := v.(type) {
		case string:
			add(t)
		case []string:
			for _, s := range t {
				add(s)
			}
		case []interface{}:
			for _, item := range t {
				if s, ok := item.(string); ok {
					add(s)
				}
			}
		}
	}
	return out
}

// CollectMultipartImageBlobs reads image file parts from multipart form for the given keys.
func CollectMultipartImageBlobs(form *multipart.Form, keys []string) ([][]byte, error) {
	if form == nil {
		return nil, nil
	}
	out := make([][]byte, 0)
	for _, key := range keys {
		for _, fh := range form.File[key] {
			if fh == nil {
				continue
			}
			ct := strings.ToLower(fh.Header.Get("Content-Type"))
			name := strings.ToLower(fh.Filename)
			if ct != "" && !strings.HasPrefix(ct, "image/") && ct != "application/octet-stream" {
				continue
			}
			if ct == "" && !looksLikeImageName(name) {
				continue
			}
			f, err := fh.Open()
			if err != nil {
				return nil, err
			}
			data, err := io.ReadAll(io.LimitReader(f, 20<<20+1))
			f.Close()
			if err != nil {
				return nil, err
			}
			if len(data) > 20<<20 {
				return nil, fmt.Errorf("multipart image too large")
			}
			if len(data) > 0 {
				out = append(out, data)
			}
		}
	}
	return out, nil
}

func looksLikeImageName(name string) bool {
	for _, ext := range []string{".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"} {
		if strings.HasSuffix(name, ext) {
			return true
		}
	}
	return false
}
