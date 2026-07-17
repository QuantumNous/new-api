package image_stream

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/service"
)

const (
	maxStoredGenericImageBytes      int64 = 32 << 20
	maxStoredGenericImageTotalBytes int64 = 40 << 20
)

type genericImageHTTPClient interface {
	Do(*http.Request) (*http.Response, error)
}

type genericImagePutFunc func(context.Context, []byte, string) (string, string, error)

type genericImageMaterializationLimits struct {
	maxImages     int
	maxImageBytes int64
	maxTotalBytes int64
}

var errEmptyGenericImageData = errors.New("image data is empty")

var defaultGenericImageMaterializationLimits = genericImageMaterializationLimits{
	maxImages:     dto.MaxImageN,
	maxImageBytes: maxStoredGenericImageBytes,
	maxTotalBytes: maxStoredGenericImageTotalBytes,
}

var defaultGenericImageStorageLimits = genericImageMaterializationLimits{
	maxImages:     dto.MaxImageN,
	maxImageBytes: maxStoredGenericImageBytes,
}

var getGenericImageSourceClient = func() genericImageHTTPClient {
	return service.GetDirectSSRFProtectedHTTPClient()
}

type genericImageSourceError struct {
	err error
}

func (e *genericImageSourceError) Error() string { return e.err.Error() }

func (e *genericImageSourceError) Unwrap() error { return e.err }

// buildStoredGenericImageResponse replaces every provider image source with a
// content-addressed R2 URL. The input envelope is left untouched so callers can
// persist and retry the provider result independently from object storage.
func buildStoredGenericImageResponse(ctx context.Context, response *dto.ImageResponse) (*dto.ImageResponse, error) {
	r2 := LoadR2Config()
	if !r2.Enabled() {
		return nil, &imageStorageError{
			err:       errors.New("image object storage is not configured"),
			permanent: true,
		}
	}
	return buildStoredGenericImageResponseWithDependencies(
		ctx,
		response,
		getGenericImageSourceClient(),
		r2.PutImageDeduped,
		defaultGenericImageStorageLimits,
	)
}

// materializeGenericImageResponse replaces temporary provider URLs with
// bounded base64 data. The materialized envelope is checkpointed before any R2
// upload so later upload retries never depend on an expiring provider URL.
func materializeGenericImageResponse(ctx context.Context, response *dto.ImageResponse) (*dto.ImageResponse, error) {
	return materializeGenericImageResponseWithDependencies(
		ctx,
		response,
		getGenericImageSourceClient(),
		defaultGenericImageMaterializationLimits,
	)
}

func materializeGenericImageResponseWithDependencies(
	ctx context.Context,
	response *dto.ImageResponse,
	client genericImageHTTPClient,
	limits genericImageMaterializationLimits,
) (*dto.ImageResponse, error) {
	materialized, _, _, err := readGenericImageResponseSources(ctx, response, client, limits)
	return materialized, err
}

func buildStoredGenericImageResponseWithDependencies(
	ctx context.Context,
	response *dto.ImageResponse,
	client genericImageHTTPClient,
	putImage genericImagePutFunc,
	limits genericImageMaterializationLimits,
) (*dto.ImageResponse, error) {
	if putImage == nil {
		return nil, permanentGenericImageStorageError(errors.New("image object storage uploader is required"))
	}

	if response == nil {
		return nil, permanentGenericImageStorageError(errors.New("image response is required"))
	}
	if len(response.Data) == 0 {
		return nil, permanentGenericImageStorageError(errors.New("image response contains no data"))
	}
	if len(response.Data) > limits.maxImages {
		return nil, permanentGenericImageStorageError(fmt.Errorf("image response contains %d images (max %d)", len(response.Data), limits.maxImages))
	}
	if client == nil {
		return nil, permanentGenericImageStorageError(errors.New("image fetch client is required"))
	}

	// Process one image at a time so a valid multi-image request is not forced
	// through a single aggregate base64/SQL artifact. Provider metadata is
	// intentionally omitted because it commonly repeats temporary URLs or image
	// base64 that must not appear in the durable result.
	stored := &dto.ImageResponse{
		Created: response.Created,
		Data:    make([]dto.ImageData, 0, len(response.Data)),
	}
	var totalBytes int64
	for index, item := range response.Data {
		remainingBytes := limits.maxImageBytes
		if limits.maxTotalBytes > 0 {
			remainingBytes = limits.maxTotalBytes - totalBytes
			if remainingBytes <= 0 {
				return nil, &genericImageSourceError{err: permanentGenericImageStorageError(fmt.Errorf("image response exceeds %d total bytes", limits.maxTotalBytes))}
			}
		}
		raw, err := readGenericImageSource(ctx, client, item, limits.maxImageBytes, remainingBytes)
		if err != nil {
			return nil, &genericImageSourceError{err: wrapGenericImageStorageError(index, err)}
		}
		format, ok := strictGenericImageFormat(raw)
		if !ok {
			return nil, &genericImageSourceError{err: permanentGenericImageStorageError(fmt.Errorf("image data[%d] has unsupported magic bytes", index))}
		}
		totalBytes += int64(len(raw))

		url, _, err := putImage(ctx, raw, format)
		if err != nil {
			var putErr *r2PutError
			return nil, &imageStorageError{
				err:       fmt.Errorf("store image data[%d] in R2: %w", index, err),
				permanent: errors.As(err, &putErr) && putErr.Permanent(),
			}
		}
		if strings.TrimSpace(url) == "" {
			return nil, permanentGenericImageStorageError(fmt.Errorf("store image data[%d] in R2: empty public URL", index))
		}
		stored.Data = append(stored.Data, dto.ImageData{
			Url:           url,
			RevisedPrompt: item.RevisedPrompt,
		})
	}

	return stored, nil
}

