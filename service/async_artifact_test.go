package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type memoryArtifactStore struct {
	mu      sync.Mutex
	objects map[string][]byte
}

func (s *memoryArtifactStore) Put(_ context.Context, key string, body io.Reader, _ string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := io.ReadAll(body)
	if err != nil {
		return err
	}
	s.objects[key] = data
	return nil
}

func (s *memoryArtifactStore) SignedURL(_ context.Context, key string, _ time.Duration) (string, error) {
	return "https://objects.example/" + key, nil
}

func (s *memoryArtifactStore) Delete(_ context.Context, key string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.objects, key)
	return nil
}

func TestIsPublicArtifactIP(t *testing.T) {
	assert.False(t, IsPublicArtifactIP(net.ParseIP("127.0.0.1")))
	assert.False(t, IsPublicArtifactIP(net.ParseIP("169.254.169.254")))
	assert.False(t, IsPublicArtifactIP(net.ParseIP("10.0.0.1")))
	assert.False(t, IsPublicArtifactIP(net.ParseIP("100.64.0.1")))
	assert.True(t, IsPublicArtifactIP(net.ParseIP("1.1.1.1")))
}

func TestArchiveInlineMediaStreamsAndPersists(t *testing.T) {
	task := &model.Task{TaskID: "task_inline_artifacts", Status: model.TaskStatusInProgress}
	require.NoError(t, model.DB.Create(task).Error)
	t.Cleanup(func() {
		model.DB.Where("task_id = ?", task.ID).Delete(&model.Artifact{})
		model.DB.Delete(task)
	})

	png := append([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}, bytes.Repeat([]byte{0}, 64)...)
	store := &memoryArtifactStore{objects: map[string][]byte{}}
	artifacts, err := ArchiveAsyncMedia(context.Background(), task, []AsyncMediaSource{{
		Base64:      base64.StdEncoding.EncodeToString(png),
		ContentType: "image/png",
	}}, store, 30)
	require.NoError(t, err)
	require.Len(t, artifacts, 1)
	assert.Equal(t, "image/png", artifacts[0].ContentType)
	assert.Equal(t, int64(len(png)), artifacts[0].SizeBytes)
	assert.WithinDuration(t, time.Now().Add(30*time.Minute), time.Unix(artifacts[0].ExpiresAt, 0), 2*time.Second)
	assert.Len(t, store.objects, 1)
}

func TestCleanupExpiredArtifactAlsoRemovesEmbeddedImagePayload(t *testing.T) {
	task := &model.Task{
		TaskID:     "task_expired_artifact_cleanup",
		Platform:   constant.TaskPlatformAsyncImage,
		UserId:     1,
		ChannelId:  2,
		Status:     model.TaskStatusSuccess,
		Progress:   "100%",
		SubmitTime: time.Now().Add(-time.Hour).Unix(),
		FinishTime: time.Now().Add(-time.Minute).Unix(),
		Data:       json.RawMessage(`{}`),
	}
	job := &model.AsyncJob{
		TokenID:         17,
		ChannelID:       2,
		EndpointType:    model.AsyncEndpointImageGeneration,
		RequestPayload:  []byte("encrypted"),
		RequestHash:     strings.Repeat("a", 64),
		IdempotencyKey:  "expired-artifact-cleanup",
		ExecutionStatus: model.AsyncStatusSuccess,
		BillingStatus:   model.AsyncBillingSettled,
		ResultPayload:   model.JSONValue(`{"data":[{"b64_json":"embedded-image-data"}]}`),
	}
	require.NoError(t, model.CreateAsyncTask(task, job))
	artifact := &model.Artifact{
		TaskID:        task.ID,
		ObjectKey:     "async/task_expired_artifact_cleanup/image.png",
		ContentType:   "image/png",
		SizeBytes:     12,
		SHA256:        strings.Repeat("b", 64),
		SourceURLHash: strings.Repeat("c", 64),
		ExpiresAt:     time.Now().Add(-time.Minute).Unix(),
	}
	require.NoError(t, model.DB.Create(artifact).Error)
	t.Cleanup(func() {
		model.DB.Where("task_id = ?", task.ID).Delete(&model.Artifact{})
		model.DB.Where("task_id = ?", task.ID).Delete(&model.TaskEvent{})
		model.DB.Where("task_id = ?", task.ID).Delete(&model.AsyncJob{})
		model.DB.Delete(task)
	})

	store := &memoryArtifactStore{objects: map[string][]byte{artifact.ObjectKey: []byte("image")}}
	deleted, err := CleanupExpiredAsyncArtifacts(context.Background(), store, 100)
	require.NoError(t, err)
	assert.Equal(t, 1, deleted)
	assert.NotContains(t, store.objects, artifact.ObjectKey)

	var artifactCount int64
	require.NoError(t, model.DB.Model(&model.Artifact{}).Where("id = ?", artifact.ID).Count(&artifactCount).Error)
	assert.Zero(t, artifactCount)
	var storedJob model.AsyncJob
	require.NoError(t, model.DB.First(&storedJob, job.ID).Error)
	assert.Empty(t, storedJob.ResultPayload)
	var taskCount int64
	require.NoError(t, model.DB.Model(&model.Task{}).Where("id = ?", task.ID).Count(&taskCount).Error)
	assert.Equal(t, int64(1), taskCount)
}

