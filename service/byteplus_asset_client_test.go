package service

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
)

func TestBytePlusAssetClientCreateAssetGroupSendsSignedRequest(t *testing.T) {
	var gotAction, gotVersion, gotAuth, gotHash string
	var gotMethod, gotPath string
	var gotBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotPath = r.URL.Path
		gotAction = r.URL.Query().Get("Action")
		gotVersion = r.URL.Query().Get("Version")
		gotAuth = r.Header.Get("Authorization")
		gotHash = r.Header.Get("X-Content-Sha256")
		if err := decodeTestJSON(r, &gotBody); err != nil {
			t.Fatalf("decode request body: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ResponseMetadata":{"RequestId":"req-1"},"Result":{"Id":"group-1"}}`))
	}))
	defer server.Close()

	client := NewBytePlusAssetClient(server.Client(), server.URL)
	groupID, requestID, err := client.CreateAssetGroup(context.Background(), testAssetCreds(), "flatkey-group")
	if err != nil {
		t.Fatalf("CreateAssetGroup error: %v", err)
	}

	if groupID != "group-1" || requestID != "req-1" {
		t.Fatalf("groupID/requestID = %q/%q", groupID, requestID)
	}
	if gotMethod != http.MethodPost || gotPath != "/" {
		t.Fatalf("method/path = %q/%q", gotMethod, gotPath)
	}
	if gotAction != "CreateAssetGroup" || gotVersion != "2024-01-01" {
		t.Fatalf("query Action/Version = %q/%q", gotAction, gotVersion)
	}
	if !strings.HasPrefix(gotAuth, "HMAC-SHA256 Credential=ak-example/") {
		t.Fatalf("Authorization header = %q", gotAuth)
	}
	if gotHash == "" {
		t.Fatal("X-Content-Sha256 header is empty")
	}
	if gotBody["Name"] != "flatkey-group" || gotBody["GroupType"] != "AIGC" || gotBody["ProjectName"] != "project3" {
		t.Fatalf("payload = %#v", gotBody)
	}
}

func TestBytePlusAssetClientCreateAssetModerationMapping(t *testing.T) {
	var strategies []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := decodeTestJSON(r, &body); err != nil {
			t.Fatalf("decode request body: %v", err)
		}
		moderation, _ := body["Moderation"].(map[string]any)
		strategy, _ := moderation["Strategy"].(string)
		strategies = append(strategies, strategy)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ResponseMetadata":{"RequestId":"req-asset"},"Result":{"Id":"asset-1"}}`))
	}))
	defer server.Close()

	client := NewBytePlusAssetClient(server.Client(), server.URL)
	if _, _, err := client.CreateAsset(context.Background(), testAssetCreds(), BytePlusCreateAssetRequest{
		GroupID:   "group-1",
		URL:       "https://example.com/a.png",
		AssetType: "Image",
		Name:      "asset-a",
	}); err != nil {
		t.Fatalf("CreateAsset default moderation error: %v", err)
	}
	if _, _, err := client.CreateAsset(context.Background(), testAssetCreds(), BytePlusCreateAssetRequest{
		GroupID:            "group-1",
		URL:                "https://example.com/a.mp4",
		AssetType:          "Video",
		Name:               "asset-b",
		ModerationStrategy: "Skip",
	}); err != nil {
		t.Fatalf("CreateAsset skip moderation error: %v", err)
	}

	if len(strategies) != 2 || strategies[0] != "Default" || strategies[1] != "Skip" {
		t.Fatalf("moderation strategies = %#v", strategies)
	}
}

func TestBytePlusAssetClientRejectsInvalidCreateValuesBeforeUpstream(t *testing.T) {
	var calls int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ResponseMetadata":{"RequestId":"unexpected"},"Result":{"Id":"asset-1"}}`))
	}))
	defer server.Close()

	client := NewBytePlusAssetClient(server.Client(), server.URL)
	tests := []BytePlusCreateAssetRequest{
		{GroupID: "group-1", URL: "https://example.com/a.txt", AssetType: "Document"},
		{GroupID: "group-1", URL: "https://example.com/a.png", AssetType: "Image", ModerationStrategy: "Disabled"},
		{GroupID: "", URL: "https://example.com/a.png", AssetType: "Image"},
		{GroupID: "group-1", URL: "file:///tmp/a.png", AssetType: "Image"},
		{GroupID: "group-1", URL: "https://example.com:81/a.png", AssetType: "Image"},
		{GroupID: "group-1", URL: "https://user:pass@example.com/a.png", AssetType: "Image"},
		{GroupID: "group-1", URL: "http://127.0.0.1/a.png", AssetType: "Image"},
	}
	for _, request := range tests {
		_, _, err := client.CreateAsset(context.Background(), testAssetCreds(), request)
		if err == nil {
			t.Fatalf("CreateAsset(%+v) should reject invalid values", request)
		}
		if request.URL != "" && strings.Contains(err.Error(), request.URL) {
			t.Fatalf("validation error leaked source URL %q: %v", request.URL, err)
		}
	}
	if calls != 0 {
		t.Fatalf("invalid requests reached upstream %d times", calls)
	}
	if _, err := client.GetAsset(context.Background(), testAssetCreds(), "  "); err == nil {
		t.Fatal("GetAsset should reject a blank upstream asset id")
	}
	if calls != 0 {
		t.Fatalf("blank asset id reached upstream; calls=%d", calls)
	}
}

