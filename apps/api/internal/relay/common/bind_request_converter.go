package common

import (
	"context"
	"github.com/QuantumNous/new-api/internal/transport/contract"

	"github.com/QuantumNous/new-api/relaykit/relayconvert"
	"github.com/QuantumNous/new-api/relaykit/types"
)

func init() {
	relayconvert.SetMediaResolver(relayconvert.MediaResolver{
		// relayconvert is framework-free; recover the contract context threaded
		// through the request context so file caching/cleanup keeps working.
		GetBase64Data: func(ctx context.Context, source types.FileSource, reason ...string) (string, string, error) {
			if cc, ok := ctx.Value(mediaContractKey{}).(contract.Context); ok {
				return GetBase64Data(cc, source, reason...)
			}
			return GetBase64Data(nil, source, reason...)
		},
		DecodeBase64FileData: DecodeBase64FileData,
	})
}

// mediaContractKey threads the contract context through relayconvert's plain
// context so the media resolver can reach file services.
type mediaContractKey struct{}

func threadMediaCtx(c contract.Context) context.Context {
	if c == nil {
		return context.Background()
	}
	c.SetContextValue(mediaContractKey{}, c)
	return c.Context()
}

func ConvertRequest(c contract.Context, info *RelayInfo, target types.RelayFormat, request any) (*relayconvert.RequestResult, error) {
	ctx := threadMediaCtx(c)
	return relayconvert.ConvertRequest(ctx, info, target, request)
}

func ConvertRequestByID(c contract.Context, info *RelayInfo, converter string, request any) (*relayconvert.RequestResult, error) {
	ctx := threadMediaCtx(c)
	return relayconvert.ConvertRequestByID(ctx, info, converter, request)
}

func ConvertRequestVia(c contract.Context, info *RelayInfo, request any, path ...types.RelayFormat) (*relayconvert.RequestResult, error) {
	ctx := threadMediaCtx(c)
	return relayconvert.ConvertRequestVia(ctx, info, request, path...)
}
