package image_stream

import (
	"bufio"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

const (
	maxAsyncImageInputBytes      int64 = 25 << 20
	maxAsyncImageInputTotalBytes int64 = 64 << 20
	asyncImageInputStoreTimeout        = 2 * time.Minute
)

type PreparedAsyncImageInputs struct {
	ObjectKeys    []string
	MaskObjectKey string
}

type storedAsyncImageSources struct {
	URLs          []string
	ObjectKeys    []string
	MaskURL       string
	MaskObjectKey string
	TotalBytes    int64
}

type asyncImageInputCleanupRegistrarKey struct{}

func registerAsyncImageInputObject(ctx context.Context, objectKey string) error {
	if ctx == nil {
		return nil
	}
	registrar, _ := ctx.Value(asyncImageInputCleanupRegistrarKey{}).(func(string) error)
	if registrar == nil {
		return nil
	}
	return registrar(objectKey)
}

func defaultStoreAsyncImageSources(ctx context.Context, response *dto.ImageResponse) (*storedAsyncImageSources, error) {
	if response == nil || len(response.Data) == 0 {
		return nil, permanentGenericImageStorageError(errors.New("image response contains no data"))
	}
	if len(response.Data) > dto.MaxUnifiedImageInputURLs {
		return nil, permanentGenericImageStorageError(fmt.Errorf(
			"image response contains %d images (max %d)",
			len(response.Data),
			dto.MaxUnifiedImageInputURLs,
		))
	}
	r2 := LoadR2Config()
	stored := &storedAsyncImageSources{
		URLs:       make([]string, 0, len(response.Data)),
		ObjectKeys: make([]string, 0, len(response.Data)),
	}
	var totalBytes int64
	for index, item := range response.Data {
		reader, claimedFormat, closeSource, err := openAsyncImageInputSource(ctx, item, maxAsyncImageInputTotalBytes-totalBytes)
		if err != nil {
			return stored, wrapAsyncImageInputStorageError(index, err)
		}
		remainingBytes := maxAsyncImageInputTotalBytes - totalBytes
		imageLimit := min(maxAsyncImageInputBytes, remainingBytes)
		signedURL, key, _, size, err := r2.PutInputImageStream(ctx, reader, imageLimit, claimedFormat)
		closeErr := closeSource()
		if err == nil && closeErr != nil {
			err = closeErr
		}
		if err != nil {
			return stored, wrapAsyncImageInputStorageError(index, err)
		}
		totalBytes += size
		stored.TotalBytes = totalBytes
		stored.URLs = append(stored.URLs, signedURL)
		stored.ObjectKeys = append(stored.ObjectKeys, key)
	}
	return stored, nil
}

func openAsyncImageInputSource(ctx context.Context, item dto.ImageData, remainingBytes int64) (io.Reader, string, func() error, error) {
	if remainingBytes <= 0 {
		return nil, "", nil, permanentGenericImageStorageError(fmt.Errorf("image inputs exceed %d total bytes", maxAsyncImageInputTotalBytes))
	}
	source := strings.TrimSpace(item.Url)
	if item.B64Json != "" {
		source = strings.TrimSpace(item.B64Json)
	}
	if source == "" {
		return nil, "", nil, permanentGenericImageStorageError(errors.New("image source is empty"))
	}
	if strings.HasPrefix(strings.ToLower(source), "data:") || item.B64Json != "" {
		payload := source
		claimedFormat := ""
		if strings.HasPrefix(strings.ToLower(payload), "data:") {
			comma := strings.IndexByte(payload, ',')
			if comma < 0 || !strings.Contains(strings.ToLower(payload[:comma]), ";base64") {
				return nil, "", nil, permanentGenericImageStorageError(errors.New("image data URI must contain base64 data"))
			}
			mediaType, _, err := mime.ParseMediaType(strings.ReplaceAll(payload[5:comma], ";base64", ""))
			if err != nil {
				return nil, "", nil, permanentGenericImageStorageError(fmt.Errorf("parse image data URI: %w", err))
			}
			claimedFormat = strings.TrimPrefix(strings.ToLower(mediaType), "image/")
			payload = payload[comma+1:]
		}
		if payload == "" {
			return nil, "", nil, permanentGenericImageStorageError(errors.New("image base64 data is empty"))
		}
		return base64.NewDecoder(base64.StdEncoding, strings.NewReader(payload)), claimedFormat, func() error { return nil }, nil
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, source, nil)
	if err != nil {
		return nil, "", nil, permanentGenericImageStorageError(fmt.Errorf("build image URL request: %w", err))
	}
	if request.URL.Scheme != "http" && request.URL.Scheme != "https" {
		return nil, "", nil, permanentGenericImageStorageError(fmt.Errorf("image URL scheme %q is not supported", request.URL.Scheme))
	}
	if err := service.ValidateSSRFProtectedFetchURL(source); err != nil {
		return nil, "", nil, permanentGenericImageStorageError(fmt.Errorf("image URL is not allowed: %w", err))
	}
	request.Header.Set("Accept", "image/png,image/jpeg,image/webp")
	response, err := getGenericImageSourceClient().Do(request)
	if err != nil {
		return nil, "", nil, &imageStorageError{err: fmt.Errorf("fetch image URL: %s", common.MaskSensitiveInfo(err.Error()))}
	}
	if response.StatusCode/100 != 2 {
		_ = response.Body.Close()
		permanent := response.StatusCode >= 400 && response.StatusCode < 500 &&
			response.StatusCode != http.StatusRequestTimeout &&
			response.StatusCode != http.StatusConflict &&
			response.StatusCode != http.StatusTooEarly &&
			response.StatusCode != http.StatusTooManyRequests
		return nil, "", nil, &imageStorageError{
			err:       fmt.Errorf("image URL returned HTTP %d", response.StatusCode),
			permanent: permanent,
		}
	}
	if response.ContentLength > maxAsyncImageInputBytes || response.ContentLength > remainingBytes {
		_ = response.Body.Close()
		return nil, "", nil, permanentGenericImageStorageError(errors.New("image URL exceeds the input size limit"))
	}
	mediaType, _, _ := mime.ParseMediaType(response.Header.Get("Content-Type"))
	return response.Body, strings.TrimPrefix(strings.ToLower(mediaType), "image/"), response.Body.Close, nil
}

func wrapAsyncImageInputStorageError(index int, err error) error {
	var storageErr *imageStorageError
	if errors.As(err, &storageErr) {
		return &imageStorageError{
			err:       fmt.Errorf("store image data[%d] in R2: %w", index, err),
			permanent: storageErr.Permanent(),
		}
	}
	var putErr *r2PutError
	var inputErr *invalidInputImageError
	return &imageStorageError{
		err:       fmt.Errorf("store image data[%d] in R2: %w", index, err),
		permanent: errors.As(err, &inputErr) || (errors.As(err, &putErr) && putErr.Permanent()),
	}
}

func defaultStoreAsyncMultipartImageSources(ctx context.Context, form *multipart.Form) (*storedAsyncImageSources, error) {
	if form == nil {
		return nil, permanentGenericImageStorageError(errors.New("no multipart form data"))
	}
	type multipartInput struct {
		fieldName string
		index     int
		file      *multipart.FileHeader
		value     string
	}
	inputs := make([]multipartInput, 0)
	if err := validateAsyncMultipartImageFieldShape(form); err != nil {
		return nil, permanentGenericImageStorageError(err)
	}
	for fieldName, files := range form.File {
		if !isImageFieldName(fieldName) && fieldName != "mask" {
			continue
		}
		for index, file := range files {
			inputs = append(inputs, multipartInput{fieldName: fieldName, index: index, file: file})
		}
	}
	for fieldName, values := range form.Value {
		if !isImageFieldName(fieldName) && fieldName != "mask" {
			continue
		}
		for index, value := range values {
			if strings.TrimSpace(value) != "" {
				inputs = append(inputs, multipartInput{fieldName: fieldName, index: index, value: value})
			}
		}
	}
	sort.SliceStable(inputs, func(i, j int) bool {
		if (inputs[i].fieldName == "mask") != (inputs[j].fieldName == "mask") {
			return inputs[i].fieldName != "mask"
		}
		leftFieldIndex, leftIndexed := indexedImageFieldNumber(inputs[i].fieldName)
		rightFieldIndex, rightIndexed := indexedImageFieldNumber(inputs[j].fieldName)
		if leftIndexed && rightIndexed && leftFieldIndex != rightFieldIndex {
			return leftFieldIndex < rightFieldIndex
		}
		if inputs[i].fieldName != inputs[j].fieldName {
			return inputs[i].fieldName < inputs[j].fieldName
		}
		return inputs[i].index < inputs[j].index
	})
	if len(inputs) == 0 {
		return nil, permanentGenericImageStorageError(errors.New(`"image" field is required (file upload, http(s) URL, or data: URI)`))
	}
	imageCount := 0
	maskCount := 0
	for _, input := range inputs {
		if input.fieldName == "mask" {
			maskCount++
		} else {
			imageCount++
		}
	}
	if imageCount == 0 {
		return nil, permanentGenericImageStorageError(errors.New(`"image" field is required (file upload, http(s) URL, or data: URI)`))
	}
	if imageCount > dto.MaxUnifiedImageInputURLs {
		return nil, permanentGenericImageStorageError(fmt.Errorf("too many images: %d (max %d)", imageCount, dto.MaxUnifiedImageInputURLs))
	}
	if maskCount > 1 {
		return nil, permanentGenericImageStorageError(errors.New("only one mask is supported"))
	}

	r2 := LoadR2Config()
	stored := &storedAsyncImageSources{
		URLs:       make([]string, 0, len(inputs)),
		ObjectKeys: make([]string, 0, len(inputs)),
	}
	var totalBytes int64
	for inputIndex, input := range inputs {
		remainingBytes := maxAsyncImageInputTotalBytes - totalBytes
		imageLimit := min(maxAsyncImageInputBytes, remainingBytes)
		var (
			signedURL string
			key       string
			size      int64
			err       error
		)
		if input.file != nil {
			file, openErr := input.file.Open()
			if openErr != nil {
				return stored, &imageStorageError{err: fmt.Errorf("open image #%s[%d]: %w", input.fieldName, input.index, openErr)}
			}
			if common.IsAsyncImageDataURIFile(input.file.Header) {
				reader, claimedFormat, dataErr := asyncImageDataURIReader(file)
				if dataErr != nil {
					_ = file.Close()
					return stored, permanentGenericImageStorageError(fmt.Errorf("image #%s[%d]: %w", input.fieldName, input.index, dataErr))
				}
				signedURL, key, _, size, err = r2.PutInputImageStream(ctx, reader, imageLimit, claimedFormat)
			} else {
				if input.file.Size <= 0 || input.file.Size > imageLimit {
					_ = file.Close()
					return stored, permanentGenericImageStorageError(fmt.Errorf(
						"image #%s[%d] exceeds the input size limit",
						input.fieldName,
						input.index,
					))
				}
				mediaType, _, _ := mime.ParseMediaType(input.file.Header.Get("Content-Type"))
				signedURL, key, _, err = r2.PutInputImageReader(
					ctx,
					file,
					input.file.Size,
					strings.TrimPrefix(strings.ToLower(mediaType), "image/"),
				)
				size = input.file.Size
			}
			closeErr := file.Close()
			if err == nil && closeErr != nil {
				err = closeErr
			}
		} else {
			reader, claimedFormat, closeSource, openErr := openAsyncImageInputSource(
				ctx,
				dto.ImageData{Url: input.value},
				remainingBytes,
			)
			if openErr != nil {
				return stored, wrapAsyncImageInputStorageError(inputIndex, openErr)
			}
			signedURL, key, _, size, err = r2.PutInputImageStream(ctx, reader, imageLimit, claimedFormat)
			closeErr := closeSource()
			if err == nil && closeErr != nil {
				err = closeErr
			}
		}
		if err != nil {
			return stored, wrapAsyncImageInputStorageError(inputIndex, err)
		}
		totalBytes += size
		stored.TotalBytes = totalBytes
		if input.fieldName == "mask" {
			stored.MaskURL = signedURL
			stored.MaskObjectKey = key
		} else {
			stored.URLs = append(stored.URLs, signedURL)
			stored.ObjectKeys = append(stored.ObjectKeys, key)
		}
	}
	return stored, nil
}

func validateAsyncMultipartImageFieldShape(form *multipart.Form) error {
	if form == nil {
		return errors.New("no multipart form data")
	}
	imageFields := make(map[string]struct{})
	for fieldName, files := range form.File {
		if isImageFieldName(fieldName) && len(files) > 0 {
			imageFields[imageFieldStyle(fieldName)] = struct{}{}
		}
	}
	for fieldName, values := range form.Value {
		if !isImageFieldName(fieldName) {
			continue
		}
		nonEmpty := 0
		for _, value := range values {
			if strings.TrimSpace(value) != "" {
				nonEmpty++
			}
		}
		if nonEmpty == 0 {
			continue
		}
		imageFields[imageFieldStyle(fieldName)] = struct{}{}
		if len(form.File[fieldName]) > 0 {
			return fmt.Errorf("multipart image field %q cannot mix file and string sources", fieldName)
		}
	}
	if len(imageFields) > 1 {
		return errors.New("multipart image inputs must use one field style: image, image[], or image[N]")
	}
	return nil
}

func asyncImageDataURIReader(source io.Reader) (io.Reader, string, error) {
	reader := bufio.NewReader(source)
	header, err := reader.ReadString(',')
	if err != nil {
		return nil, "", errors.New("image data URI is malformed")
	}
	if len(header) > 512 || !strings.HasPrefix(strings.ToLower(header), "data:") || !strings.Contains(strings.ToLower(header), ";base64") {
		return nil, "", errors.New("image data URI must contain base64 data")
	}
	mediaType, _, err := mime.ParseMediaType(strings.ReplaceAll(strings.TrimSuffix(header[5:], ","), ";base64", ""))
	if err != nil {
		return nil, "", fmt.Errorf("parse image data URI: %w", err)
	}
	return base64.NewDecoder(base64.StdEncoding, reader), strings.TrimPrefix(strings.ToLower(mediaType), "image/"), nil
}

var storeAsyncImageSources = defaultStoreAsyncImageSources
var storeAsyncMultipartImageSources = defaultStoreAsyncMultipartImageSources

// HasAsyncImageInputSources validates whether the request carries reference
// images without fetching or uploading them. Callers use it to finish provider
// preflight and pricing before the durable quota reservation.
func HasAsyncImageInputSources(c *gin.Context, request *dto.ImageRequest) (bool, error) {
	if request == nil {
		return false, errors.New("async image request is required")
	}
	return hasAsyncImageInputSources(c, request)
}

// PrepareAsyncImageInputs copies user supplied sources to the private input
// bucket after the durable quota reservation is created and before the task is
// activated. The returned object keys are durable; the URLs written to request
// are submission-time values used only for conversion validation and are never
// checkpointed.
func PrepareAsyncImageInputs(c *gin.Context, request *dto.ImageRequest, taskIDs ...string) (*PreparedAsyncImageInputs, *types.NewAPIError) {
	if request == nil {
		return nil, types.NewErrorWithStatusCode(
			errors.New("async image request is required"),
			types.ErrorCodeInvalidRequest,
			http.StatusBadRequest,
			types.ErrOptionWithSkipRetry(),
		)
	}
	hasSources, err := hasAsyncImageInputSources(c, request)
	if err != nil {
		return nil, types.NewErrorWithStatusCode(
			err,
			types.ErrorCodeInvalidRequest,
			http.StatusBadRequest,
			types.ErrOptionWithSkipRetry(),
		)
	}
	if !hasSources {
		return nil, nil
	}
	if !LoadR2Config().InputEnabled() {
		return nil, types.NewErrorWithStatusCode(
			errors.New("async image input storage requires a separate private CLOUDFLARE_R2_INPUT_BUCKET"),
			types.ErrorCodeInvalidRequest,
			http.StatusServiceUnavailable,
			types.ErrOptionWithSkipRetry(),
		)
	}

	ctx := context.Background()
	if c != nil && c.Request != nil {
		ctx = c.Request.Context()
	}
	ctx, cancel := context.WithTimeout(ctx, asyncImageInputStoreTimeout)
	defer cancel()
	taskID := ""
	if len(taskIDs) > 0 {
		taskID = strings.TrimSpace(taskIDs[0])
	}
	if taskID != "" {
		ctx = context.WithValue(ctx, asyncImageInputCleanupRegistrarKey{}, func(objectKey string) error {
			return model.PersistPreparedImageInputCleanup(taskID, []string{objectKey})
		})
	}

	var (
		stored      *storedAsyncImageSources
		sourceCount int
	)
	form := asyncImageMultipartForm(c)
	if hasMultipartImageFields(form) {
		stored, err = storeAsyncMultipartImageSources(ctx, form)
		if stored != nil {
			sourceCount = len(stored.URLs)
		}
	} else {
		var sources []string
		sources, err = collectAsyncImageInputSources(request)
		if err == nil && len(sources) > 0 {
			storedInput := &dto.ImageResponse{Data: make([]dto.ImageData, 0, len(sources))}
			for _, source := range sources {
				storedInput.Data = append(storedInput.Data, dto.ImageData{Url: source})
			}
			stored, err = storeAsyncImageSources(ctx, storedInput)
			sourceCount = len(sources)
			if err == nil && stored != nil {
				maskSource, maskErr := asyncImageJSONMaskSource(request)
				if maskErr != nil {
					err = maskErr
				} else if maskSource != "" {
					maskStored, maskStoreErr := storeAsyncImageSources(ctx, &dto.ImageResponse{Data: []dto.ImageData{{Url: maskSource}}})
					if maskStoreErr == nil && maskStored != nil && stored.TotalBytes+maskStored.TotalBytes > maxAsyncImageInputTotalBytes {
						maskStoreErr = permanentGenericImageStorageError(fmt.Errorf("image inputs and mask exceed %d total bytes", maxAsyncImageInputTotalBytes))
					}
					if maskStored != nil && len(maskStored.ObjectKeys) > 0 {
						stored.MaskObjectKey = maskStored.ObjectKeys[0]
					}
					if maskStored != nil && len(maskStored.URLs) > 0 {
						stored.MaskURL = maskStored.URLs[0]
					}
					if maskStoreErr != nil {
						err = maskStoreErr
					} else if maskStored == nil || len(maskStored.ObjectKeys) != 1 || len(maskStored.URLs) != 1 {
						err = errors.New("async image mask storage returned an incomplete result")
					}
				}
			}
		}
	}
	if err == nil && sourceCount == 0 {
		return nil, nil
	}
	if stored != nil && taskID != "" {
		cleanupKeys := append([]string(nil), stored.ObjectKeys...)
		if strings.TrimSpace(stored.MaskObjectKey) != "" {
			cleanupKeys = append(cleanupKeys, stored.MaskObjectKey)
		}
		if len(cleanupKeys) > 0 {
			if cleanupErr := model.PersistPreparedImageInputCleanup(taskID, cleanupKeys); cleanupErr != nil {
				err = errors.Join(err, fmt.Errorf("persist async image input cleanup: %w", cleanupErr))
			}
		}
	}
	if err != nil {
		statusCode := http.StatusBadGateway
		var storageErr *imageStorageError
		if errors.As(err, &storageErr) && storageErr.Permanent() {
			statusCode = http.StatusBadRequest
		}
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("store async image input: %w", err),
			types.ErrorCodeInvalidRequest,
			statusCode,
			types.ErrOptionWithSkipRetry(),
		)
	}
	if stored == nil || len(stored.URLs) != sourceCount || len(stored.ObjectKeys) != sourceCount {
		return nil, types.NewErrorWithStatusCode(
			errors.New("async image input storage returned an incomplete result"),
			types.ErrorCodeBadResponseBody,
			http.StatusBadGateway,
			types.ErrOptionWithSkipRetry(),
		)
	}

	urls := make([]string, 0, len(stored.URLs))
	for index, storedURL := range stored.URLs {
		url := strings.TrimSpace(storedURL)
		if url == "" {
			return nil, types.NewErrorWithStatusCode(
				fmt.Errorf("async image input storage returned an empty URL at index %d", index),
				types.ErrorCodeBadResponseBody,
				http.StatusBadGateway,
				types.ErrOptionWithSkipRetry(),
			)
		}
		urls = append(urls, url)
	}
	encoded, err := common.Marshal(urls)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	request.Images = json.RawMessage(encoded)
	// Keep the legacy single-image field populated for adaptors that only read
	// `image`; multi-image providers use the canonical `images` field above.
	first, err := common.Marshal(urls[0])
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	request.Image = json.RawMessage(first)
	if stored.MaskURL != "" {
		mask, err := common.Marshal(stored.MaskURL)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
		request.Mask = json.RawMessage(mask)
	}
	return &PreparedAsyncImageInputs{
		ObjectKeys:    append([]string(nil), stored.ObjectKeys...),
		MaskObjectKey: stored.MaskObjectKey,
	}, nil
}

