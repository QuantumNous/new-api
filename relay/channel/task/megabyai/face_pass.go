package megabyai

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/service"
)

const faceDetectAPI = "https://face.83zi.com/api/detect"

var imageURLBodyKeys = []string{
	"referenceImages", "images", "image", "input_reference",
}

// megabyaiFacePassEnabled: nil/true => on; false => off.
func megabyaiFacePassEnabled(settings dto.ChannelOtherSettings) bool {
	if settings.MegabyaiFacePass == nil {
		return true
	}
	return *settings.MegabyaiFacePass
}

// megabyaiFaceSingleEye: nil/true => single eye (API default); false => both eyes.
func megabyaiFaceSingleEye(settings dto.ChannelOtherSettings) bool {
	if settings.MegabyaiFaceSingleEye == nil {
		return true
	}
	return *settings.MegabyaiFaceSingleEye
}

// megabyaiFaceSize: nil/out-of-range => 5; clamp to 1–10.
func megabyaiFaceSize(settings dto.ChannelOtherSettings) int {
	if settings.MegabyaiFaceSize == nil {
		return 5
	}
	n := *settings.MegabyaiFaceSize
	if n < 1 {
		return 1
	}
	if n > 10 {
		return 10
	}
	return n
}

type facePassOptions struct {
	singleEye bool
	size      int
}

func facePassOptionsFromSettings(settings dto.ChannelOtherSettings) facePassOptions {
	return facePassOptions{
		singleEye: megabyaiFaceSingleEye(settings),
		size:      megabyaiFaceSize(settings),
	}
}

// applyFacePass downloads/reads reference images, locally preprocesses to WebP
// (max long edge 1600), uploads to face.83zi.com, and replaces body referenceImages.
func applyFacePass(body map[string]interface{}, fileBlobs [][]byte, proxy string, opts facePassOptions) error {
	if body == nil {
		body = map[string]interface{}{}
	}

	type item struct {
		data []byte
		from string
	}
	items := make([]item, 0)

	for _, blob := range fileBlobs {
		if len(blob) == 0 {
			continue
		}
		items = append(items, item{data: blob, from: "multipart"})
	}

	urls := collectImageURLs(body)
	common.SysLog(fmt.Sprintf("[megabyai_face_pass] input image urls=%d: %s", len(urls), strings.Join(urls, " | ")))
	for _, u := range urls {
		data, err := downloadImageBytes(u, proxy)
		if err != nil {
			return fmt.Errorf("download image %s: %w", u, err)
		}
		items = append(items, item{data: data, from: u})
	}

	if len(items) == 0 {
		common.SysLog("[megabyai_face_pass] no images to process")
		return nil
	}

	common.SysLog(fmt.Sprintf("[megabyai_face_pass] start count=%d multipart=%d urls=%d singleEye=%v size=%d",
		len(items), len(fileBlobs), len(urls), opts.singleEye, opts.size))

	outURLs := make([]string, 0, len(items))
	for i, it := range items {
		webpBytes, err := preprocessToWebP(it.data)
		if err != nil {
			common.SysLog(fmt.Sprintf("[megabyai_face_pass] preprocess fail index=%d from=%s err=%v", i, truncate(it.from, 120), err))
			return fmt.Errorf("preprocess image[%d] (%s): %w", i, it.from, err)
		}
		url, err := uploadFaceDetect(webpBytes, proxy, opts)
		if err != nil {
			common.SysLog(fmt.Sprintf("[megabyai_face_pass] upload fail index=%d from=%s err=%v", i, truncate(it.from, 120), err))
			return fmt.Errorf("face detect image[%d] (%s): %w", i, it.from, err)
		}
		common.SysLog(fmt.Sprintf("[megabyai_face_pass] ok index=%d/%d from=%s out=%s", i+1, len(items), it.from, url))
		outURLs = append(outURLs, url)
	}

	// Replace with processed URLs only.
	for _, key := range imageURLBodyKeys {
		delete(body, key)
	}
	body["referenceImages"] = outURLs
	common.SysLog(fmt.Sprintf("[megabyai_face_pass] done count=%d referenceImages=%s", len(outURLs), strings.Join(outURLs, " | ")))
	return nil
}

func collectImageURLs(body map[string]interface{}) []string {
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
	for _, key := range imageURLBodyKeys {
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

func downloadImageBytes(rawURL, _ string) ([]byte, error) {
	resp, err := service.DoDownloadRequest(rawURL, "megabyai_face_pass")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	const maxBytes = 20 << 20 // 20MB
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxBytes+1))
	if err != nil {
		return nil, err
	}
	if len(data) > maxBytes {
		return nil, fmt.Errorf("image exceeds %d bytes", maxBytes)
	}
	return data, nil
}

func uploadFaceDetect(webpBytes []byte, proxy string, opts facePassOptions) (string, error) {
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	part, err := w.CreateFormFile("image", "ref.webp")
	if err != nil {
		return "", err
	}
	if _, err := part.Write(webpBytes); err != nil {
		return "", err
	}
	singleEyeVal := "1"
	if !opts.singleEye {
		singleEyeVal = "0"
	}
	if err := w.WriteField("singleEye", singleEyeVal); err != nil {
		return "", err
	}
	if err := w.WriteField("size", fmt.Sprintf("%d", opts.size)); err != nil {
		return "", err
	}
	if err := w.Close(); err != nil {
		return "", err
	}

	req, err := http.NewRequest(http.MethodPost, faceDetectAPI, &buf)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", w.FormDataContentType())

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return "", err
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("face API HTTP %d: %s", resp.StatusCode, truncate(string(body), 300))
	}
	var parsed map[string]interface{}
	if err := common.Unmarshal(body, &parsed); err != nil {
		return "", fmt.Errorf("face API invalid JSON: %w", err)
	}
	if ok, _ := parsed["ok"].(bool); !ok {
		errMsg, _ := parsed["error"].(string)
		if errMsg == "" {
			errMsg = string(body)
		}
		return "", fmt.Errorf("face API error: %s", errMsg)
	}
	url, _ := parsed["url"].(string)
	url = strings.TrimSpace(url)
	if url == "" {
		return "", fmt.Errorf("face API missing url")
	}
	// Face API may return http://; force https for upstream fetch.
	if strings.HasPrefix(strings.ToLower(url), "http://") {
		url = "https://" + url[len("http://"):]
	}
	return url, nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

// collectMultipartImageBlobs reads image file parts from multipart form.
func collectMultipartImageBlobs(form *multipart.Form) ([][]byte, error) {
	if form == nil {
		return nil, nil
	}
	keys := []string{"image", "images", "input_reference", "referenceImages", "file"}
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
