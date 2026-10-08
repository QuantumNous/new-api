package media

import (
	"context"
	"encoding/base64"
	"errors"
	"strings"
	"sync"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/relaykit/types"
)

type MediaResolver struct {
	GetBase64Data        func(c context.Context, source types.FileSource, reason ...string) (string, string, error)
	DecodeBase64FileData func(base64String string) (string, string, error)
}

var (
	mediaResolverMu sync.RWMutex
	mediaResolver   MediaResolver
)

func SetMediaResolver(resolver MediaResolver) {
	mediaResolverMu.Lock()
	defer mediaResolverMu.Unlock()

	mediaResolver = resolver
}

func ResolveBase64Data(c context.Context, source types.FileSource, reason ...string) (string, string, error) {
	mediaResolverMu.RLock()
	resolver := mediaResolver.GetBase64Data
	mediaResolverMu.RUnlock()
	if resolver == nil {
		return "", "", errors.New("relayconvert media resolver is not configured")
	}
	return resolver(c, source, reason...)
}

func DecodeBase64FileData(base64String string) (string, string, error) {
	mediaResolverMu.RLock()
	resolver := mediaResolver.DecodeBase64FileData
	mediaResolverMu.RUnlock()
	if resolver == nil {
		return "", "", errors.New("relayconvert media resolver is not configured")
	}
	return resolver(base64String)
}

// IsTextMimeType reports whether a MIME type is plain text that a target can
// carry as text: text/* and application/json, ignoring parameters.
func IsTextMimeType(mimeType string) bool {
	mediaType, _, _ := strings.Cut(strings.ToLower(strings.TrimSpace(mimeType)), ";")
	mediaType = strings.TrimSpace(mediaType)
	return strings.HasPrefix(mediaType, "text/") || mediaType == "application/json"
}

// DecodeText decodes base64 file data as text. It reports false when the data
// is not valid base64 or the bytes are not UTF-8.
func DecodeText(base64Data string) (string, bool) {
	decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(base64Data))
	if err != nil || !utf8.Valid(decoded) {
		return "", false
	}
	return string(decoded), true
}
