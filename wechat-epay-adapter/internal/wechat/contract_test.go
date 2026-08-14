package wechat

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

type contractClient struct{}

func (contractClient) CreateNativeOrder(context.Context, NativeOrderRequest) (NativeOrder, error) {
	return NativeOrder{}, nil
}

func (contractClient) QueryOrder(context.Context, string) (OrderQuery, error) {
	return OrderQuery{}, nil
}

func TestClientContractUsesDomainTypes(t *testing.T) {
	var client Client = contractClient{}
	assert.NotNil(t, client)
	assert.Equal(t, "public_key", VerifyModePublicKey)
}
