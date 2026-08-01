package service

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

type bytePlusObservedRequest struct {
	Method      string
	Path        string
	Action      string
	Version     string
	Auth        string
	ContentType string
	Body        map[string]any
	Err         error
}

func TestBytePlusClientCreateVisualSendsOfficialContractAndScrubsMissingFields(t *testing.T) {
	observed := make(chan bytePlusObservedRequest, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got := observeBytePlusRequest(r)
		observed <- got
		if got.Err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ResponseMetadata":{"RequestId":"req-visual"},"Result":{"BytedToken":"token-1","H5Link":"https://h5.example/session","CallbackURL":"https://callback.example/ok"}}`))
	}))
	defer server.Close()

	client := NewBytePlusAssetClient(server.Client(), server.URL)
	got, err := client.CreateVisualValidateSession(context.Background(), testAssetCreds(), " https://callback.example/ok ")
	if err != nil {
		t.Fatalf("CreateVisualValidateSession error: %v", err)
	}
	req := <-observed
	if req.Err != nil {
		t.Fatalf("decode request: %v", req.Err)
	}
	if req.Method != http.MethodPost || req.Path != "/" {
		t.Fatalf("method/path = %q/%q", req.Method, req.Path)
	}
	if req.Action != "CreateVisualValidateSession" || req.Version != bytePlusAssetAPIVersion {
		t.Fatalf("Action/Version = %q/%q", req.Action, req.Version)
	}
	if !strings.HasPrefix(req.Auth, "HMAC-SHA256 Credential=sentinel-access-key-id/") {
		t.Fatalf("Authorization header = %q", req.Auth)
	}
	if !strings.HasPrefix(req.ContentType, "application/json") {
		t.Fatalf("Content-Type = %q", req.ContentType)
	}
	if req.Body["CallbackURL"] != "https://callback.example/ok" || req.Body["ProjectName"] != "test-project" {
		t.Fatalf("payload = %#v", req.Body)
	}
	assertMapKeys(t, req.Body, "CallbackURL", "ProjectName")
	if got.BytedToken != "token-1" || got.H5Link != "https://h5.example/session" || got.CallbackURL != "https://callback.example/ok" || got.RequestID != "req-visual" {
		t.Fatalf("result = %+v", got)
	}

	secretValues := []string{"token-1", "https://h5.example/session", "https://callback.example/ok", "sentinel-secret-key", "provider-secret-message"}
	for _, body := range []string{
		`{"ResponseMetadata":{"RequestId":"req-missing"},"Result":{"H5Link":"https://h5.example/session","CallbackURL":"https://callback.example/ok","Error":{"Message":"provider-secret-message"}}}`,
		`{"ResponseMetadata":{"RequestId":"req-missing"},"Result":{"BytedToken":"token-1","CallbackURL":"https://callback.example/ok"}}`,
	} {
		missingServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(body))
		}))
		client := NewBytePlusAssetClient(missingServer.Client(), missingServer.URL)
		_, err := client.CreateVisualValidateSession(context.Background(), testAssetCreds(), "https://callback.example/ok")
		missingServer.Close()
		if err == nil {
			t.Fatal("CreateVisualValidateSession should reject missing required result fields")
		}
		if isBytePlusDefinitiveResponse(err) {
			t.Fatalf("missing visual session fields should be ambiguous: %v", err)
		}
		for _, leaked := range secretValues {
			if strings.Contains(err.Error(), leaked) {
				t.Fatalf("error leaked %q: %v", leaked, err)
			}
		}
	}
}

func TestBytePlusClientCreateVisualRejectsBlankCallbackBeforeUpstream(t *testing.T) {
	var calls int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := NewBytePlusAssetClient(server.Client(), server.URL)
	_, err := client.CreateVisualValidateSession(context.Background(), testAssetCreds(), "  ")
	if err == nil {
		t.Fatal("CreateVisualValidateSession should reject blank callback url")
	}
	if strings.Contains(err.Error(), "  ") {
		t.Fatalf("error reflected blank callback input: %v", err)
	}
	if atomic.LoadInt32(&calls) != 0 {
		t.Fatalf("blank callback reached upstream; calls=%d", calls)
	}
}

