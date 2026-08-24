package ali

import (
	"bytes"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
)

func newHappyHorseContext(body, contentType string) *gin.Context {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/videos", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", contentType)
	return c
}

func TestBindHappyHorseRequestOfficialJSONPreservesExplicitZeroValues(t *testing.T) {
	c := newHappyHorseContext(`{
		"model":"happyhorse-1.1-i2v",
		"input":{"prompt":"animate this","media":[{"type":"first_frame","url":"https://example.com/input.png"}]},
		"parameters":{"resolution":"720P","duration":5,"seed":0,"watermark":false}
	}`, "application/json; charset=utf-8")

	req, err := BindHappyHorseRequest(c)
	if err != nil {
		t.Fatalf("BindHappyHorseRequest() error = %v", err)
	}
	if req.Parameters.Seed == nil || *req.Parameters.Seed != 0 {
		t.Fatalf("seed = %#v, want pointer to 0", req.Parameters.Seed)
	}
	if req.Parameters.Watermark == nil || *req.Parameters.Watermark {
		t.Fatalf("watermark = %#v, want pointer to false", req.Parameters.Watermark)
	}

	data, err := common.Marshal(req)
	if err != nil {
		t.Fatalf("common.Marshal() error = %v", err)
	}
	if !bytes.Contains(data, []byte(`"seed":0`)) {
		t.Fatalf("marshaled request omitted explicit seed zero: %s", data)
	}
	if !bytes.Contains(data, []byte(`"watermark":false`)) {
		t.Fatalf("marshaled request omitted explicit watermark false: %s", data)
	}
}

func TestBindHappyHorseRequestRejectsNonJSON(t *testing.T) {
	for _, contentType := range []string{
		"multipart/form-data; boundary=boundary",
		"application/x-www-form-urlencoded",
		"",
	} {
		t.Run(contentType, func(t *testing.T) {
			c := newHappyHorseContext("model=happyhorse-1.1-t2v&prompt=test", contentType)
			if _, err := BindHappyHorseRequest(c); err == nil {
				t.Fatalf("BindHappyHorseRequest() accepted Content-Type %q", contentType)
			}
		})
	}
}

func TestBindHappyHorseRequestRejectsFlatJSON(t *testing.T) {
	c := newHappyHorseContext(`{
		"model":"happyhorse-1.1-t2v",
		"prompt":"flat requests are unsupported",
		"duration":5
	}`, "application/json")

	if _, err := BindHappyHorseRequest(c); err == nil {
		t.Fatal("BindHappyHorseRequest() accepted a flat-only request")
	}
}

func TestBindHappyHorseRequestValidatesMediaStructure(t *testing.T) {
	c := newHappyHorseContext(`{
		"model":"happyhorse-1.1-i2v",
		"input":{"media":[{"type":"first_frame","url":""}]},
		"parameters":{}
	}`, "application/json")

	if _, err := BindHappyHorseRequest(c); err == nil {
		t.Fatal("BindHappyHorseRequest() accepted media without a URL")
	}
}

func TestGetHappyHorseRequestUsesContextCache(t *testing.T) {
	c := newHappyHorseContext(`{
		"model":"happyhorse-1.1-t2v",
		"input":{"prompt":"a horse running"},
		"parameters":{"duration":5}
	}`, "application/json")

	bound, err := BindHappyHorseRequest(c)
	if err != nil {
		t.Fatalf("BindHappyHorseRequest() error = %v", err)
	}
	cached, err := GetHappyHorseRequest(c)
	if err != nil {
		t.Fatalf("GetHappyHorseRequest() error = %v", err)
	}
	if cached != bound {
		t.Fatal("GetHappyHorseRequest() did not return the cached request pointer")
	}
}

func TestHappyHorseParametersOmitAbsentOptionalFields(t *testing.T) {
	data, err := common.Marshal(HappyHorseParameters{})
	if err != nil {
		t.Fatalf("common.Marshal() error = %v", err)
	}
	if string(data) != "{}" {
		t.Fatalf("marshaled empty parameters = %s, want {}", data)
	}
}

