package common

import (
	"io"
	"net/http"
	"runtime"
	"testing"
	"weak"

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

func closedMemoryStorageFixture(t *testing.T) (BodyStorage, weak.Pointer[byte]) {
	t.Helper()
	data := make([]byte, 4<<20, 8<<20)
	data[0] = 'x'
	buffer := weak.Make(&data[0])
	storage := newMemoryStorage(data)
	require.NoError(t, storage.Close())
	return storage, buffer
}

func TestMemoryStorageCloseReleasesBuffer(t *testing.T) {
	before := GetDiskCacheStats()
	storage, buffer := closedMemoryStorageFixture(t)
	require.NoError(t, storage.Close())
	runtime.GC()
	runtime.GC()
	retained := buffer.Value() != nil
	runtime.KeepAlive(storage)
	assert.False(t, retained, "closed storage must not keep its backing array alive")

	after := GetDiskCacheStats()
	assert.Equal(t, before.ActiveMemoryBuffers, after.ActiveMemoryBuffers)
	assert.Equal(t, before.CurrentMemoryUsageBytes, after.CurrentMemoryUsageBytes)

	_, unowned := closedMemoryStorageFixture(t)
	runtime.GC()
	runtime.GC()
	assert.Nil(t, unowned.Value(), "the fixture must not retain the allocation without a storage owner")
}

func TestMemoryStorageClosePreservesExistingReaders(t *testing.T) {
	const payload = "request body for replay"
	storage := newMemoryStorage([]byte(payload))
	defer storage.Close()
	borrowed, err := storage.Bytes()
	require.NoError(t, err)
	reader, err := storage.NewReader()
	require.NoError(t, err)
	defer reader.Close()
	require.NoError(t, storage.Close())

	replayed, err := io.ReadAll(reader)
	require.NoError(t, err)
	assert.Equal(t, payload, string(replayed))
	assert.Equal(t, payload, string(borrowed))
	assert.EqualValues(t, len(payload), storage.Size())
	assert.False(t, storage.IsDisk())

	n, err := storage.Read(make([]byte, 1))
	assert.Zero(t, n)
	assert.ErrorIs(t, err, ErrStorageClosed)
	position, err := storage.Seek(0, io.SeekStart)
	assert.Zero(t, position)
	assert.ErrorIs(t, err, ErrStorageClosed)
	data, err := storage.Bytes()
	assert.Nil(t, data)
	assert.ErrorIs(t, err, ErrStorageClosed)
	newReader, err := storage.NewReader()
	assert.Nil(t, newReader)
	assert.ErrorIs(t, err, ErrStorageClosed)
}