func TestBytePlusClientGetVisualTrimsTokenAndMapsResult(t *testing.T) {
	observed := make(chan bytePlusObservedRequest, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got := observeBytePlusRequest(r)
		observed <- got
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ResponseMetadata":{"RequestId":"req-get"},"Result":{"GroupId":"group-1","Error":{"Message":"upstream-token-1-message"}}}`))
	}))
	defer server.Close()

	client := NewBytePlusAssetClient(server.Client(), server.URL)
	got, err := client.GetVisualValidateResult(context.Background(), testAssetCreds(), " token-1 ")
	if err != nil {
		t.Fatalf("GetVisualValidateResult error: %v", err)
	}
	req := <-observed
	if req.Action != "GetVisualValidateResult" || req.Body["BytedToken"] != "token-1" || req.Body["ProjectName"] != "test-project" {
		t.Fatalf("request = %+v", req)
	}
	assertMapKeys(t, req.Body, "BytedToken", "ProjectName")
	if got.GroupID != "group-1" || got.RequestID != "req-get" {
		t.Fatalf("result = %+v", got)
	}

	emptyGroupServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ResponseMetadata":{"RequestId":"req-empty"},"Result":{"GroupId":" ","Error":{"Message":"upstream-token-1-message"}}}`))
	}))
	defer emptyGroupServer.Close()
	client = NewBytePlusAssetClient(emptyGroupServer.Client(), emptyGroupServer.URL)
	_, err = client.GetVisualValidateResult(context.Background(), testAssetCreds(), " token-1 ")
	if err == nil {
		t.Fatal("GetVisualValidateResult should reject empty GroupId")
	}
	if isBytePlusDefinitiveResponse(err) {
		t.Fatalf("missing visual result GroupId should be ambiguous: %v", err)
	}
	for _, leaked := range []string{"token-1", "upstream-token-1-message"} {
		if strings.Contains(err.Error(), leaked) {
			t.Fatalf("error leaked %q: %v", leaked, err)
		}
	}
}

func TestBytePlusClientGetVisualRejectsBlankTokenBeforeUpstream(t *testing.T) {
	var calls int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := NewBytePlusAssetClient(server.Client(), server.URL)
	_, err := client.GetVisualValidateResult(context.Background(), testAssetCreds(), "  ")
	if err == nil {
		t.Fatal("GetVisualValidateResult should reject blank byted token")
	}
	if strings.Contains(err.Error(), "token-1") || strings.Contains(err.Error(), "  ") {
		t.Fatalf("error reflected byted token input: %v", err)
	}
	if atomic.LoadInt32(&calls) != 0 {
		t.Fatalf("blank token reached upstream; calls=%d", calls)
	}
}

