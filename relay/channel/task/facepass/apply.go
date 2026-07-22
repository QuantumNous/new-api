package facepass

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
)

const FaceDetectAPI = "https://face.83zi.com/api/detect"

// Process downloads URL images (if any), preprocesses all items to WebP, uploads to Face API,
// and returns processed https URLs in order (multipart blobs first, then URLs).
func Process(fileBlobs [][]byte, urls []string, proxy string, opts Options, logPrefix string) ([]string, error) {
	opts = NormalizeOptions(opts)
	if logPrefix == "" {
		logPrefix = "face_pass"
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
	common.SysLog(fmt.Sprintf("[%s] input image urls=%d: %s", logPrefix, len(urls), strings.Join(urls, " | ")))
	for _, u := range urls {
		data, err := downloadImageBytes(u, logPrefix)
		if err != nil {
			return nil, fmt.Errorf("download image %s: %w", u, err)
		}
		items = append(items, item{data: data, from: u})
	}

	if len(items) == 0 {
		common.SysLog(fmt.Sprintf("[%s] no images to process", logPrefix))
		return nil, nil
	}

	common.SysLog(fmt.Sprintf("[%s] start count=%d multipart=%d urls=%d singleEye=%v size=%d",
		logPrefix, len(items), len(fileBlobs), len(urls), opts.SingleEye, opts.Size))

	outURLs := make([]string, 0, len(items))
	for i, it := range items {
		webpBytes, err := PreprocessToWebP(it.data)
		if err != nil {
			common.SysLog(fmt.Sprintf("[%s] preprocess fail index=%d from=%s err=%v", logPrefix, i, Truncate(it.from, 120), err))
			return nil, fmt.Errorf("preprocess image[%d] (%s): %w", i, it.from, err)
		}
		url, err := uploadFaceDetect(webpBytes, proxy, opts)
		if err != nil {
			common.SysLog(fmt.Sprintf("[%s] upload fail index=%d from=%s err=%v", logPrefix, i, Truncate(it.from, 120), err))
			return nil, fmt.Errorf("face detect image[%d] (%s): %w", i, it.from, err)
		}
		common.SysLog(fmt.Sprintf("[%s] ok index=%d/%d from=%s out=%s", logPrefix, i+1, len(items), it.from, url))
		outURLs = append(outURLs, url)
	}
	common.SysLog(fmt.Sprintf("[%s] done count=%d out=%s", logPrefix, len(outURLs), strings.Join(outURLs, " | ")))
	return outURLs, nil
}

func downloadImageBytes(rawURL, logPrefix string) ([]byte, error) {
	resp, err := service.DoDownloadRequest(rawURL, logPrefix)
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

func uploadFaceDetect(webpBytes []byte, proxy string, opts Options) (string, error) {
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
	if !opts.SingleEye {
		singleEyeVal = "0"
	}
	if err := w.WriteField("singleEye", singleEyeVal); err != nil {
		return "", err
	}
	if err := w.WriteField("size", fmt.Sprintf("%d", opts.Size)); err != nil {
		return "", err
	}
	if err := w.Close(); err != nil {
		return "", err
	}

	req, err := http.NewRequest(http.MethodPost, FaceDetectAPI, &buf)
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
		return "", fmt.Errorf("face API HTTP %d: %s", resp.StatusCode, Truncate(string(body), 300))
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

// Truncate shortens s for logs.
func Truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