func readGenericImageResponseSources(
	ctx context.Context,
	response *dto.ImageResponse,
	client genericImageHTTPClient,
	limits genericImageMaterializationLimits,
) (*dto.ImageResponse, [][]byte, []string, error) {
	if response == nil {
		return nil, nil, nil, permanentGenericImageStorageError(errors.New("image response is required"))
	}
	if len(response.Data) == 0 {
		return nil, nil, nil, permanentGenericImageStorageError(errors.New("image response contains no data"))
	}
	if len(response.Data) > limits.maxImages {
		return nil, nil, nil, permanentGenericImageStorageError(fmt.Errorf("image response contains %d images (max %d)", len(response.Data), limits.maxImages))
	}
	if client == nil {
		return nil, nil, nil, permanentGenericImageStorageError(errors.New("image fetch client is required"))
	}

	// Provider metadata is intentionally omitted from durable async results. It
	// commonly embeds temporary provider URLs or a second copy of image base64,
	// neither of which belongs in the object-storage-only response contract.
	materialized := &dto.ImageResponse{
		Created: response.Created,
		Data:    make([]dto.ImageData, 0, len(response.Data)),
	}
	sources := make([][]byte, 0, len(response.Data))
	formats := make([]string, 0, len(response.Data))
	var totalBytes int64
	for index, item := range response.Data {
		remainingBytes := limits.maxTotalBytes - totalBytes
		if remainingBytes <= 0 {
			return nil, nil, nil, permanentGenericImageStorageError(fmt.Errorf("image response exceeds %d total bytes", limits.maxTotalBytes))
		}
		raw, err := readGenericImageSource(ctx, client, item, limits.maxImageBytes, remainingBytes)
		if err != nil {
			return nil, nil, nil, wrapGenericImageStorageError(index, err)
		}
		format, ok := strictGenericImageFormat(raw)
		if !ok {
			return nil, nil, nil, permanentGenericImageStorageError(fmt.Errorf("image data[%d] has unsupported magic bytes", index))
		}
		totalBytes += int64(len(raw))
		sources = append(sources, raw)
		formats = append(formats, format)
		materialized.Data = append(materialized.Data, dto.ImageData{
			B64Json:       base64.StdEncoding.EncodeToString(raw),
			RevisedPrompt: item.RevisedPrompt,
		})
	}
	return materialized, sources, formats, nil
}

func readGenericImageSource(ctx context.Context, client genericImageHTTPClient, item dto.ImageData, maxImageBytes, remainingBytes int64) ([]byte, error) {
	if item.B64Json != "" {
		return decodeGenericImageBase64(item.B64Json, maxImageBytes, remainingBytes)
	}
	if item.Url == "" {
		return nil, permanentGenericImageStorageError(errors.New("image source is empty"))
	}
	if strings.HasPrefix(strings.ToLower(strings.TrimSpace(item.Url)), "data:") {
		return decodeGenericImageBase64(item.Url, maxImageBytes, remainingBytes)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, item.Url, nil)
	if err != nil {
		return nil, permanentGenericImageStorageError(fmt.Errorf("build image URL request: %w", err))
	}
	if request.URL.Scheme != "http" && request.URL.Scheme != "https" {
		return nil, permanentGenericImageStorageError(fmt.Errorf("image URL scheme %q is not supported", request.URL.Scheme))
	}
	request.Header.Set("Accept", "image/png,image/jpeg,image/webp,image/gif")
	response, err := client.Do(request)
	if err != nil {
		return nil, &imageStorageError{err: fmt.Errorf("fetch image URL: %w", err)}
	}
	defer response.Body.Close()
	if response.StatusCode/100 != 2 {
		permanent := response.StatusCode >= 400 && response.StatusCode < 500 &&
			response.StatusCode != http.StatusRequestTimeout &&
			response.StatusCode != http.StatusConflict &&
			response.StatusCode != http.StatusTooEarly &&
			response.StatusCode != http.StatusTooManyRequests
		return nil, &imageStorageError{
			err:       fmt.Errorf("image URL returned HTTP %d", response.StatusCode),
			permanent: permanent,
		}
	}
	if response.ContentLength > maxImageBytes {
		return nil, permanentGenericImageStorageError(fmt.Errorf("image exceeds %d bytes", maxImageBytes))
	}
	if response.ContentLength > remainingBytes {
		return nil, permanentGenericImageStorageError(fmt.Errorf("image exceeds the remaining total byte limit of %d", remainingBytes))
	}
	raw, err := readGenericImageBytes(response.Body, maxImageBytes, remainingBytes)
	if err == nil {
		return raw, nil
	}
	if isGenericImageLimitError(err) || errors.Is(err, errEmptyGenericImageData) {
		return nil, permanentGenericImageStorageError(err)
	}
	return nil, &imageStorageError{err: fmt.Errorf("read image URL response: %w", err)}
}