func TestHappyHorseRequestValidation(t *testing.T) {
	stringPointer := func(value string) *string { return &value }
	intPointer := func(value int) *int { return &value }
	images := func(count int) []HappyHorseMedia {
		media := make([]HappyHorseMedia, count)
		for i := range media {
			media[i] = HappyHorseMedia{Type: "reference_image", URL: "data:image/png;base64,AA=="}
		}
		return media
	}

	tests := []struct {
		name    string
		request HappyHorseRequest
		wantErr bool
	}{
		{name: "t2v", request: HappyHorseRequest{Model: "happyhorse-1.1-t2v", Input: HappyHorseInput{Prompt: "run"}, Parameters: HappyHorseParameters{Ratio: stringPointer("21:9"), Duration: intPointer(5)}}},
		{name: "t2v has no upper duration bound", request: HappyHorseRequest{Model: "happyhorse-1.1-t2v", Input: HappyHorseInput{Prompt: "run"}, Parameters: HappyHorseParameters{Duration: intPointer(16)}}},
		{name: "t2v requires duration", request: HappyHorseRequest{Model: "happyhorse-1.1-t2v", Input: HappyHorseInput{Prompt: "run"}}, wantErr: true},
		{name: "t2v rejects zero duration", request: HappyHorseRequest{Model: "happyhorse-1.1-t2v", Input: HappyHorseInput{Prompt: "run"}, Parameters: HappyHorseParameters{Duration: intPointer(0)}}, wantErr: true},
		{name: "t2v rejects negative duration", request: HappyHorseRequest{Model: "happyhorse-1.1-t2v", Input: HappyHorseInput{Prompt: "run"}, Parameters: HappyHorseParameters{Duration: intPointer(-1)}}, wantErr: true},
		{name: "t2v requires prompt", request: HappyHorseRequest{Model: "happyhorse-1.1-t2v"}, wantErr: true},
		{name: "t2v rejects media", request: HappyHorseRequest{Model: "happyhorse-1.1-t2v", Input: HappyHorseInput{Prompt: "run", Media: images(1)}}, wantErr: true},
		{name: "t2v rejects audio setting", request: HappyHorseRequest{Model: "happyhorse-1.1-t2v", Input: HappyHorseInput{Prompt: "run"}, Parameters: HappyHorseParameters{AudioSetting: stringPointer("auto")}}, wantErr: true},
		{name: "i2v prompt optional", request: HappyHorseRequest{Model: "happyhorse-1.1-i2v", Input: HappyHorseInput{Media: []HappyHorseMedia{{Type: "first_frame", URL: "data:image/jpeg;base64,AA=="}}}}},
		{name: "i2v accepts minimum duration", request: HappyHorseRequest{Model: "happyhorse-1.1-i2v", Input: HappyHorseInput{Media: []HappyHorseMedia{{Type: "first_frame", URL: "data:image/jpeg;base64,AA=="}}}, Parameters: HappyHorseParameters{Duration: intPointer(3)}}},
		{name: "i2v accepts maximum duration", request: HappyHorseRequest{Model: "happyhorse-1.1-i2v", Input: HappyHorseInput{Media: []HappyHorseMedia{{Type: "first_frame", URL: "data:image/jpeg;base64,AA=="}}}, Parameters: HappyHorseParameters{Duration: intPointer(15)}}},
		{name: "i2v rejects duration below minimum", request: HappyHorseRequest{Model: "happyhorse-1.1-i2v", Input: HappyHorseInput{Media: []HappyHorseMedia{{Type: "first_frame", URL: "data:image/jpeg;base64,AA=="}}}, Parameters: HappyHorseParameters{Duration: intPointer(2)}}, wantErr: true},
		{name: "i2v rejects duration above maximum", request: HappyHorseRequest{Model: "happyhorse-1.1-i2v", Input: HappyHorseInput{Media: []HappyHorseMedia{{Type: "first_frame", URL: "data:image/jpeg;base64,AA=="}}}, Parameters: HappyHorseParameters{Duration: intPointer(16)}}, wantErr: true},
		{name: "i2v rejects invalid data image prefix", request: HappyHorseRequest{Model: "happyhorse-1.1-i2v", Input: HappyHorseInput{Media: []HappyHorseMedia{{Type: "first_frame", URL: "data:imageevil"}}}}, wantErr: true},
		{name: "i2v requires one first frame", request: HappyHorseRequest{Model: "happyhorse-1.1-i2v", Input: HappyHorseInput{Media: images(1)}}, wantErr: true},
		{name: "i2v rejects ratio", request: HappyHorseRequest{Model: "happyhorse-1.1-i2v", Input: HappyHorseInput{Media: []HappyHorseMedia{{Type: "first_frame", URL: "https://example.com/a.jpg"}}}, Parameters: HappyHorseParameters{Ratio: stringPointer("16:9")}}, wantErr: true},
		{name: "r2v one reference", request: HappyHorseRequest{Model: "happyhorse-1.1-r2v", Input: HappyHorseInput{Prompt: "run", Media: images(1)}}},
		{name: "r2v nine references", request: HappyHorseRequest{Model: "happyhorse-1.1-r2v", Input: HappyHorseInput{Prompt: "run", Media: images(9)}}},
		{name: "r2v accepts minimum duration", request: HappyHorseRequest{Model: "happyhorse-1.1-r2v", Input: HappyHorseInput{Prompt: "run", Media: images(1)}, Parameters: HappyHorseParameters{Duration: intPointer(3)}}},
		{name: "r2v accepts maximum duration", request: HappyHorseRequest{Model: "happyhorse-1.1-r2v", Input: HappyHorseInput{Prompt: "run", Media: images(1)}, Parameters: HappyHorseParameters{Duration: intPointer(15)}}},
		{name: "r2v rejects duration below minimum", request: HappyHorseRequest{Model: "happyhorse-1.1-r2v", Input: HappyHorseInput{Prompt: "run", Media: images(1)}, Parameters: HappyHorseParameters{Duration: intPointer(2)}}, wantErr: true},
		{name: "r2v rejects duration above maximum", request: HappyHorseRequest{Model: "happyhorse-1.1-r2v", Input: HappyHorseInput{Prompt: "run", Media: images(1)}, Parameters: HappyHorseParameters{Duration: intPointer(16)}}, wantErr: true},
		{name: "r2v rejects ten references", request: HappyHorseRequest{Model: "happyhorse-1.1-r2v", Input: HappyHorseInput{Prompt: "run", Media: images(10)}}, wantErr: true},
		{
			name: "video edit",
			request: HappyHorseRequest{
				Model: "happyhorse-1.0-video-edit",
				Input: HappyHorseInput{
					Prompt: "add a hat",
					Media:  append([]HappyHorseMedia{{Type: "video", URL: "https://example.com/a.mp4"}}, images(5)...),
				},
				Parameters: HappyHorseParameters{AudioSetting: stringPointer("origin")},
			},
		},
		{name: "video edit requires http video", request: HappyHorseRequest{Model: "happyhorse-1.0-video-edit", Input: HappyHorseInput{Prompt: "edit", Media: []HappyHorseMedia{{Type: "video", URL: "data:video/mp4;base64,AA=="}}}}, wantErr: true},
		{name: "video edit rejects six references", request: HappyHorseRequest{Model: "happyhorse-1.0-video-edit", Input: HappyHorseInput{Prompt: "edit", Media: append([]HappyHorseMedia{{Type: "video", URL: "http://example.com/a.mp4"}}, images(6)...)}}, wantErr: true},
		{name: "video edit rejects ratio", request: HappyHorseRequest{Model: "happyhorse-1.0-video-edit", Input: HappyHorseInput{Prompt: "edit", Media: []HappyHorseMedia{{Type: "video", URL: "https://example.com/a.mp4"}}}, Parameters: HappyHorseParameters{Ratio: stringPointer("16:9")}}, wantErr: true},
		{name: "video edit rejects audio setting", request: HappyHorseRequest{Model: "happyhorse-1.0-video-edit", Input: HappyHorseInput{Prompt: "edit", Media: []HappyHorseMedia{{Type: "video", URL: "https://example.com/a.mp4"}}}, Parameters: HappyHorseParameters{AudioSetting: stringPointer("off")}}, wantErr: true},
		{name: "video edit rejects duration", request: HappyHorseRequest{Model: "happyhorse-1.0-video-edit", Input: HappyHorseInput{Prompt: "edit", Media: []HappyHorseMedia{{Type: "video", URL: "https://example.com/a.mp4"}}}, Parameters: HappyHorseParameters{Duration: intPointer(5)}}, wantErr: true},
		{name: "rejects unknown model", request: HappyHorseRequest{Model: "happyhorse-1.1-unknown", Input: HappyHorseInput{Prompt: "run"}}, wantErr: true},
		{name: "rejects lowercase resolution", request: HappyHorseRequest{Model: "happyhorse-1.1-t2v", Input: HappyHorseInput{Prompt: "run"}, Parameters: HappyHorseParameters{Resolution: stringPointer("720p")}}, wantErr: true},
		{name: "accepts max seed", request: HappyHorseRequest{Model: "happyhorse-1.1-t2v", Input: HappyHorseInput{Prompt: "run"}, Parameters: HappyHorseParameters{Duration: intPointer(5), Seed: intPointer(2147483647)}}},
		{name: "rejects negative seed", request: HappyHorseRequest{Model: "happyhorse-1.1-t2v", Input: HappyHorseInput{Prompt: "run"}, Parameters: HappyHorseParameters{Seed: intPointer(-1)}}, wantErr: true},
		{name: "rejects seed above max", request: HappyHorseRequest{Model: "happyhorse-1.1-t2v", Input: HappyHorseInput{Prompt: "run"}, Parameters: HappyHorseParameters{Seed: intPointer(2147483648)}}, wantErr: true},
		{name: "rejects unsupported ratio", request: HappyHorseRequest{Model: "happyhorse-1.1-r2v", Input: HappyHorseInput{Prompt: "run", Media: images(1)}, Parameters: HappyHorseParameters{Ratio: stringPointer("2:1")}}, wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := test.request.Validate()
			if (err != nil) != test.wantErr {
				t.Fatalf("Validate() error = %v, wantErr %v", err, test.wantErr)
			}
		})
	}
}