func TestBytePlusAssetClientBoundsRequestDuration(t *testing.T) {
	release := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-release
	}))
	defer server.Close()

	client := NewBytePlusAssetClient(server.Client(), server.URL)
	client.requestTimeout = 25 * time.Millisecond
	_, _, err := client.CreateAssetGroup(context.Background(), testAssetCreds(), "flatkey-group")
	close(release)
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("CreateAssetGroup timeout error = %v", err)
	}
}

func TestBytePlusAssetClientGetAssetMapsStatuses(t *testing.T) {
	statuses := []string{"Processing", "Active", "Failed"}
	var calls int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ResponseMetadata":{"RequestId":"req-status"},"Result":{"Id":"asset-1","Status":"` + statuses[calls] + `","Error":{"Code":"Bad","Message":"provider failure"}}}`))
		calls++
	}))
	defer server.Close()

	client := NewBytePlusAssetClient(server.Client(), server.URL)
	for _, want := range statuses {
		got, err := client.GetAsset(context.Background(), testAssetCreds(), "asset-1")
		if err != nil {
			t.Fatalf("GetAsset(%s) error: %v", want, err)
		}
		if got.Status != want || got.UpstreamAssetID != "asset-1" || got.RequestID != "req-status" {
			t.Fatalf("GetAsset result = %+v", got)
		}
	}
}

func TestBytePlusAssetClientRejectsUnknownStatusAndScrubsErrors(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ResponseMetadata":{"RequestId":"req-unknown"},"Result":{"Id":"asset-1","Status":"Mystery","Error":{"Message":"sk-should-not-leak"}}}`))
	}))
	defer server.Close()

	client := NewBytePlusAssetClient(server.Client(), server.URL)
	_, err := client.GetAsset(context.Background(), testAssetCreds(), "asset-1")
	if err == nil {
		t.Fatal("GetAsset should reject unknown upstream status")
	}
	if strings.Contains(err.Error(), "sk-should-not-leak") || strings.Contains(err.Error(), "asset-1") {
		t.Fatalf("error leaked upstream details: %v", err)
	}
}

func TestBytePlusAssetClientRejectsMissingOrMismatchedGetAssetID(t *testing.T) {
	responses := []string{
		`{"ResponseMetadata":{"RequestId":"req-empty"},"Result":{"Id":"  ","Status":"Active","Error":{"Message":"sk-empty-should-not-leak"}}}`,
		`{"ResponseMetadata":{"RequestId":"req-mismatch"},"Result":{"Id":"asset-other","Status":"Active","Error":{"Message":"sk-mismatch-should-not-leak"}}}`,
	}
	var calls int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(responses[calls]))
		calls++
	}))
	defer server.Close()

	client := NewBytePlusAssetClient(server.Client(), server.URL)
	for i := range responses {
		_, err := client.GetAsset(context.Background(), testAssetCreds(), " asset-1 ")
		if err == nil {
			t.Fatal("GetAsset should reject missing or mismatched result id")
		}
		for _, leaked := range []string{"sk-empty-should-not-leak", "sk-mismatch-should-not-leak", "asset-other", "asset-1"} {
			if strings.Contains(err.Error(), leaked) {
				t.Fatalf("case %d error leaked upstream details %q: %v", i, leaked, err)
			}
		}
	}
	if calls != len(responses) {
		t.Fatalf("calls = %d, want %d", calls, len(responses))
	}
}

func TestBytePlusAssetClientRejectsUpstreamErrorWithoutSecretReflection(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte(`{"ResponseMetadata":{"RequestId":"req-bad","Error":{"Code":"Bad","Message":"sk-should-not-leak"}}}`))
	}))
	defer server.Close()

	client := NewBytePlusAssetClient(server.Client(), server.URL)
	_, _, err := client.CreateAssetGroup(context.Background(), testAssetCreds(), "flatkey-group")
	if err == nil {
		t.Fatal("CreateAssetGroup should reject upstream error")
	}
	if strings.Contains(err.Error(), "sk-should-not-leak") {
		t.Fatalf("error leaked secret: %v", err)
	}
	if !strings.Contains(err.Error(), "req-bad") {
		t.Fatalf("error should retain request id, got %v", err)
	}
}

func TestBytePlusAssetClientRejectsResponseMetadataErrorWithoutBodyReflection(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ResponseMetadata":{"RequestId":"req-meta","Error":{"Code":"Bad","Message":"raw-provider-body-should-not-leak"}}}`))
	}))
	defer server.Close()

	client := NewBytePlusAssetClient(server.Client(), server.URL)
	_, _, err := client.CreateAsset(context.Background(), testAssetCreds(), BytePlusCreateAssetRequest{
		GroupID:   "group-1",
		URL:       "https://example.com/a.mp4",
		AssetType: "Video",
	})
	if err == nil {
		t.Fatal("CreateAsset should reject ResponseMetadata.Error")
	}
	if strings.Contains(err.Error(), "raw-provider-body-should-not-leak") {
		t.Fatalf("error leaked upstream body: %v", err)
	}
	if !strings.Contains(err.Error(), "req-meta") {
		t.Fatalf("error should retain request id, got %v", err)
	}
}

func testAssetCreds() BytePlusCredentials {
	return BytePlusCredentials{
		APIKey:          "ark-video-key",
		AccessKeyID:     "ak-example",
		SecretAccessKey: "sk-example",
		ProjectName:     "project3",
	}
}

func decodeTestJSON(r *http.Request, v any) error {
	return common.DecodeJson(r.Body, v)
}
