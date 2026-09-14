package constant

import (
	"errors"
	"slices"
	"strings"
)

const (
	VertexStorageModelPrefix = "storage:gs:"
	VertexStorageRoutePrefix = "/vertexai"
	VertexStorageUploadRoute = VertexStorageRoutePrefix + "/upload/storage/v1/b/:bucket/o"
	VertexStorageListRoute   = VertexStorageRoutePrefix + "/storage/v1/b/:bucket/o"
	VertexStorageObjectRoute = VertexStorageRoutePrefix + "/storage/v1/b/:bucket/o/*object"
)

func NormalizeVertexStorageBucket(raw string) (string, error) {
	bucket := strings.TrimSpace(raw)
	if bucket == "" || bucket == "." || bucket == ".." {
		return "", errors.New("invalid Vertex storage bucket")
	}
	if strings.HasPrefix(bucket, VertexStorageModelPrefix) ||
		strings.Contains(bucket, "://") || strings.ContainsAny(bucket, `/\?#`) {
		return "", errors.New("invalid Vertex storage bucket")
	}
	return bucket, nil
}

func VertexStorageModelName(raw string) (string, error) {
	bucket, err := NormalizeVertexStorageBucket(raw)
	if err != nil {
		return "", err
	}
	return VertexStorageModelPrefix + bucket, nil
}

// VertexStorageChannelSupports reports whether a channel's model list grants
// access to rawBucket. The match is exact: a bucket is authorized only when the
// channel explicitly offers "storage:gs:<bucket>".
func VertexStorageChannelSupports(models []string, rawBucket string) bool {
	modelName, err := VertexStorageModelName(rawBucket)
	if err != nil {
		return false
	}
	return slices.ContainsFunc(models, func(offered string) bool {
		return strings.TrimSpace(offered) == modelName
	})
}

func ValidateVertexStorageObjectName(object string) error {
	if object == "" {
		return errors.New("Vertex storage object is required")
	}
	for segment := range strings.SplitSeq(object, "/") {
		if segment == "." || segment == ".." {
			return errors.New("invalid Vertex storage object")
		}
	}
	return nil
}

func IsVertexStoragePath(path string) bool {
	return strings.HasPrefix(path, VertexStorageRoutePrefix+"/")
}
