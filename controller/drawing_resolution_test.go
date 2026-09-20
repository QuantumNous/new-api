package controller

import (
	"bytes"
	"context"
	"encoding/base64"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDrawingProAliasRelayAndFlatPrice(t *testing.T) {
	r, pngData := setupDrawingTests(t)
	var received []string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var name, size string
		if r.URL.Path == "/v1/images/edits" {
			require.NoError(t, r.ParseMultipartForm(1<<20))
			defer r.MultipartForm.RemoveAll()
			name, size = r.FormValue("model"), r.FormValue("size")
			file, _, err := r.FormFile("image")
			require.NoError(t, err)
			data, err := io.ReadAll(file)
			file.Close()
			require.NoError(t, err)
			assert.Equal(t, pngData, data)
		} else {
			assert.Equal(t, "/v1/images/generations", r.URL.Path)
			var payload struct{ Model, Size string }
			require.NoError(t, common.DecodeJson(r.Body, &payload))
			name, size = payload.Model, payload.Size
		}
		assert.Equal(t, "image2.5-pro", name)
		received = append(received, size)
		w.Header().Set("Content-Type", "application/json")
		_, err := w.Write([]byte(`{"data":[{"b64_json":"` + base64.StdEncoding.EncodeToString(pngData) + `"}]}`))
		assert.NoError(t, err)
	}))
	defer upstream.Close()
	service.InitHttpClient()
	oldPrices, oldGroups := ratio_setting.ModelPrice2JSONString(), ratio_setting.GroupRatio2JSONString()
	// The site's USD-to-CNY display rate is applied when configuring this price.
	// A $0.07 price at rate 1 with the default group yields 35,000 quota/image.
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{"gpt-image-2.5-2k":0.07,"gpt-image-2.5-4k":0.07}`))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1}`))
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(oldPrices))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(oldGroups))
	})
	mapping := `{"gpt-image-2.5-2k":"image2.5-pro","gpt-image-2.5-4k":"image2.5-pro"}`
	channel := model.Channel{ModelMapping: &mapping, Type: 1, Key: "local-test-only", Name: "pro-test", BaseURL: &upstream.URL, Status: common.ChannelStatusEnabled, Models: "gpt-image-2.5-2k,gpt-image-2.5-4k", Group: "default"}
	require.NoError(t, channel.Insert())
	for _, alias := range []string{"gpt-image-2.5-2k", "gpt-image-2.5-4k"} {
		for _, reference := range [][]byte{nil, pngData} {
			input := drawingSubmission{SubmissionID: uuid.NewString(), Model: alias, Group: "default", Ratio: "16:9", Prompt: "Product"}
			response := submitDrawingTestBatch(t, r, input, reference)
			require.Equal(t, 202, response.Code, response.Body.String())
			var batch model.DrawingBatch
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &batch))
			saved, err := model.GetDrawingBatch(81001, batch.ID)
			require.NoError(t, err)
			assert.Equal(t, alias, saved.Model)
			item, err := model.ClaimDrawingItem(service.DrawingNow(), 4)
			require.NoError(t, err)
			require.NotNil(t, item)
			executeDrawingItem(item)
			saved, err = model.GetDrawingBatch(81001, batch.ID)
			require.NoError(t, err)
			assert.Equal(t, "succeeded", saved.Items[0].Status, saved.Items[0].Error)
		}
	}
	// Exercise a raw API-shaped request with no size: the alias determines its default.
	for _, alias := range []string{"gpt-image-2.5-2k", "gpt-image-2.5-4k"} {
		var response bytes.Buffer
		result := runDrawingRelay(context.Background(), drawingIdentity{UserID: 81001, Group: "default"}, "/pg/images/generations", "application/json", strings.NewReader(`{"model":"`+alias+`","prompt":"Product","n":1}`), &response, service.MaxDrawingResponseBytes)
		require.Equal(t, 200, result.status, response.String())
	}
	var edit, output bytes.Buffer
	form := multipart.NewWriter(&edit)
	require.NoError(t, form.WriteField("model", "gpt-image-2.5-4k"))
	require.NoError(t, form.WriteField("size", "1024x1536"))
	require.NoError(t, form.WriteField("prompt", "Product"))
	file, err := form.CreateFormFile("image", "reference.png")
	require.NoError(t, err)
	_, err = file.Write(pngData)
	require.NoError(t, err)
	require.NoError(t, form.Close())
	result := runDrawingRelay(context.Background(), drawingIdentity{UserID: 81001, Group: "default"}, "/pg/images/edits", form.FormDataContentType(), &edit, &output, service.MaxDrawingResponseBytes)
	require.Equal(t, 200, result.status, output.String())
	assert.Equal(t, []string{"2048x1152", "2048x1152", "3840x2160", "3840x2160", "2048x2048", "2880x2880", "2560x3840"}, received)
	user, err := model.GetUserById(81001, false)
	require.NoError(t, err)
	assert.Equal(t, 10_000_000-7*35000, user.Quota)
}
