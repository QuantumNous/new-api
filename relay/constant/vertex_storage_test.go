package constant

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestVertexStorageRoutesUseProviderPrefix(t *testing.T) {
	assert.Equal(t, "/vertexai", VertexStorageRoutePrefix)
	assert.Equal(t, "/vertexai/upload/storage/v1/b/:bucket/o", VertexStorageUploadRoute)
	assert.Equal(t, "/vertexai/storage/v1/b/:bucket/o", VertexStorageListRoute)
	assert.Equal(t, "/vertexai/storage/v1/b/:bucket/o/*object", VertexStorageObjectRoute)
}

func TestNormalizeVertexStorageBucketRejectsPathAndURLSyntax(t *testing.T) {
	for _, value := range []string{
		"", " ", ".", "..", "bucket/path", `bucket\path`,
		"storage:gs:bucket", "gs://bucket", "bucket?x=1", "bucket#fragment",
	} {
		t.Run(value, func(t *testing.T) {
			_, err := NormalizeVertexStorageBucket(value)
			require.Error(t, err)
		})
	}
}

func TestVertexStorageModelNameTrimsAndChannelSupportIsExact(t *testing.T) {
	modelName, err := VertexStorageModelName(" bucket-a ")
	require.NoError(t, err)
	assert.Equal(t, "storage:gs:bucket-a", modelName)

	models := []string{"gemini-2.5-pro", " storage:gs:bucket-a ", "storage:gs:bucket-ab"}
	assert.True(t, VertexStorageChannelSupports(models, "bucket-a"))
	assert.False(t, VertexStorageChannelSupports(models, "bucket"))
	assert.False(t, VertexStorageChannelSupports(models, "bucket-a/path"))
}

func TestValidateVertexStorageObjectNameRejectsDotSegments(t *testing.T) {
	for _, value := range []string{
		"", ".", "..", "folder/./file.txt", "folder/../file.txt", "./folder/file.txt", "../folder/file.txt",
	} {
		t.Run(value, func(t *testing.T) {
			require.Error(t, ValidateVertexStorageObjectName(value))
		})
	}

	for _, value := range []string{"file.txt", "folder/file.txt", "folder/.../file.txt", " folder /file.txt "} {
		t.Run("valid "+value, func(t *testing.T) {
			require.NoError(t, ValidateVertexStorageObjectName(value))
		})
	}
}

func TestIsVertexStoragePathRequiresSlashAfterPrefix(t *testing.T) {
	assert.True(t, IsVertexStoragePath("/vertexai/storage/v1/b/bucket-a/o"))
	assert.False(t, IsVertexStoragePath("/vertexai-evil/storage/v1/b/bucket-a/o"))
	assert.False(t, IsVertexStoragePath("/v1/rawproxy/vertexai/storage/v1/b/bucket-a/o"))
}