func hasAsyncImageInputSources(c *gin.Context, request *dto.ImageRequest) (bool, error) {
	if c != nil && c.Request != nil && strings.Contains(strings.ToLower(c.Request.Header.Get("Content-Type")), "multipart/form-data") {
		form := asyncImageMultipartForm(c)
		if form == nil {
			return false, errors.New("parse image input form: no multipart form data")
		}
		if hasMultipartImageFields(form) {
			if err := validateAsyncMultipartImageFieldShape(form); err != nil {
				return false, err
			}
			return true, nil
		}
	}
	urls, err := request.ImageInputURLs()
	if err != nil {
		return false, err
	}
	if len(urls) > 0 {
		return true, nil
	}
	if len(strings.TrimSpace(string(request.Image))) == 0 || common.GetJsonType(request.Image) == "null" {
		return false, nil
	}
	probe := *request
	probe.Images = append(json.RawMessage(nil), request.Image...)
	urls, err = probe.ImageInputURLs()
	return len(urls) > 0, err
}

func asyncImageMultipartForm(c *gin.Context) *multipart.Form {
	if c == nil || c.Request == nil || !strings.Contains(strings.ToLower(c.Request.Header.Get("Content-Type")), "multipart/form-data") {
		return nil
	}
	return c.Request.MultipartForm
}

