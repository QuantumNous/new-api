package groksubscription

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
)

func newVideoTestContext(body string) (*gin.Context, *relaycommon.RelayInfo) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c, &relaycommon.RelayInfo{}
}

type noBytesBodyStorage struct {
	*bytes.Reader
}

func (s *noBytesBodyStorage) Close() error { return nil }

func (s *noBytesBodyStorage) Bytes() ([]byte, error) {
	return nil, fmt.Errorf("Bytes must not be called")
}

func (s *noBytesBodyStorage) Size() int64 { return int64(s.Len()) }

func (s *noBytesBodyStorage) IsDisk() bool { return true }

func ptrStringValue(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func ptrIntValue(p *int) int {
	if p == nil {
		return 0
	}
	return *p
}

func TestValidateVideoRequestAcceptsGenerateMatrix(t *testing.T) {
	referenceImages := `[` +
		`{"url":"https://example.com/1.png"},` +
		`{"url":"https://example.com/2.png"},` +
		`{"url":"https://example.com/3.png"},` +
		`{"url":"https://example.com/4.png"},` +
		`{"url":"https://example.com/5.png"},` +
		`{"url":"https://example.com/6.png"},` +
		`{"url":"https://example.com/7.png"}` +
		`]`
	referenceAudios := `[` +
		`{"voice_id":"voice-1"},` +
		`{"voice_id":"voice-2"},` +
		`{"voice_id":"voice-3"}` +
		`]`

	cases := []struct {
		name          string
		body          string
		wantAction    string
		wantDuration  int
		wantImageURL  string
		wantRefImages int
		wantRefAudios int
	}{
		{
			name:         "default action text only defaults duration to five seconds",
			body:         `{"model":"grok-imagine-video-1.5","prompt":"orbiting library"}`,
			wantAction:   actionGenerate,
			wantDuration: 5,
		},
		{
			name:         "explicit generate with image data uri and 1080p on 1.5",
			body:         `{"model":"grok-imagine-video-1.5","action":"generate","prompt":"make it move","duration":15,"aspect_ratio":"16:9","resolution":"1080p","image":{"url":"data:image/png;base64,QUJD"}}`,
			wantAction:   actionGenerate,
			wantDuration: 15,
			wantImageURL: "data:image/png;base64,QUJD",
		},
		{
			name:          "seven reference images accepted at max",
			body:          `{"model":"grok-imagine-video-1.5","action":"generate","prompt":"style study","reference_images":` + referenceImages + `}`,
			wantAction:    actionGenerate,
			wantDuration:  5,
			wantRefImages: 7,
		},
		{
			name:          "three reference voices accepted at max",
			body:          `{"model":"grok-imagine-video-1.5","action":"generate","prompt":"narrated scene","reference_audios":` + referenceAudios + `}`,
			wantAction:    actionGenerate,
			wantDuration:  5,
			wantRefAudios: 3,
		},
		{
			name:          "mixed image and voice references accepted",
			body:          `{"model":"grok-imagine-video-1.5","action":"generate","prompt":"mixed refs","reference_images":[{"url":"https://example.com/ref.jpg"}],"reference_audios":[{"voice_id":"voice-1"}],"duration":1,"aspect_ratio":"2:3","resolution":"720p"}`,
			wantAction:    actionGenerate,
			wantDuration:  1,
			wantRefImages: 1,
			wantRefAudios: 1,
		},
		{
			name:         "legacy model allows 720p text generation",
			body:         `{"model":"grok-imagine-video","prompt":"legacy text","duration":2,"aspect_ratio":"3:2","resolution":"720p"}`,
			wantAction:   actionGenerate,
			wantDuration: 2,
		},
		{
			name:         "legacy model allows 480p text generation",
			body:         `{"model":"grok-imagine-video","prompt":"legacy low tier","duration":2,"resolution":"480p"}`,
			wantAction:   actionGenerate,
			wantDuration: 2,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c, info := newVideoTestContext(tc.body)
			req, err := validateVideoRequest(c, info)
			if err != nil {
				t.Fatalf("validateVideoRequest returned error: %v", err)
			}
			if req.Action != tc.wantAction {
				t.Fatalf("action = %q, want %q", req.Action, tc.wantAction)
			}
			if got := ptrIntValue(req.Duration); got != tc.wantDuration {
				t.Fatalf("duration = %d, want %d", got, tc.wantDuration)
			}
			if tc.wantImageURL != "" && (req.Image == nil || req.Image.URL != tc.wantImageURL) {
				t.Fatalf("image = %+v, want url %q", req.Image, tc.wantImageURL)
			}
			if len(req.ReferenceImages) != tc.wantRefImages {
				t.Fatalf("reference_images len = %d, want %d", len(req.ReferenceImages), tc.wantRefImages)
			}
			if len(req.ReferenceAudios) != tc.wantRefAudios {
				t.Fatalf("reference_audios len = %d, want %d", len(req.ReferenceAudios), tc.wantRefAudios)
			}

			stored, err := getVideoRequest(c)
			if err != nil {
				t.Fatalf("getVideoRequest: %v", err)
			}
			if stored != req {
				t.Fatalf("stored request pointer mismatch")
			}

			taskReq, err := relaycommon.GetTaskRequest(c)
			if err != nil {
				t.Fatalf("GetTaskRequest: %v", err)
			}
			if taskReq.Model != req.Model || taskReq.Prompt != req.Prompt || taskReq.Duration != tc.wantDuration {
				t.Fatalf("task request = %+v, want model/prompt/duration from validated request %+v", taskReq, req)
			}
			if taskReq.Ratio != ptrStringValue(req.AspectRatio) || taskReq.Resolution != ptrStringValue(req.Resolution) {
				t.Fatalf("task request ratio/resolution = %q/%q, want %q/%q", taskReq.Ratio, taskReq.Resolution, ptrStringValue(req.AspectRatio), ptrStringValue(req.Resolution))
			}
		})
	}
}

