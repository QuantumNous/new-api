package archive

import (
	"bytes"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTargetModelExactMatch(t *testing.T) {
	t.Parallel()

	for _, model := range []string{"claude-opus-4-8", "claude-opus-5", "claude-fable-5", "claude-fable-5-1"} {
		assert.True(t, IsTargetModel(model), model)
	}
	for _, model := range []string{"claude-opus-4-8-high", "claude-fable-5-thinking", "claude-sonnet-5", ""} {
		assert.False(t, IsTargetModel(model), model)
	}
}

func TestArchiveRecordRoundTripAndRedaction(t *testing.T) {
	t.Parallel()

	directory := t.TempDir()
	manager := NewManager(Config{Enabled: true, Directory: directory, MaxFileSize: 1 << 20})
	session, err := manager.Begin(Metadata{RequestID: "req-1", ChannelID: 7, Model: "claude-opus-5"})
	require.NoError(t, err)

	requestHeaders := http.Header{
		"Authorization": {"Bearer secret", "Bearer second-secret"},
		"X-Api-Key":     {"api-secret"},
		"Content-Type":  {"application/json"},
	}
	requestBody := session.WrapRequestBody(io.NopCloser(bytes.NewBufferString(`{"model":"claude-opus-5"}`)))
	_, err = io.Copy(io.Discard, requestBody)
	require.NoError(t, err)
	require.NoError(t, requestBody.Close())

	responseHeaders := http.Header{"Set-Cookie": {"session=secret"}, "Content-Type": {"application/json"}, "X-Trace": {"trace-1", "trace-2"}}
	responseBody := session.WrapResponseBody(io.NopCloser(bytes.NewBufferString(`{"ok":true}`)), 200, requestHeaders, responseHeaders)
	_, err = io.Copy(io.Discard, responseBody)
	require.NoError(t, err)
	require.NoError(t, responseBody.Close())

	records, err := ReadFile(filepath.Join(directory, "channel-7-1.log"))
	require.NoError(t, err)
	require.Len(t, records, 1)
	assert.Equal(t, "[REDACTED]", records[0].RequestHeaders.Get("Authorization"))
	assert.Equal(t, []string{"[REDACTED]", "[REDACTED]"}, records[0].RequestHeaders.Values("Authorization"))
	assert.Equal(t, "[REDACTED]", records[0].RequestHeaders.Get("X-Api-Key"))
	assert.Equal(t, "[REDACTED]", records[0].ResponseHeaders.Get("Set-Cookie"))
	assert.Equal(t, []string{"trace-1", "trace-2"}, records[0].ResponseHeaders.Values("X-Trace"))
	assert.JSONEq(t, `{"model":"claude-opus-5"}`, string(records[0].RequestBody))
	assert.JSONEq(t, `{"ok":true}`, string(records[0].ResponseBody))
	assert.True(t, records[0].Complete)
}

func TestClosedBeforeEOFIsMarkedPartial(t *testing.T) {
	t.Parallel()
	directory := t.TempDir()
	manager := NewManager(Config{Enabled: true, Directory: directory})
	session, err := manager.Begin(Metadata{RequestID: "partial", ChannelID: 8, Model: "claude-opus-5"})
	require.NoError(t, err)
	body := session.WrapResponseBody(io.NopCloser(bytes.NewBufferString("partial response")), 200, nil, nil)
	buffer := make([]byte, 7)
	_, err = body.Read(buffer)
	require.NoError(t, err)
	require.NoError(t, body.Close())
	require.NoError(t, body.Close())
	records, err := ReadFile(filepath.Join(directory, "channel-8-1.log"))
	require.NoError(t, err)
	require.Len(t, records, 1)
	assert.False(t, records[0].Complete)
	assert.Equal(t, "partial", string(records[0].ResponseBody))
}

func TestArchiveRotationRestartAndOversizedRecord(t *testing.T) {
	t.Parallel()

	directory := t.TempDir()
	writeRecord := func(manager *Manager, requestID string, channelID int, body string) {
		session, err := manager.Begin(Metadata{RequestID: requestID, ChannelID: channelID, Model: "claude-opus-5"})
		require.NoError(t, err)
		requestBody := session.WrapRequestBody(io.NopCloser(bytes.NewBufferString(body)))
		_, err = io.Copy(io.Discard, requestBody)
		require.NoError(t, err)
		require.NoError(t, requestBody.Close())
		responseBody := session.WrapResponseBody(io.NopCloser(bytes.NewBufferString(body)), 200, nil, nil)
		_, err = io.Copy(io.Discard, responseBody)
		require.NoError(t, err)
		require.NoError(t, responseBody.Close())
	}

	manager := NewManager(Config{Enabled: true, Directory: directory, MaxFileSize: 256})
	writeRecord(manager, "first", 1, string(bytes.Repeat([]byte("a"), 300)))
	writeRecord(manager, "second", 1, "b")
	writeRecord(manager, "other-channel", 2, "c")
	writeRecord(NewManager(Config{Enabled: true, Directory: directory, MaxFileSize: 256}), "after-restart", 1, "d")

	firstInfo, err := os.Stat(filepath.Join(directory, "channel-1-1.log"))
	require.NoError(t, err)
	assert.Greater(t, firstInfo.Size(), int64(256))
	assert.FileExists(t, filepath.Join(directory, "channel-1-2.log"))
	assert.FileExists(t, filepath.Join(directory, "channel-1-3.log"))
	assert.FileExists(t, filepath.Join(directory, "channel-2-1.log"))
}

func TestConcurrentRecordsRemainParseable(t *testing.T) {
	directory := t.TempDir()
	manager := NewManager(Config{Enabled: true, Directory: directory, MaxFileSize: 1 << 20})

	var waitGroup sync.WaitGroup
	errorChannel := make(chan error, 20)
	for index := 0; index < 20; index++ {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			session, err := manager.Begin(Metadata{RequestID: "concurrent", ChannelID: 9, Model: "claude-opus-5"})
			if err != nil {
				errorChannel <- err
				return
			}
			responseBody := session.WrapResponseBody(io.NopCloser(bytes.NewBufferString("payload")), 200, nil, nil)
			_, err = io.Copy(io.Discard, responseBody)
			if err != nil {
				errorChannel <- err
				return
			}
			if err = responseBody.Close(); err != nil {
				errorChannel <- err
			}
		}()
	}
	waitGroup.Wait()
	close(errorChannel)
	for err := range errorChannel {
		require.NoError(t, err)
	}

	records, err := ReadFile(filepath.Join(directory, "channel-9-1.log"))
	require.NoError(t, err)
	assert.Len(t, records, 20)
}