func decodeGenericImageBase64(source string, maxImageBytes, remainingBytes int64) ([]byte, error) {
	payload := strings.TrimSpace(source)
	if strings.HasPrefix(strings.ToLower(payload), "data:") {
		comma := strings.IndexByte(payload, ',')
		if comma < 0 || !strings.Contains(strings.ToLower(payload[:comma]), ";base64") {
			return nil, permanentGenericImageStorageError(errors.New("image data URI must contain base64 data"))
		}
		payload = payload[comma+1:]
	}
	if payload == "" {
		return nil, permanentGenericImageStorageError(errors.New("image base64 data is empty"))
	}

	raw, err := readGenericImageBytes(base64.NewDecoder(base64.StdEncoding, strings.NewReader(payload)), maxImageBytes, remainingBytes)
	if err == nil {
		return raw, nil
	}
	if isGenericImageLimitError(err) {
		return nil, err
	}
	raw, rawErr := readGenericImageBytes(base64.NewDecoder(base64.RawStdEncoding, strings.NewReader(payload)), maxImageBytes, remainingBytes)
	if rawErr != nil {
		if isGenericImageLimitError(rawErr) {
			return nil, rawErr
		}
		return nil, permanentGenericImageStorageError(fmt.Errorf("decode image base64: %w", err))
	}
	return raw, nil
}

type genericImageLimitError struct {
	message string
}

func (e *genericImageLimitError) Error() string { return e.message }

func readGenericImageBytes(reader io.Reader, maxImageBytes, remainingBytes int64) ([]byte, error) {
	readLimit := maxImageBytes
	if remainingBytes < readLimit {
		readLimit = remainingBytes
	}
	if readLimit < 0 {
		readLimit = 0
	}
	raw, err := io.ReadAll(io.LimitReader(reader, readLimit+1))
	if err != nil {
		return nil, fmt.Errorf("read image data: %w", err)
	}
	if int64(len(raw)) > maxImageBytes {
		return nil, &genericImageLimitError{message: fmt.Sprintf("image exceeds %d bytes", maxImageBytes)}
	}
	if int64(len(raw)) > remainingBytes {
		return nil, &genericImageLimitError{message: "image response exceeds total byte limit"}
	}
	if len(raw) == 0 {
		return nil, errEmptyGenericImageData
	}
	return raw, nil
}

func strictGenericImageFormat(raw []byte) (string, bool) {
	switch {
	case len(raw) >= 8 && bytes.Equal(raw[:8], []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}):
		return "png", true
	case len(raw) >= 3 && raw[0] == 0xff && raw[1] == 0xd8 && raw[2] == 0xff:
		return "jpg", true
	case len(raw) >= 12 && bytes.Equal(raw[:4], []byte("RIFF")) && bytes.Equal(raw[8:12], []byte("WEBP")):
		return "webp", true
	case len(raw) >= 6 && (bytes.Equal(raw[:6], []byte("GIF87a")) || bytes.Equal(raw[:6], []byte("GIF89a"))):
		return "gif", true
	default:
		return "", false
	}
}

func isGenericImageLimitError(err error) bool {
	var limitErr *genericImageLimitError
	return errors.As(err, &limitErr)
}

func permanentGenericImageStorageError(err error) error {
	return &imageStorageError{err: err, permanent: true}
}

func wrapGenericImageStorageError(index int, err error) error {
	var storageErr *imageStorageError
	if errors.As(err, &storageErr) {
		return &imageStorageError{
			err:       fmt.Errorf("materialize image data[%d]: %w", index, err),
			permanent: storageErr.Permanent(),
		}
	}
	return &imageStorageError{
		err:       fmt.Errorf("materialize image data[%d]: %w", index, err),
		permanent: true,
	}
}