func collectAsyncImageInputSources(request *dto.ImageRequest) ([]string, error) {
	urls, err := request.ImageInputURLs()
	if err != nil {
		return nil, err
	}
	if len(urls) > 0 {
		return urls, nil
	}
	// OpenAI image-edit JSON requests historically used `image` instead of
	// `images`. Reuse the DTO validator for that legacy field as well.
	if len(strings.TrimSpace(string(request.Image))) > 0 && common.GetJsonType(request.Image) != "null" {
		probe := *request
		probe.Images = append(json.RawMessage(nil), request.Image...)
		return probe.ImageInputURLs()
	}
	return nil, nil
}

func asyncImageJSONMaskSource(request *dto.ImageRequest) (string, error) {
	if request == nil || len(bytes.TrimSpace(request.Mask)) == 0 || common.GetJsonType(request.Mask) == "null" {
		return "", nil
	}
	if common.GetJsonType(request.Mask) != "string" {
		return "", errors.New("mask must be an http(s) URL or data: URI string")
	}
	var source string
	if err := common.Unmarshal(request.Mask, &source); err != nil {
		return "", errors.New("mask must be an http(s) URL or data: URI string")
	}
	source = strings.TrimSpace(source)
	if source == "" {
		return "", errors.New("mask must not be empty")
	}
	return source, nil
}

func hasMultipartImageFields(form *multipart.Form) bool {
	if form == nil {
		return false
	}
	for field := range form.File {
		if isImageFieldName(field) || field == "mask" {
			return true
		}
	}
	for field, values := range form.Value {
		if (isImageFieldName(field) || field == "mask") && len(values) > 0 {
			return true
		}
	}
	return false
}
