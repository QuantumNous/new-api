package service

import (
	"context"
	"testing"

	box "github.com/sagernet/sing-box"
	C "github.com/sagernet/sing-box/constant"
	"github.com/sagernet/sing-box/option"
	"github.com/stretchr/testify/require"
)

func TestSingBoxRegistryBuildsOutboundOnlyBox(t *testing.T) {
	instance, err := box.New(box.Options{
		Context: newProxyBoxContext(context.Background()),
		Options: option.Options{
			Outbounds: []option.Outbound{{Type: C.TypeDirect, Tag: "direct"}},
			Route:     &option.RouteOptions{Final: "direct"},
		},
	})
	require.NoError(t, err)
	require.NotNil(t, instance)
	require.Empty(t, instance.Inbound().Inbounds())
	require.NoError(t, instance.Close())
}
