package image_stream

// Image-input normalization for /v1/images/edits multipart requests.
//
// Three accepted forms in the `image` / `image[]` / `image[N]` fields:
//   - multipart file upload  → read bytes, detect mime by magic, b64-encode
//   - http(s) URL            → fetch, validate content-type, b64-encode
//   - data:image/...;base64,... → pass through after format check
// Anything else is rejected with a 400.

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"path"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/service"
)

const (
	maxImageBytes        = 25 * 1024 * 1024 // 25 MiB per image
	maxImageTotalBytes   = 64 * 1024 * 1024
	maxImagesPerRequest  = 16
	imageFetchTimeoutSec = 20
)

var dataURIPrefix = regexp.MustCompile(`^data:(image/(?:png|jpeg|jpg|webp))(?:;[^,]*)?,`)

// NormalizedImage carries the data:URI form of an input image plus its mime,
// ready to be embedded in a /v1/responses input_image content part.
type NormalizedImage struct {
	DataURI string
	Mime    string
	Size    int64
}

// Decode returns the bounded raw image bytes represented by DataURI. Keeping
// this operation on the normalized value avoids each caller reimplementing an
// unbounded base64 decode.
func (image NormalizedImage) Decode() ([]byte, error) {
	comma := strings.IndexByte(image.DataURI, ',')
	if comma < 0 {
		return nil, errors.New("normalized image has an invalid data URI")
	}
	encoded := image.DataURI[comma+1:]
	if image.Size <= 0 || image.Size > maxImageBytes || len(encoded) > (maxImageBytes*4/3)+1024 {
		return nil, fmt.Errorf("normalized image exceeds %d bytes", maxImageBytes)
	}
	raw, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("decode normalized image: %w", err)
	}
	if int64(len(raw)) != image.Size {
		return nil, errors.New("normalized image size does not match decoded data")
	}
	return raw, nil
}

// CollectAndNormalizeImages walks the multipart form, extracts every
// image / image[] / image[N] entry (file or text), and returns the list of
// normalized data:URIs in the order encountered. Returns an error suitable
// for surfacing as a 400 if no valid image source exists or a fetch fails.
func CollectAndNormalizeImages(ctx context.Context, mf *multipart.Form) ([]NormalizedImage, error) {
	if mf == nil {
		return nil, errors.New("no multipart form data")
	}

	type pendingFile struct {
		fieldName string
		index     int
		fh        *multipart.FileHeader
	}
	type pendingValue struct {
		fieldName string
		index     int
		raw       string
	}

	var files []pendingFile
	var values []pendingValue

	for fieldName, fhs := range mf.File {
		if !isImageFieldName(fieldName) {
			continue
		}
		for i, fh := range fhs {
			files = append(files, pendingFile{fieldName, i, fh})
		}
	}
	for fieldName, vals := range mf.Value {
		if !isImageFieldName(fieldName) {
			continue
		}
		for i, v := range vals {
			if v == "" {
				continue
			}
			values = append(values, pendingValue{fieldName, i, v})
		}
	}

	if len(files)+len(values) == 0 {
		return nil, errors.New(`"image" field is required (file upload, http(s) URL, or data: URI)`)
	}
	if len(files)+len(values) > maxImagesPerRequest {
		return nil, fmt.Errorf("too many images: %d (max %d)", len(files)+len(values), maxImagesPerRequest)
	}

	var out []NormalizedImage
	var totalBytes int64

	for _, pf := range files {
		ni, err := normalizeFile(pf.fh)
		if err != nil {
			return nil, fmt.Errorf("image #%s[%d]: %w", pf.fieldName, pf.index, err)
		}
		if totalBytes+ni.Size > maxImageTotalBytes {
			return nil, fmt.Errorf("image inputs exceed %d total bytes", maxImageTotalBytes)
		}
		totalBytes += ni.Size
		out = append(out, ni)
	}
	for _, pv := range values {
		ni, err := normalizeStringValue(ctx, pv.raw)
		if err != nil {
			return nil, fmt.Errorf("image #%s[%d]: %w", pv.fieldName, pv.index, err)
		}
		if totalBytes+ni.Size > maxImageTotalBytes {
			return nil, fmt.Errorf("image inputs exceed %d total bytes", maxImageTotalBytes)
		}
		totalBytes += ni.Size
		out = append(out, ni)
	}
	return out, nil
}

func isImageFieldName(name string) bool {
	if name == "image" || name == "image[]" {
		return true
	}
	_, ok := indexedImageFieldNumber(name)
	return ok
}

func indexedImageFieldNumber(name string) (int, bool) {
	if !strings.HasPrefix(name, "image[") || !strings.HasSuffix(name, "]") {
		return 0, false
	}
	indexText := name[len("image[") : len(name)-1]
	if indexText == "" {
		return 0, false
	}
	index, err := strconv.Atoi(indexText)
	if err != nil || index < 0 || strconv.Itoa(index) != indexText {
		return 0, false
	}
	return index, true
}

func imageFieldStyle(name string) string {
	if _, ok := indexedImageFieldNumber(name); ok {
		return "image[N]"
	}
	return name
}

func normalizeStringValue(ctx context.Context, raw string) (NormalizedImage, error) {
	switch {
	case strings.HasPrefix(raw, "data:"):
		return normalizeDataURI(raw)
	case strings.HasPrefix(raw, "http://"), strings.HasPrefix(raw, "https://"):
		return fetchAndNormalize(ctx, raw)
	default:
		return NormalizedImage{}, errors.New("unrecognized image source (expected file, http(s) URL, or data:URI)")
	}
}