func TestValidateVideoRequestAcceptsEveryAspectRatio(t *testing.T) {
	for _, ratio := range []string{"1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"} {
		t.Run(ratio, func(t *testing.T) {
			c, info := newVideoTestContext(`{"model":"grok-imagine-video-1.5","prompt":"ratio","aspect_ratio":"` + ratio + `"}`)
			req, err := validateVideoRequest(c, info)
			if err != nil {
				t.Fatalf("validateVideoRequest(%s): %v", ratio, err)
			}
			if req.AspectRatio == nil || *req.AspectRatio != ratio {
				t.Fatalf("aspect_ratio = %v, want %q", req.AspectRatio, ratio)
			}
		})
	}
}

func TestValidateVideoRequestAcceptsEditAndExtend(t *testing.T) {
	cases := []struct {
		name         string
		body         string
		wantAction   string
		wantDuration int
	}{
		{
			name:         "edit requires prompt and video and carries no duration",
			body:         `{"model":"grok-imagine-video","action":"edit","prompt":"add rain","video":{"url":"data:video/mp4;base64,QUJD"}}`,
			wantAction:   actionEdit,
			wantDuration: 0,
		},
		{
			name:         "extend defaults duration to six seconds",
			body:         `{"model":"grok-imagine-video","action":"extend","prompt":"continue","video":{"url":"https://example.com/in.mp4"}}`,
			wantAction:   actionExtend,
			wantDuration: 6,
		},
		{
			name:         "extend accepts upper duration bound",
			body:         `{"model":"grok-imagine-video","action":"extend","prompt":"continue","duration":10,"video":{"url":"https://example.com/in.mp4"}}`,
			wantAction:   actionExtend,
			wantDuration: 10,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c, info := newVideoTestContext(tc.body)
			req, err := validateVideoRequest(c, info)
			if err != nil {
				t.Fatalf("validateVideoRequest returned error: %v", err)
			}
			if req.Action != tc.wantAction {
				t.Fatalf("action = %q, want %q", req.Action, tc.wantAction)
			}
			if got := ptrIntValue(req.Duration); got != tc.wantDuration {
				t.Fatalf("duration = %d, want %d", got, tc.wantDuration)
			}
			taskReq, err := relaycommon.GetTaskRequest(c)
			if err != nil {
				t.Fatalf("GetTaskRequest: %v", err)
			}
			if taskReq.InputReference != "data:video/mp4;base64,QUJD" && strings.Contains(tc.body, "data:video") {
				t.Fatalf("task request input_reference = %q, want video data uri", taskReq.InputReference)
			}
		})
	}
}