func TestBytePlusClientListAssetsSendsFilterAndMapsPagination(t *testing.T) {
	observed := make(chan bytePlusObservedRequest, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		observed <- observeBytePlusRequest(r)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ResponseMetadata":{"RequestId":"req-list"},"Result":{"Items":[{"Id":"asset-1","Name":"Face One","GroupId":"group-1","AssetType":"Image","Status":"Active","Moderation":{"Strategy":"Skip"},"ProjectName":"test-project","CreateTime":11,"UpdateTime":22}],"TotalCount":7}}`))
	}))
	defer server.Close()

	client := NewBytePlusAssetClient(server.Client(), server.URL)
	got, err := client.ListAssets(context.Background(), testAssetCreds(), BytePlusListAssetsRequest{
		GroupIDs:   []string{"group-1", "group-2"},
		Statuses:   []string{"Active"},
		Name:       "face",
		PageNumber: 3,
		PageSize:   20,
		SortBy:     "CreateTime",
		SortOrder:  "Desc",
	})
	if err != nil {
		t.Fatalf("ListAssets error: %v", err)
	}
	req := <-observed
	if req.Action != "ListAssets" || req.Version != bytePlusAssetAPIVersion {
		t.Fatalf("Action/Version = %q/%q", req.Action, req.Version)
	}
	filter, ok := req.Body["Filter"].(map[string]any)
	if !ok {
		t.Fatalf("Filter missing from payload %#v", req.Body)
	}
	if filter["GroupType"] != "LivenessFace" || filter["Name"] != "face" {
		t.Fatalf("Filter = %#v", filter)
	}
	assertMapKeys(t, req.Body, "Filter", "PageNumber", "PageSize", "SortBy", "SortOrder", "ProjectName")
	assertMapKeys(t, filter, "GroupIds", "GroupType", "Statuses", "Name")
	assertStringSlice(t, filter["GroupIds"], []string{"group-1", "group-2"})
	assertStringSlice(t, filter["Statuses"], []string{"Active"})
	if req.Body["PageNumber"] != float64(3) || req.Body["PageSize"] != float64(20) || req.Body["SortBy"] != "CreateTime" || req.Body["SortOrder"] != "Desc" || req.Body["ProjectName"] != "test-project" {
		t.Fatalf("payload = %#v", req.Body)
	}
	if got.TotalCount != 7 || got.RequestID != "req-list" || len(got.Items) != 1 {
		t.Fatalf("result = %+v", got)
	}
	item := got.Items[0]
	if item.ID != "asset-1" || item.Name != "Face One" || item.GroupID != "group-1" || item.AssetType != "Image" || item.Status != "Active" || item.ProjectName != "test-project" || item.CreateTime != 11 || item.UpdateTime != 22 {
		t.Fatalf("item = %+v", item)
	}
	if item.Moderation["Strategy"] != "Skip" {
		t.Fatalf("moderation = %#v", item.Moderation)
	}
}

func TestBytePlusClientListAssetsRejectsMissingResultButAllowsEmptyObject(t *testing.T) {
	tests := []struct {
		name        string
		body        string
		wantErr     bool
		wantRequest string
	}{
		{name: "empty body", body: ``, wantErr: true},
		{name: "missing result", body: `{"ResponseMetadata":{"RequestId":"req-list-missing"}}`, wantErr: true, wantRequest: "req-list-missing"},
		{name: "null result", body: `{"ResponseMetadata":{"RequestId":"req-list-null"},"Result":null}`, wantErr: true, wantRequest: "req-list-null"},
		{name: "empty result object", body: `{"ResponseMetadata":{"RequestId":"req-list-empty"},"Result":{}}`, wantRequest: "req-list-empty"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(tc.body))
			}))
			defer server.Close()

			client := NewBytePlusAssetClient(server.Client(), server.URL)
			got, err := client.ListAssets(context.Background(), testAssetCreds(), BytePlusListAssetsRequest{})
			if tc.wantErr {
				if err == nil {
					t.Fatal("ListAssets should reject missing Result envelope")
				}
				if isBytePlusDefinitiveResponse(err) {
					t.Fatalf("missing Result should be ambiguous: %v", err)
				}
				for _, leaked := range []string{"Result", "missing result"} {
					if strings.Contains(err.Error(), leaked) {
						t.Fatalf("error leaked %q: %v", leaked, err)
					}
				}
				return
			}
			if err != nil {
				t.Fatalf("ListAssets empty Result object error: %v", err)
			}
			if got.RequestID != tc.wantRequest || got.TotalCount != 0 || len(got.Items) != 0 {
				t.Fatalf("ListAssets empty Result object = %+v", got)
			}
		})
	}
}

