package sub2api

import "github.com/QuantumNous/new-api/relay/channel/newapi"

// Adaptor shares the multiprotocol wire contract but only consumes the
// credential stored on this user channel; platform management secrets are not
// part of the relay adaptor.
type Adaptor struct {
	newapi.Adaptor
}

func (a *Adaptor) GetModelList() []string { return ModelList }
func (a *Adaptor) GetChannelName() string { return ChannelName }