func TestHappyHorseReservationSeconds(t *testing.T) {
	intPointer := func(value int) *int { return &value }
	tests := []struct {
		name    string
		request HappyHorseRequest
		want    int
		wantErr bool
	}{
		{name: "t2v explicit", request: HappyHorseRequest{Model: "happyhorse-1.1-t2v", Parameters: HappyHorseParameters{Duration: intPointer(16)}}, want: 16},
		{name: "t2v missing", request: HappyHorseRequest{Model: "happyhorse-1.1-t2v"}, wantErr: true},
		{name: "i2v default", request: HappyHorseRequest{Model: "happyhorse-1.1-i2v"}, want: 5},
		{name: "i2v explicit", request: HappyHorseRequest{Model: "happyhorse-1.1-i2v", Parameters: HappyHorseParameters{Duration: intPointer(3)}}, want: 3},
		{name: "r2v default", request: HappyHorseRequest{Model: "happyhorse-1.1-r2v"}, want: 5},
		{name: "r2v explicit", request: HappyHorseRequest{Model: "happyhorse-1.1-r2v", Parameters: HappyHorseParameters{Duration: intPointer(15)}}, want: 15},
		{name: "video edit fixed", request: HappyHorseRequest{Model: "happyhorse-1.0-video-edit"}, want: 30},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := test.request.ReservationSeconds()
			if (err != nil) != test.wantErr {
				t.Fatalf("ReservationSeconds() error = %v, wantErr %v", err, test.wantErr)
			}
			if got != test.want {
				t.Fatalf("ReservationSeconds() = %d, want %d", got, test.want)
			}
		})
	}
}

func TestModelListIncludesHappyHorseModels(t *testing.T) {
	want := map[string]bool{
		"happyhorse-1.1-t2v":        false,
		"happyhorse-1.1-i2v":        false,
		"happyhorse-1.1-r2v":        false,
		"happyhorse-1.0-video-edit": false,
	}
	for _, model := range ModelList {
		if _, ok := want[model]; ok {
			want[model] = true
		}
	}
	for model, found := range want {
		if !found {
			t.Errorf("ModelList does not include %q", model)
		}
	}
}