func TestAbortRemovesTemporarySpoolsWithoutWritingArchive(t *testing.T) {
	t.Parallel()
	directory := t.TempDir()
	manager := NewManager(Config{Enabled: true, Directory: directory})
	session, err := manager.Begin(Metadata{RequestID: "failed", ChannelID: 10, Model: "claude-opus-5"})
	require.NoError(t, err)
	requestBody := session.WrapRequestBody(io.NopCloser(bytes.NewBufferString("request")))
	_, err = io.Copy(io.Discard, requestBody)
	require.NoError(t, err)
	require.NoError(t, requestBody.Close())
	session.Abort()

	entries, err := os.ReadDir(directory)
	require.NoError(t, err)
	assert.Empty(t, entries)
}

func TestDisabledAndInvalidDirectoryDoNotStartSession(t *testing.T) {
	t.Parallel()

	session, err := NewManager(Config{}).Begin(Metadata{ChannelID: 1, Model: "claude-opus-5"})
	require.NoError(t, err)
	assert.Nil(t, session)

	filePath := filepath.Join(t.TempDir(), "file")
	require.NoError(t, os.WriteFile(filePath, []byte("x"), 0600))
	_, err = NewManager(Config{Enabled: true, Directory: filePath, MaxFileSize: 100}).Begin(Metadata{ChannelID: 1, Model: "claude-opus-5"})
	assert.Error(t, err)
}