func TestValidateVideoRequestRejectsInvalidMatrix(t *testing.T) {
	eightImages := `[` +
		`{"url":"https://example.com/1.png"},{"url":"https://example.com/2.png"},` +
		`{"url":"https://example.com/3.png"},{"url":"https://example.com/4.png"},` +
		`{"url":"https://example.com/5.png"},{"url":"https://example.com/6.png"},` +
		`{"url":"https://example.com/7.png"},{"url":"https://example.com/8.png"}` +
		`]`
	fourVoices := `[{"voice_id":"a"},{"voice_id":"b"},{"voice_id":"c"},{"voice_id":"d"}]`

	cases := []struct {
		name string
		body string
	}{
		{"unsupported model", `{"model":"grok-4","prompt":"x"}`},
		{"unsupported action", `{"model":"grok-imagine-video-1.5","action":"upscale","prompt":"x"}`},
		{"does not infer edit from video without action", `{"model":"grok-imagine-video","prompt":"x","video":{"url":"https://example.com/in.mp4"}}`},
		{"does not infer image generation without prompt", `{"model":"grok-imagine-video-1.5","image":{"url":"https://example.com/a.png"}}`},
		{"generate rejects video", `{"model":"grok-imagine-video","action":"generate","prompt":"x","video":{"url":"https://example.com/in.mp4"}}`},
		{"generate rejects image mixed with reference images", `{"model":"grok-imagine-video-1.5","prompt":"x","image":{"url":"https://example.com/a.png"},"reference_images":[{"url":"https://example.com/b.png"}]}`},
		{"generate rejects image mixed with reference voices", `{"model":"grok-imagine-video-1.5","prompt":"x","image":{"url":"https://example.com/a.png"},"reference_audios":[{"voice_id":"v"}]}`},
		{"legacy model rejects reference voices", `{"model":"grok-imagine-video","prompt":"x","reference_audios":[{"voice_id":"v"}]}`},
		{"legacy model rejects 1080p", `{"model":"grok-imagine-video","prompt":"x","resolution":"1080p"}`},
		{"one point five rejects 1080p reference generation", `{"model":"grok-imagine-video-1.5","prompt":"x","resolution":"1080p","reference_images":[{"url":"https://example.com/a.png"}]}`},
		{"generate duration lower bound", `{"model":"grok-imagine-video-1.5","prompt":"x","duration":0}`},
		{"generate duration upper bound", `{"model":"grok-imagine-video-1.5","prompt":"x","duration":16}`},
		{"extend duration lower bound", `{"model":"grok-imagine-video","action":"extend","prompt":"x","duration":1,"video":{"url":"https://example.com/in.mp4"}}`},
		{"extend duration upper bound", `{"model":"grok-imagine-video","action":"extend","prompt":"x","duration":11,"video":{"url":"https://example.com/in.mp4"}}`},
		{"invalid ratio", `{"model":"grok-imagine-video-1.5","prompt":"x","aspect_ratio":"21:9"}`},
		{"invalid resolution", `{"model":"grok-imagine-video-1.5","prompt":"x","resolution":"4k"}`},
		{"too many reference images", `{"model":"grok-imagine-video-1.5","prompt":"x","reference_images":` + eightImages + `}`},
		{"too many reference voices", `{"model":"grok-imagine-video-1.5","prompt":"x","reference_audios":` + fourVoices + `}`},
		{"edit only legacy model", `{"model":"grok-imagine-video-1.5","action":"edit","prompt":"x","video":{"url":"https://example.com/in.mp4"}}`},
		{"edit rejects image", `{"model":"grok-imagine-video","action":"edit","prompt":"x","video":{"url":"https://example.com/in.mp4"},"image":{"url":"https://example.com/a.png"}}`},
		{"edit rejects refs", `{"model":"grok-imagine-video","action":"edit","prompt":"x","video":{"url":"https://example.com/in.mp4"},"reference_images":[{"url":"https://example.com/a.png"}]}`},
		{"edit rejects duration", `{"model":"grok-imagine-video","action":"edit","prompt":"x","duration":2,"video":{"url":"https://example.com/in.mp4"}}`},
		{"edit rejects aspect ratio", `{"model":"grok-imagine-video","action":"edit","prompt":"x","aspect_ratio":"1:1","video":{"url":"https://example.com/in.mp4"}}`},
		{"edit rejects resolution", `{"model":"grok-imagine-video","action":"edit","prompt":"x","resolution":"480p","video":{"url":"https://example.com/in.mp4"}}`},
		{"extend rejects image", `{"model":"grok-imagine-video","action":"extend","prompt":"x","duration":2,"video":{"url":"https://example.com/in.mp4"},"image":{"url":"https://example.com/a.png"}}`},
		{"extend rejects refs", `{"model":"grok-imagine-video","action":"extend","prompt":"x","duration":2,"video":{"url":"https://example.com/in.mp4"},"reference_audios":[{"voice_id":"v"}]}`},
		{"extend rejects aspect ratio", `{"model":"grok-imagine-video","action":"extend","prompt":"x","duration":2,"aspect_ratio":"1:1","video":{"url":"https://example.com/in.mp4"}}`},
		{"extend rejects resolution", `{"model":"grok-imagine-video","action":"extend","prompt":"x","duration":2,"resolution":"480p","video":{"url":"https://example.com/in.mp4"}}`},
		{"http image rejected", `{"model":"grok-imagine-video-1.5","prompt":"x","image":{"url":"http://example.com/a.png"}}`},
		{"http video rejected", `{"model":"grok-imagine-video","action":"extend","prompt":"x","video":{"url":"http://example.com/in.mp4"}}`},
		{"whitespace wrapped https image rejected", `{"model":"grok-imagine-video-1.5","prompt":"x","image":{"url":" https://example.com/a.png "}}`},
		{"whitespace wrapped image data uri rejected", `{"model":"grok-imagine-video-1.5","prompt":"x","image":{"url":" data:image/png;base64,QUJD "}}`},
		{"whitespace wrapped https video rejected", `{"model":"grok-imagine-video","action":"extend","prompt":"x","video":{"url":" https://example.com/in.mp4 "}}`},
		{"whitespace wrapped video data uri rejected", `{"model":"grok-imagine-video","action":"extend","prompt":"x","video":{"url":" data:video/mp4;base64,QUJD "}}`},
		{"empty image object rejected", `{"model":"grok-imagine-video-1.5","prompt":"x","image":{}}`},
		{"empty reference voice rejected", `{"model":"grok-imagine-video-1.5","prompt":"x","reference_audios":[{"voice_id":" "}]}`},
		{"malformed image data uri rejected", `{"model":"grok-imagine-video-1.5","prompt":"x","image":{"url":"data:image/gif;base64,AAAA"}}`},
		{"malformed video data uri rejected", `{"model":"grok-imagine-video","action":"extend","prompt":"x","video":{"url":"data:video/webm;base64,AAAA"}}`},
		{"top-level user rejected", `{"model":"grok-imagine-video-1.5","prompt":"x","user":"u"}`},
		{"top-level storage_options rejected", `{"model":"grok-imagine-video-1.5","prompt":"x","storage_options":{"store":true}}`},
		{"top-level file_id rejected", `{"model":"grok-imagine-video-1.5","prompt":"x","file_id":"file-1"}`},
		{"nested file_id rejected", `{"model":"grok-imagine-video-1.5","prompt":"x","image":{"file_id":"file-1"}}`},
		{"unknown media field rejected", `{"model":"grok-imagine-video-1.5","prompt":"x","image":{"url":"https://example.com/a.png","mime_type":"image/png"}}`},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c, info := newVideoTestContext(tc.body)
			if _, err := validateVideoRequest(c, info); err == nil {
				t.Fatalf("validateVideoRequest accepted invalid body: %s", tc.body)
			}
		})
	}
}

