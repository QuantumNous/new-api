//go:build !with_wireguard

package service

import (
	"github.com/sagernet/sing-box/adapter/endpoint"
	"github.com/sagernet/sing-box/adapter/outbound"
)

func registerWireGuardOutbound(*outbound.Registry) {}

func registerWireGuardEndpoint(*endpoint.Registry) {}
