package controller

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"image/png"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestUpscaleRelayDeliversActualPixelsWithoutRegenerating(t *testing.T) {
	for _, tc := range []struct {
		model         string
		target, quota int
		fail          bool
	}{
		{"gpt-image-2.5-2k", 2048, 35000, false},
		{"gpt-image-2.5-4k", 4096, 40000, false},
		{"gpt-image-2.5-2k", 2048, 0, true},
	} {
		fail := tc.fail
		t.Run(tc.model+map[bool]string{false: " success", true: " worker failure refunds"}[fail], func(t *testing.T) {
			_, _ = setupDrawingTests(t)
			require.NoError(t, model.DB.AutoMigrate(&model.ImageUpscaleJob{}))
			oldPrices, oldGroups := ratio_setting.ModelPrice2JSONString(), ratio_setting.GroupRatio2JSONString()
			require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{"gpt-image-2.5-2k":0.07,"gpt-image-2.5-4k":0.08}`))
			require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1}`))
			t.Cleanup(func() {
				require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(oldPrices))
				require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(oldGroups))
			})
			common.OptionMapRWMutex.Lock()
			if common.OptionMap == nil {
				common.OptionMap = map[string]string{}
			}
			oldToken := common.OptionMap["ImageUpscaleWorkerToken"]
			common.OptionMap["ImageUpscaleWorkerToken"] = strings.Repeat("w", 48)
			common.OptionMapRWMutex.Unlock()
			t.Cleanup(func() {
				common.OptionMapRWMutex.Lock()
				common.OptionMap["ImageUpscaleWorkerToken"] = oldToken
				common.OptionMapRWMutex.Unlock()
			})
			service.TouchImageUpscaleWorker()
			var original, output bytes.Buffer
			require.NoError(t, png.Encode(&original, image.NewRGBA(image.Rect(0, 0, 1024, 1024))))
			require.NoError(t, png.Encode(&output, image.NewRGBA(image.Rect(0, 0, tc.target, tc.target))))
			var calls atomic.Int32
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls.Add(1)
				var req dto.ImageRequest
				assert.NoError(t, common.DecodeJson(r.Body, &req))
				assert.Equal(t, "gpt-image-2", req.Model)
				assert.Equal(t, "1024x1024", req.Size)
				assert.Equal(t, "keep this prompt", req.Prompt)
				body, e := common.Marshal(map[string]any{"data": []map[string]string{{"b64_json": base64.StdEncoding.EncodeToString(original.Bytes())}}})
				assert.NoError(t, e)
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write(body)
			}))
			defer upstream.Close()
			service.InitHttpClient()
			mapping := `{"gpt-image-2.5-2k":"gpt-image-2","gpt-image-2.5-4k":"gpt-image-2"}`
			channel := model.Channel{Type: 1, Key: "fixture", Name: "upscale-test", BaseURL: &upstream.URL, Models: tc.model, ModelMapping: &mapping, Group: "default", Status: 1}
			require.NoError(t, channel.Insert())
			token := model.Token{UserId: 81001, Key: strings.Repeat("u", 48), Status: 1, RemainQuota: 1000000, ExpiredTime: -1, Group: "default"}
			require.NoError(t, model.DB.Create(&token).Error)
			r := gin.New()
			r.Use(middleware.BodyStorageCleanup())
			r.POST("/v1/images/generations", middleware.TokenAuth(), middleware.Distribute(), func(c *gin.Context) { Relay(c, types.RelayFormatOpenAIImage) })
			worker := gin.New()
			worker.Use(ImageUpscaleWorkerAuth)
			worker.POST("/:id/result", ImageUpscaleJobIO)
			worker.POST("/:id/fail", ImageUpscaleJobIO)
			done := make(chan struct{})
			response := httptest.NewRecorder()
			go func() {
				defer close(done)
				req := httptest.NewRequest("POST", "/v1/images/generations", strings.NewReader(fmt.Sprintf(`{"model":%q,"prompt":"keep this prompt","size":"%dx%d","n":1}`, tc.model, tc.target, tc.target)))
				req.Header.Set("Content-Type", "application/json")
				req.Header.Set("Authorization", "Bearer sk-"+token.Key)
				r.ServeHTTP(response, req)
			}()
			var job *model.ImageUpscaleJob
			require.Eventually(t, func() bool {
				var e error
				job, e = model.ClaimImageUpscaleJob(time.Now().Unix())
				return e == nil && job != nil
			}, 5*time.Second, 10*time.Millisecond)
			send := func(path, lease string, data []byte, auth bool) *httptest.ResponseRecorder {
				req := httptest.NewRequest("POST", "/"+job.ID+path, bytes.NewReader(data))
				if auth {
					req.Header.Set("Authorization", "Bearer "+strings.Repeat("w", 48))
				}
				req.Header.Set("X-Upscale-Lease", lease)
				w := httptest.NewRecorder()
				worker.ServeHTTP(w, req)
				return w
			}
			assert.Equal(t, 401, send("/result", job.Lease, output.Bytes(), false).Code)
			assert.Equal(t, 404, send("/result", "stale", output.Bytes(), true).Code)
			assert.Equal(t, 422, send("/result", job.Lease, original.Bytes(), true).Code)
			if fail {
				require.Equal(t, 204, send("/fail", job.Lease, nil, true).Code)
			} else {
				require.Equal(t, 204, send("/result", job.Lease, output.Bytes(), true).Code)
				assert.Equal(t, 204, send("/result", job.Lease, output.Bytes(), true).Code)
			}
			select {
			case <-done:
			case <-time.After(5 * time.Second):
				t.Fatal("relay did not finish")
			}
			assert.EqualValues(t, 1, calls.Load())
			if fail {
				assert.Equal(t, 424, response.Code, response.Body.String())
				assert.Contains(t, response.Body.String(), "image_upscale_failed")
				assert.Equal(t, "false", response.Header().Get("x-should-retry"))
			} else {
				require.Equal(t, 200, response.Code, response.Body.String())
				decoded, e := base64.StdEncoding.DecodeString(gjson.GetBytes(response.Body.Bytes(), "data.0.b64_json").String())
				require.NoError(t, e)
				assert.Equal(t, output.Bytes(), decoded)
				assert.Equal(t, fmt.Sprintf("%dx%d", tc.target, tc.target), gjson.GetBytes(response.Body.Bytes(), "data.0.size").String())
			}
			require.Eventually(t, func() bool {
				var saved model.Token
				if model.DB.First(&saved, token.Id).Error != nil {
					return false
				}
				if fail {
					return saved.RemainQuota == 1000000
				}
				return saved.RemainQuota == 1000000-tc.quota
			}, 2*time.Second, 10*time.Millisecond)
		})
	}
}

func TestUpscaleWorkerCredentialIsStableAndHonorsDisable(t *testing.T) {
	_, _ = setupDrawingTests(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Option{}))
	common.OptionMapRWMutex.Lock()
	if common.OptionMap == nil {
		common.OptionMap = map[string]string{}
	}
	old := common.OptionMap["ImageUpscaleWorkerToken"]
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap["ImageUpscaleWorkerToken"] = old
		common.OptionMapRWMutex.Unlock()
	})
	require.NoError(t, model.InitImageUpscaleWorkerToken())
	first := service.DrawingOption("ImageUpscaleWorkerToken", "")
	require.GreaterOrEqual(t, len(first), 32)
	require.NoError(t, model.InitImageUpscaleWorkerToken())
	assert.True(t, first == service.DrawingOption("ImageUpscaleWorkerToken", ""), "credential changed on restart")
	require.NoError(t, model.DB.Model(&model.Option{}).Where(&model.Option{Key: "ImageUpscaleWorkerToken"}).Update("value", "").Error)
	require.NoError(t, model.InitImageUpscaleWorkerToken())
	assert.Empty(t, service.DrawingOption("ImageUpscaleWorkerToken", ""))
}
