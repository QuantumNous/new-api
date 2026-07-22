package sora

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel/task/facepass"
	"github.com/QuantumNous/new-api/service"
)

var openaiImageURLBodyKeys = []string{
	"images", "image", "input_reference", "referenceImages", "reference_images",
}

var openaiMultipartImageKeys = []string{
	"input_reference", "image", "images", "reference_images", "referenceImages", "file",
}

func openaiFacePassEnabled(settings dto.ChannelOtherSettings) bool {
	return facepass.BoolDefaultTrue(settings.OpenaiFacePass)
}

func openaiFaceOptsFromSettings(settings dto.ChannelOtherSettings) facepass.Options {
	return facepass.NormalizeOptions(facepass.Options{
		SingleEye: facepass.BoolDefaultTrue(settings.OpenaiFaceSingleEye),
		Size:      facepass.ClampSize(settings.OpenaiFaceSize),
	})
}

// applyOpenaiFacePassJSON processes images in bodyMap and rewrites URL fields.
func applyOpenaiFacePassJSON(bodyMap map[string]interface{}, proxy string, opts facepass.Options) error {
	if bodyMap == nil {
		return nil
	}
	urls := facepass.CollectImageURLs(bodyMap, openaiImageURLBodyKeys)
	outURLs, err := facepass.Process(nil, urls, proxy, opts, "openai_face_pass")
	if err != nil {
		return err
	}
	if len(outURLs) == 0 {
		return nil
	}
	rewriteJSONImageURLs(bodyMap, outURLs)
	return nil
}

func rewriteJSONImageURLs(bodyMap map[string]interface{}, outURLs []string) {
	hadImagesArray := false
	if v, ok := bodyMap["images"]; ok {
		switch v.(type) {
		case []interface{}, []string:
			hadImagesArray = true
		}
	}
	hadInputRef := false
	if _, ok := bodyMap["input_reference"]; ok {
		hadInputRef = true
	}

	for _, key := range openaiImageURLBodyKeys {
		delete(bodyMap, key)
	}

	if hadImagesArray || len(outURLs) > 1 || !hadInputRef {
		bodyMap["images"] = outURLs
		return
	}
	bodyMap["input_reference"] = outURLs[0]
}

// applyOpenaiFacePassMultipart processes multipart images and rebuilds the form.
// Returns (nil, "", nil) when there is nothing to process.
func applyOpenaiFacePassMultipart(form *multipart.Form, proxy string, opts facepass.Options, upstreamModel string) (io.Reader, string, error) {
	bodyMap := multipartFormValuesToMap(form)
	urls := facepass.CollectImageURLs(bodyMap, openaiImageURLBodyKeys)
	blobs, err := facepass.CollectMultipartImageBlobs(form, openaiMultipartImageKeys)
	if err != nil {
		return nil, "", err
	}
	if len(urls) == 0 && len(blobs) == 0 {
		common.SysLog("[openai_face_pass] multipart skipped; no images")
		return nil, "", nil
	}
	common.SysLog(fmt.Sprintf("[openai_face_pass] multipart facePass=true singleEye=%v size=%d image_urls=%d blobs=%d",
		opts.SingleEye, opts.Size, len(urls), len(blobs)))
	outURLs, err := facepass.Process(blobs, urls, proxy, opts, "openai_face_pass")
	if err != nil {
		return nil, "", err
	}
	if len(outURLs) == 0 {
		return nil, "", nil
	}

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	for key, values := range form.Value {
		if key == "model" || isOpenaiImageURLField(key) {
			continue
		}
		for _, v := range values {
			_ = writer.WriteField(key, v)
		}
	}
	if upstreamModel != "" {
		_ = writer.WriteField("model", upstreamModel)
	}

	hasSeconds := len(form.Value["seconds"]) > 0
	durationVal := ""
	if vals := form.Value["duration"]; len(vals) > 0 {
		durationVal = strings.TrimSpace(vals[0])
	}
	if !hasSeconds && durationVal != "" {
		_ = writer.WriteField("seconds", durationVal)
	}
	if len(form.Value["duration"]) == 0 {
		if secs := form.Value["seconds"]; len(secs) > 0 && strings.TrimSpace(secs[0]) != "" {
			_ = writer.WriteField("duration", strings.TrimSpace(secs[0]))
		}
	}

	for i, u := range outURLs {
		data, err := downloadProcessedImage(u)
		if err != nil {
			_ = writer.Close()
			return nil, "", fmt.Errorf("download face-pass result[%d]: %w", i, err)
		}
		filename := fmt.Sprintf("ref_%d.webp", i)
		h := make(textproto.MIMEHeader)
		h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="input_reference"; filename="%s"`, filename))
		h.Set("Content-Type", "image/webp")
		part, err := writer.CreatePart(h)
		if err != nil {
			_ = writer.Close()
			return nil, "", err
		}
		if _, err := part.Write(data); err != nil {
			_ = writer.Close()
			return nil, "", err
		}
		_ = writer.WriteField("images", u)
	}

	for fieldName, fileHeaders := range form.File {
		if isOpenaiImageFileField(fieldName) {
			continue
		}
		for _, fh := range fileHeaders {
			if fh == nil {
				continue
			}
			f, err := fh.Open()
			if err != nil {
				continue
			}
			ct := fh.Header.Get("Content-Type")
			h := make(textproto.MIMEHeader)
			h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, fieldName, fh.Filename))
			if ct != "" {
				h.Set("Content-Type", ct)
			}
			part, err := writer.CreatePart(h)
			if err != nil {
				f.Close()
				continue
			}
			_, _ = io.Copy(part, f)
			f.Close()
		}
	}

	if err := writer.Close(); err != nil {
		return nil, "", err
	}
	return &buf, writer.FormDataContentType(), nil
}

func multipartFormValuesToMap(form *multipart.Form) map[string]interface{} {
	out := map[string]interface{}{}
	if form == nil {
		return out
	}
	for key, values := range form.Value {
		if len(values) == 0 {
			continue
		}
		if isOpenaiImageURLField(key) && len(values) > 1 {
			cp := make([]string, len(values))
			copy(cp, values)
			out[key] = cp
			continue
		}
		out[key] = values[0]
	}
	return out
}

func isOpenaiImageURLField(key string) bool {
	switch key {
	case "images", "image", "input_reference", "referenceImages", "reference_images":
		return true
	default:
		return false
	}
}

func isOpenaiImageFileField(key string) bool {
	switch key {
	case "input_reference", "image", "images", "reference_images", "referenceImages", "file":
		return true
	default:
		return false
	}
}

func downloadProcessedImage(rawURL string) ([]byte, error) {
	resp, err := service.DoDownloadRequest(rawURL, "openai_face_pass")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	const maxBytes = 20 << 20
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxBytes+1))
	if err != nil {
		return nil, err
	}
	if len(data) > maxBytes {
		return nil, fmt.Errorf("image exceeds %d bytes", maxBytes)
	}
	return data, nil
}

func hasJSONImages(bodyMap map[string]interface{}) bool {
	return len(facepass.CollectImageURLs(bodyMap, openaiImageURLBodyKeys)) > 0
}

// multipartHasImages reports whether form has image files or image URL fields.
func multipartHasImages(form *multipart.Form) bool {
	if form == nil {
		return false
	}
	bodyMap := multipartFormValuesToMap(form)
	if len(facepass.CollectImageURLs(bodyMap, openaiImageURLBodyKeys)) > 0 {
		return true
	}
	for _, key := range openaiMultipartImageKeys {
		if len(form.File[key]) > 0 {
			return true
		}
	}
	return false
}