func TestArchivePersistsEveryImageInMultiImageResponse(t *testing.T) {
	task := &model.Task{TaskID: "task_multiple_artifacts", Status: model.TaskStatusInProgress}
	require.NoError(t, model.DB.Create(task).Error)
	t.Cleanup(func() {
		model.DB.Where("task_id = ?", task.ID).Delete(&model.Artifact{})
		model.DB.Delete(task)
	})

	png := append([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}, bytes.Repeat([]byte{0}, 64)...)
	encoded := base64.StdEncoding.EncodeToString(png)
	store := &memoryArtifactStore{objects: map[string][]byte{}}
	artifacts, err := ArchiveAsyncMedia(context.Background(), task, []AsyncMediaSource{
		{Base64: encoded, ContentType: "image/png"},
		{Base64: encoded, ContentType: "image/png"},
	}, store, 30)
	require.NoError(t, err)
	assert.Len(t, artifacts, 2)
	assert.Len(t, store.objects, 2)
}

func TestArchiveReusesExistingArtifactsAfterWorkerRecovery(t *testing.T) {
	task := &model.Task{TaskID: "task_recovered_artifacts", Status: model.TaskStatusInProgress}
	require.NoError(t, model.DB.Create(task).Error)
	t.Cleanup(func() {
		model.DB.Where("task_id = ?", task.ID).Delete(&model.Artifact{})
		model.DB.Delete(task)
	})

	png := append([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}, bytes.Repeat([]byte{0}, 64)...)
	store := &memoryArtifactStore{objects: map[string][]byte{}}
	first, err := ArchiveAsyncMedia(context.Background(), task, []AsyncMediaSource{{
		Base64:      base64.StdEncoding.EncodeToString(png),
		ContentType: "image/png",
	}}, store, 30)
	require.NoError(t, err)
	require.Len(t, first, 1)

	second, err := ArchiveAsyncMedia(context.Background(), task, []AsyncMediaSource{{
		Base64:      base64.StdEncoding.EncodeToString(append(png, 1)),
		ContentType: "image/png",
	}}, store, 30)
	require.NoError(t, err)
	require.Len(t, second, 1)
	assert.Equal(t, first[0].ObjectKey, second[0].ObjectKey)
	assert.Len(t, store.objects, 1)
}

func TestMaterializeArtifactRejectsSpoofedImageMIME(t *testing.T) {
	_, err := materializeAsyncArtifact(context.Background(), AsyncMediaSource{
		Base64:      base64.StdEncoding.EncodeToString([]byte("not an image")),
		ContentType: "image/png",
	}, 1024, 0)
	require.ErrorContains(t, err, "allowed raster image")
}

func TestParseDataURLSource(t *testing.T) {
	source, ok := ParseDataURLSource("data:image/png;base64,aGVsbG8=")
	assert.True(t, ok)
	assert.Equal(t, "image/png", source.ContentType)
	assert.Equal(t, "aGVsbG8=", source.Base64)
	_, ok = ParseDataURLSource("data:image/svg+xml;base64,PHN2Zz4=")
	assert.False(t, ok)
}