func TestDecodeVideoRequestStreamsBodyStorageAndKeepsBodyReusable(t *testing.T) {
	body := []byte(`{"model":"grok-imagine-video-1.5","prompt":"stream","image":{"url":"https://example.com/a.png"}}`)
	c, info := newVideoTestContext("")
	storage := &noBytesBodyStorage{Reader: bytes.NewReader(body)}
	c.Set(common.KeyBodyStorage, storage)
	c.Request.Body = io.NopCloser(storage)

	req, err := validateVideoRequest(c, info)
	if err != nil {
		t.Fatalf("validateVideoRequest: %v", err)
	}
	if req.Image == nil || req.Image.URL != "https://example.com/a.png" {
		t.Fatalf("image = %+v", req.Image)
	}

	var again VideoRequest
	if err := common.UnmarshalBodyReusable(c, &again); err != nil {
		t.Fatalf("body was not reusable after strict decode: %v", err)
	}
	if again.Model != ModelGrokImagineVideo15 || again.Prompt != "stream" {
		t.Fatalf("redecoded body = %+v", again)
	}
}

func TestBuildUpstreamVideoRequestUsesActionSpecificLiteralPayloads(t *testing.T) {
	cases := []struct {
		name string
		body string
		want string
	}{
		{
			name: "generate text emits normalized duration",
			body: `{"model":"grok-imagine-video-1.5","prompt":"orbit"}`,
			want: `{"model":"grok-imagine-video-1.5","prompt":"orbit","duration":5}`,
		},
		{
			name: "generate image emits only generate fields",
			body: `{"model":"grok-imagine-video-1.5","action":"generate","prompt":"move","duration":6,"aspect_ratio":"16:9","resolution":"1080p","image":{"url":"https://example.com/a.png?x=1&y=2"}}`,
			want: `{"model":"grok-imagine-video-1.5","prompt":"move","duration":6,"aspect_ratio":"16:9","resolution":"1080p","image":{"url":"https://example.com/a.png?x=1&y=2"}}`,
		},
		{
			name: "generate references emits reference arrays",
			body: `{"model":"grok-imagine-video-1.5","prompt":"refs","duration":1,"aspect_ratio":"1:1","resolution":"720p","reference_images":[{"url":"https://example.com/a.jpg"}],"reference_audios":[{"voice_id":"voice-1"}]}`,
			want: `{"model":"grok-imagine-video-1.5","prompt":"refs","duration":1,"aspect_ratio":"1:1","resolution":"720p","reference_images":[{"url":"https://example.com/a.jpg"}],"reference_audios":[{"voice_id":"voice-1"}]}`,
		},
		{
			name: "edit omits generate and extend fields",
			body: `{"model":"grok-imagine-video","action":"edit","prompt":"replace sky","video":{"url":"https://example.com/in.mp4"}}`,
			want: `{"model":"grok-imagine-video","prompt":"replace sky","video":{"url":"https://example.com/in.mp4"}}`,
		},
		{
			name: "extend emits only video and normalized duration",
			body: `{"model":"grok-imagine-video","action":"extend","prompt":"continue","video":{"url":"https://example.com/in.mp4"}}`,
			want: `{"model":"grok-imagine-video","prompt":"continue","duration":6,"video":{"url":"https://example.com/in.mp4"}}`,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c, info := newVideoTestContext(tc.body)
			req, err := validateVideoRequest(c, info)
			if err != nil {
				t.Fatalf("validateVideoRequest: %v", err)
			}
			payload := buildUpstreamVideoRequest(req)
			data, err := common.MarshalNoHTMLEscape(payload)
			if err != nil {
				t.Fatalf("marshal payload: %v", err)
			}
			if string(data) != tc.want {
				t.Fatalf("payload JSON = %s\nwant         = %s", data, tc.want)
			}
		})
	}
}