func TestBytePlusClientDeleteAssetHandlesEmptyResultAndNotFoundClassification(t *testing.T) {
	observed := make(chan bytePlusObservedRequest, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		observed <- observeBytePlusRequest(r)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ResponseMetadata":{"RequestId":"req-delete"},"Result":{}}`))
	}))
	defer server.Close()

	client := NewBytePlusAssetClient(server.Client(), server.URL)
	requestID, err := client.DeleteAsset(context.Background(), testAssetCreds(), " asset-1 ")
	if err != nil {
		t.Fatalf("DeleteAsset error: %v", err)
	}
	req := <-observed
	if req.Action != "DeleteAsset" || req.Body["Id"] != "asset-1" || req.Body["ProjectName"] != "test-project" {
		t.Fatalf("request = %+v", req)
	}
	assertMapKeys(t, req.Body, "Id", "ProjectName")
	if requestID != "req-delete" {
		t.Fatalf("requestID = %q", requestID)
	}

	notFoundServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"ResponseMetadata":{"RequestId":"req-404","Error":{"Code":"ResourceNotFound","Message":"provider says missing asset-1"}}}`))
	}))
	defer notFoundServer.Close()
	client = NewBytePlusAssetClient(notFoundServer.Client(), notFoundServer.URL)
	_, err = client.DeleteAsset(context.Background(), testAssetCreds(), "asset-1")
	if err == nil || !isBytePlusNotFound(err) {
		t.Fatalf("DeleteAsset HTTP 404 error/notFound = %v/%t", err, isBytePlusNotFound(err))
	}

	metadataNotFoundServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ResponseMetadata":{"RequestId":"req-200-notfound","Error":{"Code":"ResourceNotFound","Message":"provider says missing asset-1"}}}`))
	}))
	defer metadataNotFoundServer.Close()
	client = NewBytePlusAssetClient(metadataNotFoundServer.Client(), metadataNotFoundServer.URL)
	_, err = client.DeleteAsset(context.Background(), testAssetCreds(), "asset-1")
	if err == nil || !isBytePlusDefinitiveResponse(err) || isBytePlusNotFound(err) {
		t.Fatalf("DeleteAsset metadata not found classification err=%v definitive=%t notFound=%t", err, isBytePlusDefinitiveResponse(err), isBytePlusNotFound(err))
	}
	if strings.Contains(err.Error(), "provider says missing") {
		t.Fatalf("error leaked metadata message: %v", err)
	}
}

func TestBytePlusClientDeleteAssetRejectsMissingResultButAllowsEmptyObject(t *testing.T) {
	tests := []struct {
		name        string
		body        string
		wantErr     bool
		wantRequest string
	}{
		{name: "empty body", body: ``, wantErr: true},
		{name: "missing result", body: `{"ResponseMetadata":{"RequestId":"req-delete-missing"}}`, wantErr: true, wantRequest: "req-delete-missing"},
		{name: "null result", body: `{"ResponseMetadata":{"RequestId":"req-delete-null"},"Result":null}`, wantErr: true, wantRequest: "req-delete-null"},
		{name: "empty result object", body: `{"ResponseMetadata":{"RequestId":"req-delete-empty"},"Result":{}}`, wantRequest: "req-delete-empty"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(tc.body))
			}))
			defer server.Close()

			client := NewBytePlusAssetClient(server.Client(), server.URL)
			got, err := client.DeleteAsset(context.Background(), testAssetCreds(), "asset-1")
			if tc.wantErr {
				if err == nil {
					t.Fatal("DeleteAsset should reject missing Result envelope")
				}
				if isBytePlusDefinitiveResponse(err) {
					t.Fatalf("missing Result should be ambiguous: %v", err)
				}
				for _, leaked := range []string{"Result", "missing result", "asset-1"} {
					if strings.Contains(err.Error(), leaked) {
						t.Fatalf("error leaked %q: %v", leaked, err)
					}
				}
				return
			}
			if err != nil {
				t.Fatalf("DeleteAsset empty Result object error: %v", err)
			}
			if got != tc.wantRequest {
				t.Fatalf("DeleteAsset requestID = %q, want %q", got, tc.wantRequest)
			}
		})
	}
}

