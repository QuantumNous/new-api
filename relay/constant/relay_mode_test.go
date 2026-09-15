package constant

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPath2RelayMode(t *testing.T) {
	tests := []struct {
		path string
		want int
	}{
		{path: "/v1/alpha/search", want: RelayModeAlphaSearch},
		{path: "/v1/alpha/search?foo=1", want: RelayModeAlphaSearch},
	}
	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			assert.Equal(t, tt.want, Path2RelayMode(tt.path))
		})
	}
}

func TestNormalizeVertexStorageBucket(t *testing.T) {
	tests := []struct {
		name    string
		raw     string
		want    string
		wantErr bool
	}{
		{name: "plain bucket", raw: "example-bucket", want: "example-bucket"},
		{name: "surrounding spaces are trimmed", raw: "  example-bucket  ", want: "example-bucket"},
		{name: "empty", raw: "   ", wantErr: true},
		{name: "dot segment", raw: ".", wantErr: true},
		{name: "parent segment", raw: "..", wantErr: true},
		{name: "gs scheme", raw: "gs://example-bucket", wantErr: true},
		{name: "object path", raw: "example-bucket/docs", wantErr: true},
		{name: "windows separator", raw: `example-bucket\docs`, wantErr: true},
		{name: "query string", raw: "example-bucket?alt=media", wantErr: true},
		{name: "fragment", raw: "example-bucket#docs", wantErr: true},
		{name: "already prefixed model", raw: VertexStorageModelPrefix + "example-bucket", wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NormalizeVertexStorageBucket(tt.raw)
			if tt.wantErr {
				assert.Error(t, err)
				assert.Empty(t, got)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestVertexStorageChannelSupports(t *testing.T) {
	models := []string{"gemini-2.5-pro", " storage:gs:example-bucket ", "storage:gs:archive-bucket"}

	assert.True(t, VertexStorageChannelSupports(models, "example-bucket"))
	assert.True(t, VertexStorageChannelSupports(models, " archive-bucket "))
	// A channel must declare the exact bucket; prefixes and suffixes never match.
	assert.False(t, VertexStorageChannelSupports(models, "example"))
	assert.False(t, VertexStorageChannelSupports(models, "example-bucket-2"))
	assert.False(t, VertexStorageChannelSupports(models, "gs://example-bucket"))
	assert.False(t, VertexStorageChannelSupports(models, ""))
	assert.False(t, VertexStorageChannelSupports(nil, "example-bucket"))
}

func TestValidateVertexStorageObjectName(t *testing.T) {
	require.NoError(t, ValidateVertexStorageObjectName("docs/report.pdf"))
	require.NoError(t, ValidateVertexStorageObjectName("a..b/report.pdf"))

	assert.Error(t, ValidateVertexStorageObjectName(""))
	assert.Error(t, ValidateVertexStorageObjectName(".."))
	assert.Error(t, ValidateVertexStorageObjectName("docs/../report.pdf"))
	assert.Error(t, ValidateVertexStorageObjectName("./report.pdf"))
	assert.Error(t, ValidateVertexStorageObjectName("docs/."))
}

func TestIsVertexStoragePath(t *testing.T) {
	assert.True(t, IsVertexStoragePath("/vertexai/storage/v1/b/example-bucket/o"))
	assert.False(t, IsVertexStoragePath("/vertexai"))
	assert.False(t, IsVertexStoragePath("/v1/chat/completions"))
	assert.False(t, IsVertexStoragePath("/vertexaistorage/v1"))
}
