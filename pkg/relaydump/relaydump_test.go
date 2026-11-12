package relaydump

import (
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// withRelayDumpSetting mutates the package-level setting and restores it after
// the test, so dump behavior tests stay isolated from real configuration.
func withRelayDumpSetting(t *testing.T, mutate func(*operation_setting.RelayDumpSetting)) {
	t.Helper()
	prev := *operation_setting.GetRelayDumpSetting()
	t.Cleanup(func() { *operation_setting.GetRelayDumpSetting() = prev })
	mutate(operation_setting.GetRelayDumpSetting())
}

func newTestRequest(t *testing.T, method string, url string, body string) *http.Request {
	t.Helper()
	req, err := http.NewRequest(method, url, strings.NewReader(body))
	require.NoError(t, err)
	req.Header.Set("Authorization", "Bearer sk-secret")
	req.Header.Set("X-Trace-Id", "trace-1")
	return req
}

func TestRedactHeaderAppliesBuiltInAndCustomList(t *testing.T) {
	setting := &operation_setting.RelayDumpSetting{
		RedactHeaders: true,
		RedactList:    []string{"x-trace-id"},
	}
	redacted := buildRedactedHeaders(setting)
	header := http.Header{}
	header.Set("Authorization", "Bearer sk-secret")
	header.Set("Cookie", "a=b")
	header.Set("X-Trace-Id", "trace-1")
	header.Set("OpenAI-Organization", "org-1")

	result := redactHeader(header, redacted)
	assert.Equal(t, []string{redactedValue}, result["Authorization"])
	assert.Equal(t, []string{redactedValue}, result["Cookie"])
	assert.Equal(t, []string{redactedValue}, result["X-Trace-Id"])
	assert.Equal(t, []string{"org-1"}, result["Openai-Organization"])
}

func TestRedactHeaderDisabledBuiltInStillAppliesCustom(t *testing.T) {
	setting := &operation_setting.RelayDumpSetting{
		RedactHeaders: false,
		RedactList:    []string{"x-custom-secret"},
	}
	redacted := buildRedactedHeaders(setting)
	header := http.Header{}
	header.Set("Authorization", "Bearer sk-secret")
	header.Set("X-Custom-Secret", "s")

	result := redactHeader(header, redacted)
	assert.Equal(t, []string{"Bearer sk-secret"}, result["Authorization"])
	assert.Equal(t, []string{redactedValue}, result["X-Custom-Secret"])
}

func TestBeginCaptureDisabledReturnsNil(t *testing.T) {
	withRelayDumpSetting(t, func(s *operation_setting.RelayDumpSetting) {
		s.Enabled = false
	})
	req := newTestRequest(t, http.MethodPost, "https://upstream.test/v1/chat", "hello")
	assert.Nil(t, BeginCapture(req, Meta{RequestID: "req-1"}))
}

func TestCaptureRequestSideSnapshotsBodyWithoutConsumingIt(t *testing.T) {
	withRelayDumpSetting(t, func(s *operation_setting.RelayDumpSetting) {
		s.Enabled = true
		s.RedactHeaders = true
		s.MaxBodyKB = 64
	})
	req := newTestRequest(t, http.MethodPost, "https://upstream.test/v1/chat", "hello")
	capture := BeginCapture(req, Meta{RequestID: "req-1"})
	require.NotNil(t, capture)
	require.NotNil(t, capture.request)

	assert.Equal(t, http.MethodPost, capture.request.Method)
	assert.Equal(t, "https://upstream.test/v1/chat", capture.request.URL)
	assert.Equal(t, []string{redactedValue}, capture.request.Headers["Authorization"])
	assert.Equal(t, []string{"trace-1"}, capture.request.Headers["X-Trace-Id"])
	assert.Equal(t, "hello", capture.request.Body)
	assert.False(t, capture.request.BodyTruncated)

	// The live body must be untouched so the transport can send it.
	remaining, err := io.ReadAll(req.Body)
	require.NoError(t, err)
	assert.Equal(t, "hello", string(remaining))
}

func TestCaptureRequestSideTruncatesBody(t *testing.T) {
	withRelayDumpSetting(t, func(s *operation_setting.RelayDumpSetting) {
		s.Enabled = true
		s.MaxBodyKB = 1
	})
	body := strings.Repeat("a", 2048)
	req := newTestRequest(t, http.MethodPost, "https://upstream.test/v1/chat", body)
	capture := BeginCapture(req, Meta{RequestID: "req-1"})
	require.NotNil(t, capture)
	assert.Len(t, capture.request.Body, 1024)
	assert.True(t, capture.request.BodyTruncated)
}

func TestCaptureRequestSideReportsNonReplayableBody(t *testing.T) {
	withRelayDumpSetting(t, func(s *operation_setting.RelayDumpSetting) {
		s.Enabled = true
	})
	req, err := http.NewRequest(http.MethodPost, "https://upstream.test/v1/audio", io.NopCloser(strings.NewReader("stream")))
	require.NoError(t, err)
	capture := BeginCapture(req, Meta{RequestID: "req-1"})
	require.NotNil(t, capture)
	assert.True(t, capture.request.BodyMissing)
	assert.Empty(t, capture.request.Body)
}

func TestCaptureShouldKeepModes(t *testing.T) {
	withRelayDumpSetting(t, func(s *operation_setting.RelayDumpSetting) {
		s.Enabled = true
		s.Mode = operation_setting.RelayDumpModeError
	})
	req := newTestRequest(t, http.MethodPost, "https://upstream.test/v1/chat", "x")
	capture := BeginCapture(req, Meta{RequestID: "req-1"})
	require.NotNil(t, capture)
	assert.False(t, capture.ShouldKeep(http.StatusOK))
	assert.False(t, capture.enabled, "non-keeping captures must be discarded")
	assert.Nil(t, capture.request)

	capture2 := BeginCapture(req, Meta{RequestID: "req-2"})
	require.NotNil(t, capture2)
	assert.True(t, capture2.ShouldKeep(http.StatusBadRequest))
	assert.True(t, capture2.enabled)

	withRelayDumpSetting(t, func(s *operation_setting.RelayDumpSetting) {
		s.Enabled = true
		s.Mode = operation_setting.RelayDumpModeAll
	})
	capture3 := BeginCapture(req, Meta{RequestID: "req-3"})
	require.NotNil(t, capture3)
	assert.True(t, capture3.ShouldKeep(http.StatusOK))
}

func TestCaptureWrapBodyCapturesAndTruncates(t *testing.T) {
	withRelayDumpSetting(t, func(s *operation_setting.RelayDumpSetting) {
		s.Enabled = true
		s.MaxBodyKB = 1
	})
	req := newTestRequest(t, http.MethodPost, "https://upstream.test/v1/chat", "x")
	capture := BeginCapture(req, Meta{RequestID: "req-1"})
	require.NotNil(t, capture)
	require.True(t, capture.ShouldKeep(http.StatusInternalServerError))
	capture.ObserveResponse(http.StatusInternalServerError, http.Header{"Content-Type": {"application/json"}})

	payload := strings.Repeat("b", 2048)
	body := capture.WrapBody(io.NopCloser(strings.NewReader(payload)))
	_, err := io.ReadAll(body)
	require.NoError(t, err)

	assert.Equal(t, http.StatusInternalServerError, capture.response.StatusCode)
	assert.Equal(t, []string{"application/json"}, capture.response.Headers["Content-Type"])
	assert.Len(t, capture.response.Body, 1024)
	assert.True(t, capture.response.BodyTruncated)
}

func TestCaptureTeeCloseFinishesOnce(t *testing.T) {
	withRelayDumpSetting(t, func(s *operation_setting.RelayDumpSetting) {
		s.Enabled = true
		s.Output = operation_setting.RelayDumpOutputLog
		s.Mode = operation_setting.RelayDumpModeAll
	})
	req := newTestRequest(t, http.MethodPost, "https://upstream.test/v1/chat", "x")
	capture := BeginCapture(req, Meta{RequestID: "req-1"})
	require.NotNil(t, capture)
	body := capture.WrapBody(io.NopCloser(strings.NewReader("partial")))
	require.NoError(t, body.Close())
	assert.True(t, capture.finished, "closing the tee must finish the capture")
	// Finishing twice (close after close) must be harmless.
	require.NoError(t, body.Close())
	assert.NotNil(t, capture.request, "finish only writes outputs; captured state stays until GC")
}

func TestCapturePipelineWritesReadableFile(t *testing.T) {
	withRelayDumpSetting(t, func(s *operation_setting.RelayDumpSetting) {
		s.Enabled = true
		s.Mode = operation_setting.RelayDumpModeError
		s.Output = operation_setting.RelayDumpOutputFile
		s.Directory = t.TempDir()
		s.MaxBodyKB = 64
		s.MaxFiles = 10
	})
	req := newTestRequest(t, http.MethodPost, "https://upstream.test/v1/chat", "ping")
	capture := BeginCapture(req, Meta{RequestID: "req-pipeline", ChannelID: 7, ChannelName: "ch", Model: "gpt-x"})
	require.NotNil(t, capture)
	require.True(t, capture.ShouldKeep(http.StatusInternalServerError))
	capture.ObserveResponse(http.StatusInternalServerError, nil)
	body := capture.WrapBody(io.NopCloser(strings.NewReader("pong")))
	_, err := io.ReadAll(body)
	require.NoError(t, err)
	// The EOF read finishes the capture and queues the file write; the Close
	// below must not change the outcome.
	require.NoError(t, body.Close())

	id := EntryIDFromMeta(Meta{RequestID: "req-pipeline", CreatedAt: capture.meta.CreatedAt})
	assert.Eventually(t, func() bool {
		_, readErr := os.Stat(filepath.Join(operation_setting.GetRelayDumpSetting().ResolvedDirectory(), id+".json"))
		return readErr == nil
	}, 2*time.Second, 10*time.Millisecond)

	dump, err := Read(id)
	require.NoError(t, err)
	assert.Equal(t, "req-pipeline", dump.RequestID)
	assert.Equal(t, 7, dump.ChannelID)
	assert.Equal(t, "gpt-x", dump.Model)
	assert.Equal(t, "ping", dump.Request.Body)
	assert.Equal(t, http.StatusInternalServerError, dump.Response.StatusCode)
	assert.Equal(t, "pong", dump.Response.Body)
}

func TestListOrdersNewestFirstAndEnforcesRetention(t *testing.T) {
	dir := t.TempDir()
	withRelayDumpSetting(t, func(s *operation_setting.RelayDumpSetting) {
		s.Directory = dir
		s.MaxFiles = 3
	})
	base := time.Now().UnixMilli()
	for i := range 5 {
		dump := &DumpFile{
			Meta: Meta{
				RequestID: "req-aaaa" + string(rune('0'+i)),
				CreatedAt: base + int64(i),
			},
			Request: &DumpSide{
				Method:  http.MethodPost,
				URL:     "https://upstream.test/v1/chat",
				Headers: map[string][]string{"Content-Type": {"application/json"}},
				Body:    "body",
			},
			Response: &DumpSide{StatusCode: http.StatusInternalServerError},
		}
		writeDumpFile(dump)
	}

	names, err := listEntryNames(dir)
	require.NoError(t, err)
	require.Len(t, names, 3, "retention must keep only MaxFiles entries")

	entries, total, err := List(0, 10)
	require.NoError(t, err)
	assert.Equal(t, 3, total)
	require.Len(t, entries, 3)
	// Newest first: the last written capture is the first entry.
	assert.Equal(t, base+4, entries[0].CreatedAt)
	assert.Equal(t, base+2, entries[2].CreatedAt)
	assert.Equal(t, http.StatusInternalServerError, entries[0].StatusCode)
	assert.Equal(t, "req-aaaa4", entries[0].RequestID)
	assert.EqualValues(t, 0, entries[0].DurationMS)
	assert.NotZero(t, entries[0].Size)
}

func TestStoreRejectsInvalidIDs(t *testing.T) {
	for _, id := range []string{"", "../escape", "a/b", "a b", "x..y"} {
		_, err := Read(id)
		assert.Error(t, err, "Read must reject invalid id %q", id)
		assert.Error(t, Delete(id), "Delete must reject invalid id %q", id)
	}
}

func TestDeleteAndClear(t *testing.T) {
	dir := t.TempDir()
	withRelayDumpSetting(t, func(s *operation_setting.RelayDumpSetting) {
		s.Directory = dir
		s.MaxFiles = 10
	})
	dump := &DumpFile{Meta: Meta{RequestID: "req-del", CreatedAt: 1}, Request: &DumpSide{}}
	writeDumpFile(dump)
	id := EntryIDFromMeta(dump.Meta)
	_, err := Read(id)
	require.NoError(t, err)
	require.NoError(t, Delete(id))
	_, err = Read(id)
	assert.Error(t, err)

	writeDumpFile(dump)
	removed, err := Clear()
	require.NoError(t, err)
	assert.Equal(t, 1, removed)
	_, err = Read(id)
	assert.Error(t, err)
}

func TestCaptureWebSocketHandshakeOnlyKeepsFailuresInErrorMode(t *testing.T) {
	dir := t.TempDir()
	withRelayDumpSetting(t, func(s *operation_setting.RelayDumpSetting) {
		s.Enabled = true
		s.Mode = operation_setting.RelayDumpModeError
		s.Output = operation_setting.RelayDumpOutputFile
		s.Directory = dir
		s.MaxFiles = 10
	})
	wsHeader := http.Header{"Authorization": {"Bearer x"}}
	meta := Meta{RequestID: "req-ws", CreatedAt: 5}
	CaptureWebSocketHandshake(meta, "wss://upstream.test/realtime", wsHeader, http.StatusSwitchingProtocols, "")
	assert.NoFileExists(t, filepath.Join(dir, EntryIDFromMeta(meta)+".json"))

	CaptureWebSocketHandshake(meta, "wss://upstream.test/realtime", wsHeader, http.StatusForbidden, "dial failed")
	var dump *DumpFile
	var readErr error
	assert.Eventually(t, func() bool {
		dump, readErr = Read(EntryIDFromMeta(meta))
		return readErr == nil
	}, 2*time.Second, 10*time.Millisecond)
	require.NoError(t, readErr)
	assert.Equal(t, http.StatusForbidden, dump.Response.StatusCode)
	assert.Equal(t, "dial failed", dump.Error)
	assert.Equal(t, []string{redactedValue}, dump.Request.Headers["Authorization"])

	withRelayDumpSetting(t, func(s *operation_setting.RelayDumpSetting) {
		s.Mode = operation_setting.RelayDumpModeAll
	})
	meta2 := Meta{RequestID: "req-ws-ok", CreatedAt: 6}
	CaptureWebSocketHandshake(meta2, "wss://upstream.test/realtime", wsHeader, http.StatusSwitchingProtocols, "")
	assert.Eventually(t, func() bool {
		_, readErr = Read(EntryIDFromMeta(meta2))
		return readErr == nil
	}, 2*time.Second, 10*time.Millisecond)
	require.NoError(t, readErr)
}

func TestValidateRelayDumpOption(t *testing.T) {
	cases := []struct {
		key     string
		value   string
		wantErr bool
	}{
		{"relay_dump_setting.mode", "error", false},
		{"relay_dump_setting.mode", "all", false},
		{"relay_dump_setting.mode", "verbose", true},
		{"relay_dump_setting.output", "file", false},
		{"relay_dump_setting.output", "both", false},
		{"relay_dump_setting.output", "stdout", true},
		{"relay_dump_setting.max_body_kb", "64", false},
		{"relay_dump_setting.max_body_kb", "0", true},
		{"relay_dump_setting.max_body_kb", "8193", true},
		{"relay_dump_setting.max_files", "500", false},
		{"relay_dump_setting.max_files", "100001", true},
		{"relay_dump_setting.directory", "relay-dump/sub", false},
		{"relay_dump_setting.directory", "/var/log/newapi-dump", false},
		{"relay_dump_setting.directory", "", true},
		{"relay_dump_setting.directory", "..", true},
		{"relay_dump_setting.directory", "../escape", true},
		// Keys outside this section must be ignored: this validator runs on
		// every option update.
		{"relay_dump_setting.unknown", "x", false},
		{"log_setting.max_range_days", "1", false},
	}
	for _, tc := range cases {
		err := operation_setting.ValidateRelayDumpOption(tc.key, tc.value)
		if tc.wantErr {
			assert.Error(t, err, "%s=%s", tc.key, tc.value)
		} else {
			assert.NoError(t, err, "%s=%s", tc.key, tc.value)
		}
	}
}

func TestResolvedDirectoryDefaultsAndCleans(t *testing.T) {
	withRelayDumpSetting(t, func(s *operation_setting.RelayDumpSetting) {
		s.Directory = ""
	})
	assert.Equal(t, "relay-dump", operation_setting.GetRelayDumpSetting().ResolvedDirectory())
	withRelayDumpSetting(t, func(s *operation_setting.RelayDumpSetting) {
		s.Directory = "a//b/./c/"
	})
	assert.Equal(t, filepath.Join("a", "b", "c"), operation_setting.GetRelayDumpSetting().ResolvedDirectory())
}

func TestDumpFileJSONRoundTrip(t *testing.T) {
	dump := &DumpFile{
		Meta:     Meta{RequestID: "req-json", CreatedAt: 123, ChannelID: 2, IsStream: true},
		Request:  &DumpSide{Method: http.MethodPost, URL: "https://u.test", Headers: map[string][]string{"A": {"b"}}, Body: "x"},
		Response: &DumpSide{StatusCode: 200, Body: "y", BodyTruncated: true},
		Error:    "boom",
	}
	data, err := common.Marshal(dump)
	require.NoError(t, err)
	decoded := &DumpFile{}
	require.NoError(t, common.Unmarshal(data, decoded))
	assert.Equal(t, dump.RequestID, decoded.RequestID)
	assert.Equal(t, dump.Request.Body, decoded.Request.Body)
	assert.Equal(t, dump.Response.StatusCode, decoded.Response.StatusCode)
	assert.True(t, decoded.Response.BodyTruncated)
	assert.Equal(t, dump.Error, decoded.Error)
}
