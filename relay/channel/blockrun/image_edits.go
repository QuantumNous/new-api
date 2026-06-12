package blockrun

import (
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/dto"

	"github.com/gin-gonic/gin"
)

// maxImageEditImages caps the number of source images accepted per edit request,
// matching OpenAI's gpt-image-1 limit. The request body itself is already bounded
// by MaxRequestBodyMB (DecompressRequestMiddleware) and each file by
// maxImageBodyBytes; this is the per-request count guard on top of those — it
// also returns a clear client error instead of silently fusing dozens of images.
const maxImageEditImages = 16

// buildImage2ImageEditBody converts a standard OpenAI multipart/form-data image
// edit request into BlockRun's /v1/images/image2image JSON body. The client
// uploads binary files exactly like the official OpenAI images.edit() SDK call
// (image / image[] / mask); we read them, base64-encode to data URIs, and carry
// every other text form field (prompt, size, quality, …) through. model is the
// post-mapping name from request. One OpenAI-compatible interface across all
// image channels.
func buildImage2ImageEditBody(c *gin.Context, request *dto.ImageRequest) (any, error) {
	if c == nil || c.Request == nil {
		return nil, errors.New("blockrun: image2image requires a multipart/form-data request")
	}
	mf := c.Request.MultipartForm
	if mf == nil {
		if _, err := c.MultipartForm(); err != nil {
			return nil, errors.New("blockrun: image2image requires multipart/form-data with an `image` file")
		}
		mf = c.Request.MultipartForm
	}
	if mf == nil || mf.File == nil {
		return nil, errors.New("blockrun: image2image requires an `image` file (multipart/form-data)")
	}

	imageFiles := collectMultipartFiles(mf, "image")
	if len(imageFiles) == 0 {
		return nil, errors.New("blockrun: image2image requires at least one `image` file")
	}
	if len(imageFiles) > maxImageEditImages {
		return nil, fmt.Errorf("blockrun: image2image accepts at most %d source images, got %d", maxImageEditImages, len(imageFiles))
	}
	imageURIs, err := multipartFilesToDataURIs(imageFiles)
	if err != nil {
		return nil, err
	}

	var maskURI string
	if maskFiles := collectMultipartFiles(mf, "mask"); len(maskFiles) > 0 {
		uris, merr := multipartFilesToDataURIs(maskFiles[:1])
		if merr != nil {
			return nil, merr
		}
		maskURI = uris[0]
	}
	if maskURI != "" && len(imageURIs) > 1 {
		return nil, errors.New("blockrun: `mask` cannot be combined with multiple source images")
	}

	body := map[string]any{}
	for k, vs := range mf.Value {
		if len(vs) == 0 {
			continue
		}
		switch k {
		case "model", "image", "mask", "stream", "partial_images", "n", "watermark":
			// model/image/mask set explicitly below; stream/partial_images must
			// not leak upstream; n/watermark are NON-string — forwarding the raw
			// form value would send "n":"2" / "watermark":"true". They are set
			// from the typed request fields (parsed in valid_request.go) so the
			// upstream wire types match the generations path.
			continue
		}
		body[k] = vs[0]
	}
	body["model"] = request.Model // post model-mapping name
	if request.N != nil {
		body["n"] = *request.N
	}
	if request.Watermark != nil {
		body["watermark"] = *request.Watermark
	}
	if len(imageURIs) == 1 {
		body["image"] = imageURIs[0]
	} else {
		body["image"] = imageURIs
	}
	if maskURI != "" {
		body["mask"] = maskURI
	}
	return body, nil
}

// collectMultipartFiles gathers files posted under `field`, `field[]`, or
// `field[N]` (OpenAI array notation), in deterministic fusion order. Indexed
// `field[N]` names are ordered by their NUMERIC index, not lexicographically, so
// `image[10]` follows `image[2]` (a plain string sort would invert them and
// scramble multi-image fusion order). Non-numeric indices fall back to a stable
// lexicographic order and sort after the numeric ones.
func collectMultipartFiles(mf *multipart.Form, field string) []*multipart.FileHeader {
	var out []*multipart.FileHeader
	out = append(out, mf.File[field]...)
	out = append(out, mf.File[field+"[]"]...)
	var bracket []string
	for name := range mf.File {
		if name != field+"[]" && strings.HasPrefix(name, field+"[") && strings.HasSuffix(name, "]") {
			bracket = append(bracket, name)
		}
	}
	sort.SliceStable(bracket, func(i, j int) bool {
		ni, oki := bracketIndex(field, bracket[i])
		nj, okj := bracketIndex(field, bracket[j])
		if oki && okj {
			return ni < nj
		}
		if oki != okj {
			return oki // numeric indices sort before non-numeric ones
		}
		return bracket[i] < bracket[j] // both non-numeric: stable lexicographic
	})
	for _, name := range bracket {
		out = append(out, mf.File[name]...)
	}
	return out
}

// bracketIndex extracts N from a "field[N]" form name. It returns (N, true) only
// when N is a non-negative base-10 integer; any other inner value (empty,
// negative, non-numeric) yields (0, false) so the caller can fall back to a
// lexicographic ordering.
func bracketIndex(field, name string) (int, bool) {
	inner := strings.TrimSuffix(strings.TrimPrefix(name, field+"["), "]")
	if inner == "" {
		return 0, false
	}
	n, err := strconv.Atoi(inner)
	if err != nil || n < 0 {
		return 0, false
	}
	return n, true
}

// multipartFilesToDataURIs reads each uploaded file (bounded by maxImageBodyBytes)
// and returns a base64 data URI per file.
func multipartFilesToDataURIs(files []*multipart.FileHeader) ([]string, error) {
	out := make([]string, 0, len(files))
	for i, fh := range files {
		f, oerr := fh.Open()
		if oerr != nil {
			return nil, fmt.Errorf("blockrun: open image file %d: %w", i, oerr)
		}
		data, rerr := io.ReadAll(io.LimitReader(f, maxImageBodyBytes+1))
		_ = f.Close()
		if rerr != nil {
			return nil, fmt.Errorf("blockrun: read image file %d: %w", i, rerr)
		}
		if len(data) == 0 {
			return nil, fmt.Errorf("blockrun: image file %d is empty", i)
		}
		if len(data) > maxImageBodyBytes {
			return nil, fmt.Errorf("blockrun: image file %d exceeds %d bytes", i, maxImageBodyBytes)
		}
		mimeType := fh.Header.Get("Content-Type")
		if mimeType == "" {
			mimeType = http.DetectContentType(data)
		}
		if !strings.HasPrefix(mimeType, "image/") {
			// A missing/unsniffable type yields application/octet-stream, which
			// an image model rejects. Default to PNG (the upstream re-encodes).
			mimeType = "image/png"
		}
		out = append(out, "data:"+mimeType+";base64,"+base64.StdEncoding.EncodeToString(data))
	}
	return out, nil
}
