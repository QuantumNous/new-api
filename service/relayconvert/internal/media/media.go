package media

import (
	"errors"
	"sync"

	"github.com/QuantumNous/new-api/types"
	"context"
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
