package replicate

import (
	"bytes"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"reflect"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

type readErrorCloser struct {
	closed bool
}

func (*readErrorCloser) Read([]byte) (int, error) {
	return 0, errors.New("fixture read failure")
}

func (r *readErrorCloser) Close() error {
	r.closed = true
	return nil
}

func replicateEditRequestContext(t *testing.T) (*gin.Context, dto.ImageRequest) {
	return replicateEditRequestContextWithFiles(t, "image")
}

func replicateEditRequestContextWithFiles(t *testing.T, fileFields ...string) (*gin.Context, dto.ImageRequest) {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("prompt", "edit prompt"))
	for index, field := range fileFields {
		image, err := writer.CreateFormFile(field, "fixture-"+string(rune('a'+index))+".png")
		require.NoError(t, err)
		_, err = image.Write([]byte("fixture image"))
		require.NoError(t, err)
	}
	require.NoError(t, writer.Close())

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", bytes.NewReader(body.Bytes()))
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	require.NoError(t, c.Request.ParseMultipartForm(1<<20))

	request := dto.ImageRequest{}
	require.NoError(t, common.Unmarshal([]byte(`{
		"model":"billing-model",
		"prompt":"edit prompt",
		"n":1,
		"input":{"negative_prompt":"merged negative prompt","image_prompt":"https://ignored.invalid/input.png"}
	}`), &request))
	return c, request
}

func TestImageFileFromFormRequiresExactlyOneExplicitCandidate(t *testing.T) {
	for _, testCase := range []struct {
		name       string
		fileFields []string
		wantFile   bool
		wantError  bool
	}{
		{name: "image", fileFields: []string{"image"}, wantFile: true},
		{name: "image array", fileFields: []string{"image[]"}, wantFile: true},
		{name: "image prompt", fileFields: []string{"image_prompt"}, wantFile: true},
		{name: "mask only", fileFields: []string{"mask"}},
		{name: "unknown only", fileFields: []string{"reference"}},
		{name: "multiple candidates", fileFields: []string{"image", "image[]"}, wantError: true},
		{name: "multiple files", fileFields: []string{"image", "image"}, wantError: true},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			c, _ := replicateEditRequestContextWithFiles(t, testCase.fileFields...)

			fileHeader, err := imageFileFromForm(c, "image", "image[]", "image_prompt")

			if testCase.wantError {
				require.Error(t, err)
				assert.Nil(t, fileHeader)
				return
			}
			require.NoError(t, err)
			if testCase.wantFile {
				require.NotNil(t, fileHeader)
			} else {
				assert.Nil(t, fileHeader)
			}
		})
	}
}

func TestDoResponseClosesBodyWhenReadFails(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	body := &readErrorCloser{}

	_, apiErr := (&Adaptor{}).DoResponse(c, &http.Response{Body: body}, nil)

	require.NotNil(t, apiErr)
	assert.Equal(t, types.ErrorCodeReadResponseBodyFailed, apiErr.GetErrorCode())
	assert.True(t, body.closed)
}

func replicateEditInfo(baseURL string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeReplicate,
			ApiType:           constant.APITypeReplicate,
			ChannelBaseUrl:    baseURL,
			ApiKey:            "local-test-key",
			UpstreamModelName: ModelFlux11Pro,
		},
		RelayMode: relayconstant.RelayModeImagesEdits,
	}
}

func TestPrepareAndFinalizeImageRequestDefersReplicateEditUpload(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service.InitHttpClient()

	var uploads atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		assert.Equal(t, "/v1/files", request.URL.Path)
		uploads.Add(1)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = io.WriteString(w, `{"urls":{"get":"https://files.invalid/input.png"}}`)
	}))
	t.Cleanup(upstream.Close)

	c, request := replicateEditRequestContext(t)
	adaptor := &Adaptor{}
	info := replicateEditInfo(upstream.URL)

	prepared, err := adaptor.PrepareImageRequest(c, info, request)
	require.NoError(t, err)
	assert.Zero(t, uploads.Load(), "prepare must not perform network I/O")

	preparedJSON, err := common.Marshal(prepared)
	require.NoError(t, err)
	assert.Equal(t, "edit prompt", gjson.GetBytes(preparedJSON, "input.prompt").String())
	assert.Equal(t, "merged negative prompt", gjson.GetBytes(preparedJSON, "input.negative_prompt").String())
	assert.Equal(t, int64(1), gjson.GetBytes(preparedJSON, "input.num_outputs").Int())
	assert.False(t, gjson.GetBytes(preparedJSON, "input.image_prompt").Exists())

	finalized, err := adaptor.FinalizeImageRequest(c, info, preparedJSON)
	require.NoError(t, err)
	assert.Equal(t, int32(1), uploads.Load())

	finalizedJSON, err := common.Marshal(finalized)
	require.NoError(t, err)
	assert.Equal(t, "https://files.invalid/input.png", gjson.GetBytes(finalizedJSON, "input.image_prompt").String())
	assert.Equal(t, gjson.GetBytes(preparedJSON, "input.prompt").String(), gjson.GetBytes(finalizedJSON, "input.prompt").String())
	assert.Equal(t, gjson.GetBytes(preparedJSON, "input.negative_prompt").String(), gjson.GetBytes(finalizedJSON, "input.negative_prompt").String())
	assert.Equal(t, gjson.GetBytes(preparedJSON, "input.num_outputs").Int(), gjson.GetBytes(finalizedJSON, "input.num_outputs").Int())
}

