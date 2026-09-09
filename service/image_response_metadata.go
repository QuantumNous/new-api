package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	_ "golang.org/x/image/webp"
)

const imageMetadataHeaderLimit = 512 << 10

// NormalizeImageJSONResponse supplements successful Images JSON without changing
// image payloads, upstream extensions, or the usage used for billing.
func NormalizeImageJSONResponse(ctx context.Context, body []byte) []byte {
	var response map[string]json.RawMessage
	if common.Unmarshal(body, &response) != nil || response == nil {
		return body
	}
	var items []map[string]json.RawMessage
	if common.Unmarshal(response["data"], &items) != nil || items == nil {
		return body
	}
	for _, item := range items {
		if item == nil {
			return body
		}
	}
	ctx, cancel := context.WithTimeout(ctx, 4*time.Second)
	defer cancel()
	sharedSize, sharedFormat := "", ""
	for i, item := range items {
		width, height, format := 0, 0, ""
		if i < dto.MaxImageN {
			width, height, format = imageResponseMetadata(ctx, item)
		}
		var sizeValue, widthValue, heightValue, formatValue any
		size := ""
		if width > 0 && height > 0 && format != "" {
			size = fmt.Sprintf("%dx%d", width, height)
			sizeValue, widthValue, heightValue, formatValue = size, width, height, format
		}
		for key, value := range map[string]any{"width": widthValue, "height": heightValue, "size": sizeValue, "output_format": formatValue} {
			item[key], _ = common.Marshal(value)
		}
		for _, key := range []string{"url", "b64_json", "revised_prompt"} {
			if _, exists := item[key]; !exists {
				item[key] = json.RawMessage("null")
			}
		}
		if i == 0 {
			sharedSize, sharedFormat = size, format
		} else {
			if sharedSize != size {
				sharedSize = ""
			}
			if sharedFormat != format {
				sharedFormat = ""
			}
		}
	}
	for _, key := range []string{"created", "size", "output_format", "quality", "background", "usage"} {
		if _, exists := response[key]; !exists {
			response[key] = json.RawMessage("null")
		}
	}
	// Size always describes the decoded files, never the request or an upstream claim.
	response["size"] = json.RawMessage("null")
	if sharedSize != "" {
		response["size"], _ = common.Marshal(sharedSize)
	}
	response["output_format"] = json.RawMessage("null")
	if sharedFormat != "" {
		response["output_format"], _ = common.Marshal(sharedFormat)
	}
	var err error
	response["data"], err = common.Marshal(items)
	if err != nil {
		return body
	}
	result, err := common.Marshal(response)
	if err != nil {
		return body
	}
	return result
}

func imageResponseMetadata(ctx context.Context, item map[string]json.RawMessage) (int, int, string) {
	var encoded, location string
	_ = common.Unmarshal(item["b64_json"], &encoded)
	_ = common.Unmarshal(item["url"], &location)
	if encoded != "" {
		reader := base64.NewDecoder(base64.StdEncoding, strings.NewReader(encoded))
		config, format, err := image.DecodeConfig(io.LimitReader(reader, MaxDrawingBytes))
		if err == nil {
			return config.Width, config.Height, format
		}
	}
	if ctx.Err() != nil || location == "" {
		return 0, 0, ""
	}
	response, err := requestImageResponse(ctx, location, true)
	if err != nil {
		return 0, 0, ""
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK && response.StatusCode != http.StatusPartialContent {
		return 0, 0, ""
	}
	config, format, err := image.DecodeConfig(io.LimitReader(response.Body, imageMetadataHeaderLimit))
	if err != nil {
		return 0, 0, ""
	}
	return config.Width, config.Height, format
}

func requestImageResponse(ctx context.Context, location string, headerOnly bool) (*http.Response, error) {
	u, err := url.Parse(location)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.User != nil {
		return nil, errors.New("invalid image URL")
	}
	if ValidateSSRFProtectedFetchURL(location) != nil {
		return nil, errors.New("image URL is blocked by the fetch policy")
	}
	client := GetSSRFProtectedHTTPClient()
	if client == nil {
		return nil, errors.New("image download client unavailable")
	}
	fetchClient := *client
	fetchClient.Jar = nil
	fetchClient.CheckRedirect = func(next *http.Request, via []*http.Request) error {
		next.Header.Del("Referer")
		next.Header.Del("Authorization")
		next.Header.Del("Cookie")
		if client.CheckRedirect != nil {
			return client.CheckRedirect(next, via)
		}
		if len(via) >= 10 {
			return http.ErrUseLastResponse
		}
		return nil
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, location, nil)
	if err != nil {
		return nil, errors.New("invalid image download request")
	}
	if headerOnly {
		request.Header.Set("Range", fmt.Sprintf("bytes=0-%d", imageMetadataHeaderLimit-1))
	}
	request.Header.Set("Accept", "image/*")
	request.Header.Set("User-Agent", "Mozilla/5.0 (compatible; NewAPI-ImageMetadata/1.0)")
	// Never forward the channel key, caller headers, or cookies to an image URL.
	response, err := fetchClient.Do(request)
	if err != nil {
		return nil, errors.New("image download failed or timed out")
	}
	return response, nil
}
