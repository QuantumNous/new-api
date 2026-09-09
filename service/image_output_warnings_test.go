package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"image"
	"image/png"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestImageOutputMismatchReportsFactsWithoutChangingImage(t *testing.T) {
	var pngBytes bytes.Buffer
	require.NoError(t, png.Encode(&pngBytes, image.NewRGBA(image.Rect(0, 0, 4, 4))))
	encoded := base64.StdEncoding.EncodeToString(pngBytes.Bytes())
	body, err := common.Marshal(map[string]any{"data": []map[string]any{{"b64_json": encoded}}, "quality": "low", "output_format": "jpeg", "usage": map[string]int{"total_tokens": 20}})
	require.NoError(t, err)
	out := AddImageOutputWarnings(NormalizeImageJSONResponse(context.Background(), body), &dto.ImageRequest{Size: "960x1280", Quality: "high"})
	assert.Equal(t, encoded, gjson.GetBytes(out, "data.0.b64_json").String())
	assert.Equal(t, "4x4", gjson.GetBytes(out, "size").String())
	assert.Equal(t, "png", gjson.GetBytes(out, "output_format").String())
	assert.Equal(t, "960x1280", gjson.GetBytes(out, "requested_size").String())
	assert.False(t, gjson.GetBytes(out, "data.0.size_matches_request").Bool())
	assert.False(t, gjson.GetBytes(out, "data.0.aspect_ratio_matches_request").Bool())
	assert.Equal(t, "low", gjson.GetBytes(out, "quality").String())
	assert.Equal(t, "high", gjson.GetBytes(out, "requested_quality").String())
	assert.False(t, gjson.GetBytes(out, "quality_report_matches_request").Bool())
	assert.EqualValues(t, 20, gjson.GetBytes(out, "usage.total_tokens").Int())
	assert.Contains(t, string(out), "image_aspect_ratio_mismatch")
	assert.Contains(t, string(out), "image_quality_report_mismatch")
}

func TestImageOutputSameRatioDoesNotPretendExactSizeOrKnownQuality(t *testing.T) {
	body := []byte(`{"data":[{"width":1086,"height":1448,"size":"1086x1448","b64_json":"unchanged"}],"quality":null}`)
	out := AddImageOutputWarnings(body, &dto.ImageRequest{Size: "960x1280", Quality: "low"})
	assert.False(t, gjson.GetBytes(out, "data.0.size_matches_request").Bool())
	assert.True(t, gjson.GetBytes(out, "data.0.aspect_ratio_matches_request").Bool())
	assert.Equal(t, "null", gjson.GetBytes(out, "quality_report_matches_request").Raw)
	assert.NotContains(t, string(out), "image_quality_report_mismatch")
}