func TestBytePlusClientDeleteAssetRejectsBlankIDBeforeUpstream(t *testing.T) {
	var calls int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := NewBytePlusAssetClient(server.Client(), server.URL)
	_, err := client.DeleteAsset(context.Background(), testAssetCreds(), "  ")
	if err == nil {
		t.Fatal("DeleteAsset should reject blank upstream asset id")
	}
	if strings.Contains(err.Error(), "asset-1") || strings.Contains(err.Error(), "  ") {
		t.Fatalf("error reflected upstream asset id input: %v", err)
	}
	if atomic.LoadInt32(&calls) != 0 {
		t.Fatalf("blank upstream asset id reached upstream; calls=%d", calls)
	}
}

func TestBytePlusClientDeleteAssetNilContextIsLocalErrorBeforeUpstream(t *testing.T) {
	var calls int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := NewBytePlusAssetClient(server.Client(), server.URL)
	_, err := client.DeleteAsset(nil, testAssetCreds(), "asset-1")
	if err == nil {
		t.Fatal("DeleteAsset should reject nil context")
	}
	if isBytePlusDefinitiveResponse(err) {
		t.Fatalf("nil context should not be definitive: %v", err)
	}
	if atomic.LoadInt32(&calls) != 0 {
		t.Fatalf("nil context reached upstream; calls=%d", calls)
	}
}

func TestBytePlusClientDeleteAssetTimeoutIsNotDefinitive(t *testing.T) {
	release := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-release
	}))
	defer server.Close()

	client := NewBytePlusAssetClient(server.Client(), server.URL)
	client.requestTimeout = 25 * time.Millisecond
	_, err := client.DeleteAsset(context.Background(), testAssetCreds(), "asset-1")
	close(release)
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("DeleteAsset timeout error = %v", err)
	}
	if isBytePlusDefinitiveResponse(err) {
		t.Fatalf("timeout should not be definitive: %v", err)
	}
}

func TestBytePlusClientDeleteAssetScrubsUpstream502Body(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte(`{"ResponseMetadata":{"RequestId":"req-502","Error":{"Code":"Bad","Message":"sentinel-secret-key token-1 https://h5.example Code=Bad"}}}`))
	}))
	defer server.Close()

	client := NewBytePlusAssetClient(server.Client(), server.URL)
	_, err := client.DeleteAsset(context.Background(), testAssetCreds(), "asset-1")
	if err == nil {
		t.Fatal("DeleteAsset should reject upstream 502")
	}
	if !strings.Contains(err.Error(), "req-502") {
		t.Fatalf("error should keep request id: %v", err)
	}
	for _, leaked := range []string{"sentinel-secret-key", "token-1", "https://h5.example", "Code=Bad"} {
		if strings.Contains(err.Error(), leaked) {
			t.Fatalf("error leaked %q: %v", leaked, err)
		}
	}
}

func observeBytePlusRequest(r *http.Request) bytePlusObservedRequest {
	var body map[string]any
	err := decodeTestJSON(r, &body)
	return bytePlusObservedRequest{
		Method:      r.Method,
		Path:        r.URL.Path,
		Action:      r.URL.Query().Get("Action"),
		Version:     r.URL.Query().Get("Version"),
		Auth:        r.Header.Get("Authorization"),
		ContentType: r.Header.Get("Content-Type"),
		Body:        body,
		Err:         err,
	}
}

func assertMapKeys(t *testing.T, got map[string]any, want ...string) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("keys(%#v) len = %d, want %d", got, len(got), len(want))
	}
	for _, key := range want {
		if _, ok := got[key]; !ok {
			t.Fatalf("keys(%#v) missing %q", got, key)
		}
	}
}

func assertStringSlice(t *testing.T, got any, want []string) {
	t.Helper()
	values, ok := got.([]any)
	if !ok {
		t.Fatalf("value = %#v, want []any", got)
	}
	if len(values) != len(want) {
		t.Fatalf("len(%#v) = %d, want %d", values, len(values), len(want))
	}
	for i := range want {
		if values[i] != want[i] {
			t.Fatalf("value[%d] = %#v, want %q", i, values[i], want[i])
		}
	}
}