func normalizeDataURI(raw string) (NormalizedImage, error) {
	m := dataURIPrefix.FindStringSubmatch(raw)
	if m == nil {
		return NormalizedImage{}, errors.New("data URI must be image/png|jpeg|webp")
	}
	comma := strings.IndexByte(raw, ',')
	if comma < 0 || !strings.Contains(strings.ToLower(raw[:comma]), ";base64") {
		return NormalizedImage{}, errors.New("data URI must use base64 encoding")
	}
	encoded := raw[comma+1:]
	if len(encoded) > (maxImageBytes*4/3)+1024 {
		return NormalizedImage{}, fmt.Errorf("image too large: >%d bytes", maxImageBytes)
	}
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return NormalizedImage{}, fmt.Errorf("invalid image data URI: %w", err)
	}
	if len(decoded) > maxImageBytes {
		return NormalizedImage{}, fmt.Errorf("image too large: >%d bytes", maxImageBytes)
	}
	if len(decoded) == 0 {
		return NormalizedImage{}, errors.New("empty image data URI")
	}
	mime := strings.ToLower(m[1])
	if mime == "image/jpg" {
		mime = "image/jpeg"
	}
	return NormalizedImage{DataURI: raw, Mime: mime, Size: int64(len(decoded))}, nil
}

func fetchAndNormalize(ctx context.Context, url string) (NormalizedImage, error) {
	fetchCtx, cancel := context.WithTimeout(ctx, imageFetchTimeoutSec*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(fetchCtx, "GET", url, nil)
	if err != nil {
		return NormalizedImage{}, fmt.Errorf("build url request: %w", err)
	}
	if err := service.ValidateSSRFProtectedFetchURL(url); err != nil {
		return NormalizedImage{}, fmt.Errorf("image url is not allowed: %w", err)
	}
	resp, err := service.GetDirectSSRFProtectedHTTPClient().Do(req)
	if err != nil {
		return NormalizedImage{}, fmt.Errorf("fetch image url: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return NormalizedImage{}, fmt.Errorf("image url returned %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxImageBytes+1))
	if err != nil {
		return NormalizedImage{}, fmt.Errorf("read image body: %w", err)
	}
	if len(body) > maxImageBytes {
		return NormalizedImage{}, fmt.Errorf("image too large: >%d bytes", maxImageBytes)
	}

	mime := pickMime(resp.Header.Get("Content-Type"), body)
	if mime == "" {
		return NormalizedImage{}, errors.New("image url content-type unsupported (need png/jpeg/webp)")
	}
	return NormalizedImage{
		DataURI: "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(body),
		Mime:    mime,
		Size:    int64(len(body)),
	}, nil
}

func normalizeFile(fh *multipart.FileHeader) (NormalizedImage, error) {
	if fh.Size > maxImageBytes {
		return NormalizedImage{}, fmt.Errorf("image too large: %d bytes (max %d)", fh.Size, maxImageBytes)
	}
	f, err := fh.Open()
	if err != nil {
		return NormalizedImage{}, fmt.Errorf("open uploaded file: %w", err)
	}
	defer f.Close()

	body, err := io.ReadAll(io.LimitReader(f, maxImageBytes+1))
	if err != nil {
		return NormalizedImage{}, fmt.Errorf("read uploaded file: %w", err)
	}
	if len(body) > maxImageBytes {
		return NormalizedImage{}, fmt.Errorf("image too large: >%d bytes", maxImageBytes)
	}
	if len(body) == 0 {
		return NormalizedImage{}, errors.New("empty image file")
	}

	mime := pickMime(fh.Header.Get("Content-Type"), body)
	if mime == "" {
		// Fall back to filename extension as a last resort
		mime = mimeFromExt(fh.Filename)
	}
	if mime == "" {
		return NormalizedImage{}, errors.New("unsupported image type (need png/jpeg/webp)")
	}
	return NormalizedImage{
		DataURI: "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(body),
		Mime:    mime,
		Size:    int64(len(body)),
	}, nil
}

// pickMime decides on a mime type using both the declared Content-Type and
// the actual magic bytes. Magic bytes win when they conflict — clients
// occasionally lie about Content-Type.
func pickMime(declaredCT string, body []byte) string {
	declared := strings.ToLower(declaredCT)
	declared = strings.TrimSpace(strings.SplitN(declared, ";", 2)[0])

	switch sniffMagic(body) {
	case "png":
		return "image/png"
	case "jpg":
		return "image/jpeg"
	case "webp":
		return "image/webp"
	}

	switch declared {
	case "image/png":
		return "image/png"
	case "image/jpeg", "image/jpg":
		return "image/jpeg"
	case "image/webp":
		return "image/webp"
	}
	return ""
}

func sniffMagic(b []byte) string {
	if len(b) >= 8 && b[0] == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G' {
		return "png"
	}
	if len(b) >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF {
		return "jpg"
	}
	if len(b) >= 12 && bytes.Equal(b[0:4], []byte("RIFF")) && bytes.Equal(b[8:12], []byte("WEBP")) {
		return "webp"
	}
	return ""
}

func mimeFromExt(filename string) string {
	switch strings.ToLower(path.Ext(filename)) {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".webp":
		return "image/webp"
	}
	return ""
}
