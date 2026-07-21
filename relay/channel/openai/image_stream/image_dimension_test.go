package image_stream

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/color"
	"image/gif"
	"image/jpeg"
	"image/png"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseExpectedImageDimensions(t *testing.T) {
	tests := []struct {
		name       string
		size       string
		wantWidth  int
		wantHeight int
		wantError  string
	}{
		{name: "square", size: "2880x2880", wantWidth: 2880, wantHeight: 2880},
		{name: "trimmed", size: " 3840x2160 ", wantWidth: 3840, wantHeight: 2160},
		{name: "auto is not exact", size: "auto", wantError: "invalid expected image size"},
		{name: "uppercase separator", size: "1024X1024", wantError: "invalid expected image size"},
		{name: "missing height", size: "1024x", wantError: "invalid expected image size"},
		{name: "zero width", size: "0x1024", wantError: "invalid expected image size"},
		{name: "negative height", size: "1024x-1", wantError: "invalid expected image size"},
		{name: "overflow", size: "999999999999999999999999x1", wantError: "invalid expected image size"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			width, height, err := ParseExpectedImageDimensions(tt.size)
			if tt.wantError != "" {
				require.Error(t, err)
				assert.ErrorIs(t, err, ErrInvalidExpectedImageSize)
				assert.Contains(t, err.Error(), tt.wantError)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.wantWidth, width)
			assert.Equal(t, tt.wantHeight, height)
		})
	}
}

func TestValidateImageBytesDimensionsSupportsRegisteredFormats(t *testing.T) {
	tests := []struct {
		name     string
		data     []byte
		expected string
	}{
		{name: "png", data: encodedPNG(t, 4, 3), expected: "4x3"},
		{name: "jpeg", data: encodedJPEG(t, 5, 2), expected: "5x2"},
		{name: "gif", data: encodedGIF(t, 2, 6), expected: "2x6"},
		{name: "webp", data: oneByOneWebP(t), expected: "1x1"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.NoError(t, ValidateImageBytesDimensions(tt.data, tt.expected))
		})
	}
}

func TestValidateImageBytesDimensionsReportsMismatchAndUndecodableData(t *testing.T) {
	data := encodedPNG(t, 4, 3)

	err := ValidateImageBytesDimensions(data, "5x3")
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrImageDimensionMismatch)
	assert.Contains(t, err.Error(), "expected 5x3")
	assert.Contains(t, err.Error(), "got 4x3")

	err = ValidateImageBytesDimensions([]byte("not an image"), "4x3")
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrUndecodableImage)
	assert.Contains(t, err.Error(), "undecodable image")

	err = ValidateImageBytesDimensions(nil, "4x3")
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrUndecodableImage)

	err = ValidateImageBytesDimensions(data, "auto")
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrInvalidExpectedImageSize)
}

func TestValidateImageDataDimensionsDecodesBase64AndDataURI(t *testing.T) {
	pngBytes := encodedPNG(t, 7, 8)
	encoded := base64.StdEncoding.EncodeToString(pngBytes)

	require.NoError(t, ValidateImageDataDimensions(dto.ImageData{B64Json: encoded}, "7x8"))
	require.NoError(t, ValidateImageDataDimensions(dto.ImageData{
		B64Json: "data:image/png;base64," + encoded,
	}, "7x8"))

	err := ValidateImageDataDimensions(dto.ImageData{B64Json: "not-base64"}, "7x8")
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrUndecodableImage)

	err = ValidateImageDataDimensions(dto.ImageData{B64Json: "data:image/png,not-base64"}, "7x8")
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrUndecodableImage)
}

func TestValidateImageDataDimensionsRequiresMaterializedBytesForURL(t *testing.T) {
	err := ValidateImageDataDimensions(dto.ImageData{Url: "https://images.example.test/result.png"}, "7x8")
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrImageDataRequiresMaterialization)
	assert.Contains(t, err.Error(), "materialize")
}

