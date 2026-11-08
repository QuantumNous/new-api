package common

import (
	"bytes"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewReplayableBodyReaderKeepsStorageLifecycleWithCaller(t *testing.T) {
	payload := []byte(`{"model":"test-model","input":"hello"}`)
	storage, err := CreateBodyStorage(payload)
	require.NoError(t, err)
	defer storage.Close()

	body := NewReplayableBodyReader(storage)
	assert.EqualValues(t, len(payload), body.Size())
	_, exposesCloser := any(body).(io.Closer)
	assert.False(t, exposesCloser, "the request body must not expose the storage closer")

	req, err := http.NewRequest(http.MethodPost, "https://example.com", body)
	require.NoError(t, err)
	require.NoError(t, req.Body.Close())

	replayBody, err := body.NewReader()
	require.NoError(t, err, "closing the HTTP request body must not close the storage")
	replay, err := io.ReadAll(replayBody)
	require.NoError(t, err)
	require.NoError(t, replayBody.Close())
	assert.Equal(t, payload, replay)

	require.NoError(t, storage.Close())
	_, err = body.NewReader()
	require.ErrorIs(t, err, ErrStorageClosed)
}

func TestCreateBodyStorageOffloadsPayloadsOverMemoryLimit(t *testing.T) {
	payload := bytes.Repeat([]byte("a"), int(BodyMemoryLimitBytes)+1)
	storage, err := CreateBodyStorage(payload)
	require.NoError(t, err)
	assert.True(t, storage.IsDisk(), "a payload over the memory limit must be offloaded to disk")
	assert.EqualValues(t, len(payload), storage.Size())

	stored, err := storage.Bytes()
	require.NoError(t, err)
	assert.Equal(t, payload, stored)

	require.NoError(t, storage.Close())
	_, err = storage.Bytes()
	require.ErrorIs(t, err, ErrStorageClosed)
}

func TestCreateBodyStorageFromReaderOffloadsUnknownOrOversizedBodies(t *testing.T) {
	small := []byte(`{"model":"test-model"}`)
	storage, err := CreateBodyStorageFromReader(bytes.NewReader(small), 0, 1<<20)
	require.NoError(t, err)
	assert.False(t, storage.IsDisk(), "an unknown length body that fits in memory stays in memory")
	stored, err := storage.Bytes()
	require.NoError(t, err)
	assert.Equal(t, small, stored)
	require.NoError(t, storage.Close())

	large := bytes.Repeat([]byte("b"), int(BodyMemoryLimitBytes)+1)
	storage, err = CreateBodyStorageFromReader(bytes.NewReader(large), -1, 1<<30)
	require.NoError(t, err)
	assert.True(t, storage.IsDisk(), "a body over the memory limit must be offloaded to disk")
	stored, err = storage.Bytes()
	require.NoError(t, err)
	assert.Equal(t, large, stored)
	require.NoError(t, storage.Close())

	_, err = CreateBodyStorageFromReader(bytes.NewReader(large), -1, 1024)
	require.ErrorIs(t, err, ErrRequestBodyTooLarge)
}