func TestConvertImageRequestRetainsDirectCallerCompatibility(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service.InitHttpClient()

	var uploads atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		uploads.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"urls":{"get":"https://files.invalid/direct.png"}}`)
	}))
	t.Cleanup(upstream.Close)

	c, request := replicateEditRequestContext(t)
	converted, err := (&Adaptor{}).ConvertImageRequest(c, replicateEditInfo(upstream.URL), request)
	require.NoError(t, err)
	assert.Equal(t, int32(1), uploads.Load())

	convertedJSON, err := common.Marshal(converted)
	require.NoError(t, err)
	assert.Equal(t, "https://files.invalid/direct.png", gjson.GetBytes(convertedJSON, "input.image_prompt").String())
}

func TestFinalizeImageRequestMarksUploadTransportFailureSkipRetry(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service.InitHttpClient()

	var uploads atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		uploads.Add(1)
		hijacker, ok := w.(http.Hijacker)
		require.True(t, ok)
		connection, _, err := hijacker.Hijack()
		require.NoError(t, err)
		require.NoError(t, connection.Close())
	}))
	t.Cleanup(upstream.Close)

	c, request := replicateEditRequestContext(t)
	adaptor := &Adaptor{}
	info := replicateEditInfo(upstream.URL)
	prepared, err := adaptor.PrepareImageRequest(c, info, request)
	require.NoError(t, err)
	preparedJSON, err := common.Marshal(prepared)
	require.NoError(t, err)

	_, err = adaptor.FinalizeImageRequest(c, info, preparedJSON)
	require.Error(t, err)
	var apiErr *types.NewAPIError
	require.ErrorAs(t, err, &apiErr)
	assert.True(t, types.IsSkipRetryError(apiErr))
	assert.Equal(t, int32(1), uploads.Load())
}

func TestFinalizeImageRequestDoesNotFollowUploadRedirects(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service.InitHttpClient()

	fetchSetting := system_setting.GetFetchSetting()
	previousFetchSetting := *fetchSetting
	fetchSetting.EnableSSRFProtection = false
	t.Cleanup(func() { *fetchSetting = previousFetchSetting })

	sharedClient := service.GetHttpClient()
	require.NotNil(t, sharedClient)
	require.NotNil(t, sharedClient.CheckRedirect)
	originalRedirectPolicy := reflect.ValueOf(sharedClient.CheckRedirect).Pointer()

	for _, statusCode := range []int{http.StatusTemporaryRedirect, http.StatusPermanentRedirect} {
		t.Run(http.StatusText(statusCode), func(t *testing.T) {
			var redirectedUploads atomic.Int32
			redirectTarget := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
				redirectedUploads.Add(1)
				assert.Equal(t, http.MethodPost, request.Method)
				w.Header().Set("Content-Type", "application/json")
				_, _ = io.WriteString(w, `{"urls":{"get":"https://files.invalid/redirected.png"}}`)
			}))
			t.Cleanup(redirectTarget.Close)

			var uploads atomic.Int32
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
				uploads.Add(1)
				assert.Equal(t, http.MethodPost, request.Method)
				w.Header().Set("Location", redirectTarget.URL+"/redirected")
				w.WriteHeader(statusCode)
			}))
			t.Cleanup(upstream.Close)

			c, request := replicateEditRequestContext(t)
			adaptor := &Adaptor{}
			info := replicateEditInfo(upstream.URL)
			prepared, err := adaptor.PrepareImageRequest(c, info, request)
			require.NoError(t, err)
			preparedJSON, err := common.Marshal(prepared)
			require.NoError(t, err)

			_, err = adaptor.FinalizeImageRequest(c, info, preparedJSON)
			require.Error(t, err)
			var apiErr *types.NewAPIError
			require.ErrorAs(t, err, &apiErr)
			assert.True(t, types.IsSkipRetryError(apiErr))
			var started interface {
				ImageSubmissionStarted() bool
			}
			require.ErrorAs(t, err, &started)
			assert.True(t, started.ImageSubmissionStarted())
			assert.Equal(t, int32(1), uploads.Load())
			assert.Zero(t, redirectedUploads.Load())
		})
	}

	assert.Equal(t, originalRedirectPolicy, reflect.ValueOf(sharedClient.CheckRedirect).Pointer(),
		"upload redirect policy must not mutate the shared client")
}
