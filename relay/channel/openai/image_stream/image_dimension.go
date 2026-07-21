package image_stream

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"math"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/dto"
	_ "golang.org/x/image/webp"
)

var (
	ErrInvalidExpectedImageSize         = errors.New("invalid expected image size")
	ErrInvalidExpectedImageAspectRatio  = errors.New("invalid expected image aspect ratio")
	ErrUndecodableImage                 = errors.New("undecodable image")
	ErrImageDimensionMismatch           = errors.New("image dimension mismatch")
	ErrImageAspectRatioMismatch         = errors.New("image aspect ratio mismatch")
	ErrImageFormatMismatch              = errors.New("image format mismatch")
	ErrImageCountMismatch               = errors.New("image count mismatch")
	ErrImageDataRequiresMaterialization = errors.New("image data requires materialization")
)

// ParseExpectedImageDimensions parses an exact image size in WIDTHxHEIGHT form.
func ParseExpectedImageDimensions(size string) (int, int, error) {
	normalized := strings.TrimSpace(size)
	widthText, heightText, ok := strings.Cut(normalized, "x")
	if !ok || widthText == "" || heightText == "" || strings.Contains(heightText, "x") ||
		strings.Trim(widthText, "0123456789") != "" || strings.Trim(heightText, "0123456789") != "" {
		return 0, 0, fmt.Errorf("%w %q: expected WIDTHxHEIGHT with positive integers", ErrInvalidExpectedImageSize, size)
	}

	width, widthErr := strconv.Atoi(widthText)
	height, heightErr := strconv.Atoi(heightText)
	if widthErr != nil || heightErr != nil || width <= 0 || height <= 0 {
		return 0, 0, fmt.Errorf("%w %q: expected WIDTHxHEIGHT with positive integers", ErrInvalidExpectedImageSize, size)
	}
	return width, height, nil
}

// ValidateImageBytesDimensions verifies that decoded image bytes exactly match
// the requested pixel dimensions.
func ValidateImageBytesDimensions(data []byte, expectedSize string) error {
	return ValidateImageBytesContract(data, expectedSize, "")
}

// ValidateImageBytesContract verifies exact pixel dimensions and/or encoded
// image format. Empty expectations are ignored.
func ValidateImageBytesContract(data []byte, expectedSize, expectedFormat string) error {
	expectedWidth, expectedHeight, err := expectedImageDimensions(expectedSize)
	if err != nil {
		return err
	}
	return validateDecodedImageContract(data, expectedWidth, expectedHeight, normalizeExpectedImageFormat(expectedFormat))
}

// ValidateImageDataDimensions validates materialized b64_json image data. URL
// sources must be materialized by the caller before this helper is used.
func ValidateImageDataDimensions(item dto.ImageData, expectedSize string) error {
	raw, err := decodeImageDataForDimensionValidation(item)
	if err != nil {
		return err
	}
	return ValidateImageBytesContract(raw, expectedSize, "")
}

// ValidateImageDataListDimensions validates every materialized image and
// annotates failures with the offending response index.
func ValidateImageDataListDimensions(items []dto.ImageData, expectedSize string) error {
	return ValidateImageDataListContract(items, expectedSize, "", "", 0)
}

// ValidateImageDataListContract validates the full materialized output
// contract captured by an explicit image routing profile.
func ValidateImageDataListContract(items []dto.ImageData, expectedSize, expectedAspectRatio, expectedFormat string, expectedCount uint) error {
	if len(items) == 0 {
		return fmt.Errorf("%w: image data list is empty", ErrUndecodableImage)
	}
	if expectedCount > 0 && uint(len(items)) != expectedCount {
		return fmt.Errorf("%w: expected %d, got %d", ErrImageCountMismatch, expectedCount, len(items))
	}
	expectedWidth, expectedHeight, err := expectedImageDimensions(expectedSize)
	if err != nil {
		return err
	}
	expectedAspectWidth, expectedAspectHeight, err := expectedImageAspectRatio(expectedAspectRatio)
	if err != nil {
		return err
	}
	expectedFormat = normalizeExpectedImageFormat(expectedFormat)
	for index, item := range items {
		raw, err := decodeImageDataForDimensionValidation(item)
		if err != nil {
			return fmt.Errorf("image data[%d]: %w", index, err)
		}
		if err := validateDecodedImageOutputContract(raw, expectedWidth, expectedHeight, expectedAspectWidth, expectedAspectHeight, expectedFormat); err != nil {
			return fmt.Errorf("image data[%d]: %w", index, err)
		}
	}
	return nil
}

func expectedImageDimensions(expectedSize string) (int, int, error) {
	if strings.TrimSpace(expectedSize) == "" {
		return 0, 0, nil
	}
	return ParseExpectedImageDimensions(expectedSize)
}