func TestValidateImageDataListDimensionsValidatesEveryItem(t *testing.T) {
	pngBytes := encodedPNG(t, 3, 3)
	item := dto.ImageData{B64Json: base64.StdEncoding.EncodeToString(pngBytes)}

	require.NoError(t, ValidateImageDataListDimensions([]dto.ImageData{item, item}, "3x3"))

	bad := dto.ImageData{B64Json: base64.StdEncoding.EncodeToString(encodedPNG(t, 2, 3))}
	err := ValidateImageDataListDimensions([]dto.ImageData{item, bad}, "3x3")
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrImageDimensionMismatch)
	assert.Contains(t, err.Error(), "image data[1]")

	err = ValidateImageDataListDimensions(nil, "3x3")
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrUndecodableImage)
	assert.Contains(t, err.Error(), "image data list is empty")
}

func TestValidateImageDataListContractChecksFormatAndCount(t *testing.T) {
	pngItem := dto.ImageData{B64Json: base64.StdEncoding.EncodeToString(encodedPNG(t, 3, 3))}
	jpegItem := dto.ImageData{B64Json: base64.StdEncoding.EncodeToString(encodedJPEG(t, 3, 3))}

	require.NoError(t, ValidateImageDataListContract([]dto.ImageData{pngItem}, "3x3", "1:1", "png", 1))

	err := ValidateImageDataListContract([]dto.ImageData{pngItem}, "3x3", "1:1", "jpeg", 1)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrImageFormatMismatch)

	err = ValidateImageDataListContract([]dto.ImageData{pngItem, jpegItem}, "3x3", "1:1", "", 1)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrImageCountMismatch)
}

func TestValidateImageDataListContractChecksAspectRatioWithTolerance(t *testing.T) {
	wide := dto.ImageData{B64Json: base64.StdEncoding.EncodeToString(encodedPNG(t, 1920, 1080))}
	almostWide := dto.ImageData{B64Json: base64.StdEncoding.EncodeToString(encodedPNG(t, 1910, 1080))}
	square := dto.ImageData{B64Json: base64.StdEncoding.EncodeToString(encodedPNG(t, 1080, 1080))}

	require.NoError(t, ValidateImageDataListContract([]dto.ImageData{wide}, "", "16:9", "png", 1))
	require.NoError(t, ValidateImageDataListContract([]dto.ImageData{almostWide}, "", "16:9", "png", 1))
	require.NoError(t, ValidateImageDataListContract([]dto.ImageData{square}, "", "auto", "png", 1))

	err := ValidateImageDataListContract([]dto.ImageData{square}, "", "16:9", "png", 1)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrImageAspectRatioMismatch)
	assert.Contains(t, err.Error(), "expected 16:9")
}

func encodedPNG(t *testing.T, width, height int) []byte {
	t.Helper()
	return encodeImage(t, func(buf *bytes.Buffer, img image.Image) error {
		return png.Encode(buf, img)
	}, width, height)
}

func encodedJPEG(t *testing.T, width, height int) []byte {
	t.Helper()
	return encodeImage(t, func(buf *bytes.Buffer, img image.Image) error {
		return jpeg.Encode(buf, img, &jpeg.Options{Quality: 90})
	}, width, height)
}

func encodedGIF(t *testing.T, width, height int) []byte {
	t.Helper()
	return encodeImage(t, func(buf *bytes.Buffer, img image.Image) error {
		return gif.Encode(buf, img, nil)
	}, width, height)
}

func encodeImage(t *testing.T, encode func(*bytes.Buffer, image.Image) error, width, height int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			img.SetRGBA(x, y, color.RGBA{R: uint8(x + 1), G: uint8(y + 1), B: 0x7f, A: 0xff})
		}
	}
	var buf bytes.Buffer
	require.NoError(t, encode(&buf, img))
	return buf.Bytes()
}

func oneByOneWebP(t *testing.T) []byte {
	t.Helper()
	data, err := base64.StdEncoding.DecodeString("UklGRlAAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAIAAAAALlZQOCAoAAAAcAEAnQEqAQABAAIANCWgAnQBQAAA/umt//wQX9Dn9bePDVlqIXIAAA==")
	require.NoError(t, err)
	return data
}
