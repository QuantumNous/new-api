package service

import (
	"context"

	box "github.com/sagernet/sing-box"
	"github.com/sagernet/sing-box/adapter/endpoint"
	"github.com/sagernet/sing-box/adapter/inbound"
	"github.com/sagernet/sing-box/adapter/outbound"
	boxservice "github.com/sagernet/sing-box/adapter/service"
	"github.com/sagernet/sing-box/dns"
	"github.com/sagernet/sing-box/dns/transport"
	"github.com/sagernet/sing-box/dns/transport/hosts"
	"github.com/sagernet/sing-box/dns/transport/local"
	"github.com/sagernet/sing-box/protocol/anytls"
	"github.com/sagernet/sing-box/protocol/block"
	"github.com/sagernet/sing-box/protocol/direct"
	protocolDNS "github.com/sagernet/sing-box/protocol/dns"
	"github.com/sagernet/sing-box/protocol/group"
	shttp "github.com/sagernet/sing-box/protocol/http"
	"github.com/sagernet/sing-box/protocol/shadowsocks"
	"github.com/sagernet/sing-box/protocol/shadowtls"
	"github.com/sagernet/sing-box/protocol/socks"
	"github.com/sagernet/sing-box/protocol/ssh"
	"github.com/sagernet/sing-box/protocol/trojan"
	"github.com/sagernet/sing-box/protocol/vless"
	"github.com/sagernet/sing-box/protocol/vmess"
)

func newProxyBoxContext(ctx context.Context) context.Context {

	return box.Context(
		ctx,
		inbound.NewRegistry(),
		newOutboundRegistry(),
		newEndpointRegistry(),
		newDNSTransportRegistry(),
		boxservice.NewRegistry(),
	)
}

func newOutboundRegistry() *outbound.Registry {
	registry := outbound.NewRegistry()

	direct.RegisterOutbound(registry)
	block.RegisterOutbound(registry)
	protocolDNS.RegisterOutbound(registry)
	group.RegisterSelector(registry)
	group.RegisterURLTest(registry)
	socks.RegisterOutbound(registry)
	shttp.RegisterOutbound(registry)
	shadowsocks.RegisterOutbound(registry)
	vmess.RegisterOutbound(registry)
	trojan.RegisterOutbound(registry)
	ssh.RegisterOutbound(registry)
	shadowtls.RegisterOutbound(registry)
	vless.RegisterOutbound(registry)
	anytls.RegisterOutbound(registry)
	registerWireGuardOutbound(registry)

	return registry
}

func newEndpointRegistry() *endpoint.Registry {
	registry := endpoint.NewRegistry()
	registerWireGuardEndpoint(registry)
	return registry
}

func newDNSTransportRegistry() *dns.TransportRegistry {
	registry := dns.NewTransportRegistry()
	transport.RegisterTCP(registry)
	transport.RegisterUDP(registry)
	transport.RegisterTLS(registry)
	transport.RegisterHTTPS(registry)
	hosts.RegisterTransport(registry)
	local.RegisterTransport(registry)
	return registry
}