func expectedImageAspectRatio(expectedAspectRatio string) (int, int, error) {
	normalized := strings.TrimSpace(expectedAspectRatio)
	if normalized == "" || strings.EqualFold(normalized, "auto") {
		return 0, 0, nil
	}
	widthText, heightText, ok := strings.Cut(normalized, ":")
	if !ok || widthText == "" || heightText == "" || strings.Contains(heightText, ":") ||
		strings.Trim(widthText, "0123456789") != "" || strings.Trim(heightText, "0123456789") != "" {
		return 0, 0, fmt.Errorf("%w %q: expected WIDTH:HEIGHT with positive integers", ErrInvalidExpectedImageAspectRatio, expectedAspectRatio)
	}
	width, widthErr := strconv.Atoi(widthText)
	height, heightErr := strconv.Atoi(heightText)
	if widthErr != nil || heightErr != nil || width <= 0 || height <= 0 {
		return 0, 0, fmt.Errorf("%w %q: expected WIDTH:HEIGHT with positive integers", ErrInvalidExpectedImageAspectRatio, expectedAspectRatio)
	}
	return width, height, nil
}

func normalizeExpectedImageFormat(expectedFormat string) string {
	expectedFormat = strings.ToLower(strings.TrimSpace(expectedFormat))
	if expectedFormat == "jpg" {
		return "jpeg"
	}
	return expectedFormat
}

func validateDecodedImageContract(data []byte, expectedWidth, expectedHeight int, expectedFormat string) error {
	return validateDecodedImageOutputContract(data, expectedWidth, expectedHeight, 0, 0, expectedFormat)
}

func validateDecodedImageOutputContract(data []byte, expectedWidth, expectedHeight, expectedAspectWidth, expectedAspectHeight int, expectedFormat string) error {
	if len(data) == 0 {
		return fmt.Errorf("%w: image data is empty", ErrUndecodableImage)
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("%w: %v", ErrUndecodableImage, err)
	}
	if config.Width <= 0 || config.Height <= 0 {
		return fmt.Errorf("%w: decoded %s dimensions are %dx%d", ErrUndecodableImage, format, config.Width, config.Height)
	}
	if expectedWidth > 0 && expectedHeight > 0 && (config.Width != expectedWidth || config.Height != expectedHeight) {
		return fmt.Errorf(
			"%w: expected %dx%d, got %dx%d (%s)",
			ErrImageDimensionMismatch,
			expectedWidth,
			expectedHeight,
			config.Width,
			config.Height,
			format,
		)
	}
	if expectedAspectWidth > 0 && expectedAspectHeight > 0 {
		actualRatio := float64(config.Width) / float64(config.Height)
		expectedRatio := float64(expectedAspectWidth) / float64(expectedAspectHeight)
		if relativeError := math.Abs(actualRatio/expectedRatio - 1); relativeError > 0.01 {
			return fmt.Errorf(
				"%w: expected %d:%d, got %dx%d (%s)",
				ErrImageAspectRatioMismatch,
				expectedAspectWidth,
				expectedAspectHeight,
				config.Width,
				config.Height,
				format,
			)
		}
	}
	if expectedFormat != "" && normalizeExpectedImageFormat(format) != expectedFormat {
		return fmt.Errorf("%w: expected %s, got %s", ErrImageFormatMismatch, expectedFormat, format)
	}
	return nil
}

func decodeImageDataForDimensionValidation(item dto.ImageData) ([]byte, error) {
	payload := strings.TrimSpace(item.B64Json)
	if payload == "" {
		if strings.TrimSpace(item.Url) != "" {
			return nil, fmt.Errorf("%w: materialize the image URL before validating dimensions", ErrImageDataRequiresMaterialization)
		}
		return nil, fmt.Errorf("%w: image data is empty", ErrUndecodableImage)
	}

	if strings.HasPrefix(strings.ToLower(payload), "data:") {
		comma := strings.IndexByte(payload, ',')
		if comma < 0 || !strings.Contains(strings.ToLower(payload[:comma]), ";base64") {
			return nil, fmt.Errorf("%w: image data URI must contain base64 data", ErrUndecodableImage)
		}
		payload = payload[comma+1:]
	}
	if payload == "" {
		return nil, fmt.Errorf("%w: image base64 data is empty", ErrUndecodableImage)
	}

	raw, err := base64.StdEncoding.DecodeString(payload)
	if err == nil {
		return raw, nil
	}
	raw, rawErr := base64.RawStdEncoding.DecodeString(payload)
	if rawErr != nil {
		return nil, fmt.Errorf("%w: invalid base64 image data: %v", ErrUndecodableImage, err)
	}
	return raw, nil
}
