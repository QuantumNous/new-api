package service

import (
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestShouldQuarantineChannelModel(t *testing.T) {
	tests := []struct {
		name string
		msg  string
		want bool
	}{
		{name: "chinese route unavailable", msg: "当前路由暂无可用渠道", want: true},
		{name: "english route unavailable", msg: "upstream: no available channel", want: true},
		{name: "ordinary timeout", msg: "context deadline exceeded", want: false},
		{name: "nil error", msg: "", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var err *types.NewAPIError
			if tt.msg != "" {
				err = types.NewError(errors.New(tt.msg), types.ErrorCodeBadResponseStatusCode)
			}
			require.Equal(t, tt.want, ShouldQuarantineChannelModel(err))
		})
	}
}
