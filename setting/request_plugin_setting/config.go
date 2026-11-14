package request_plugin_setting

import (
	"encoding/json"
	"slices"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

// InstancesOption is the option key of the instance list.
const InstancesOption = "request_plugin_setting.instances"

// Instance is one configured use of a request plugin. Global instances run
// on every request, group instances on the requests of their groups, and a
// channel runs the instances its request_plugins setting lists. Models
// narrows any of them to requests for those models; empty means every
// model. Whether a failure stops the request is the plugin's meta.optional;
// the required member of older saved lists is dropped on load.
//
// A plugin scope instance runs where its plugin's meta.scope says instead,
// on every channel and model that fits it, new ones included, but only where
// the scope an administrator confirmed holds the request too: a plugin
// update that narrows its scope applies at once, and one that widens it
// reaches the new requests once an administrator confirms it again.
type Instance struct {
	ID      string          `json:"id"`
	Name    string          `json:"name"`
	Plugin  string          `json:"plugin"`
	Enabled bool            `json:"enabled"`
	Global  bool            `json:"global"`
	Groups  []string        `json:"groups"`
	Models  []string        `json:"models"`
	Config  json.RawMessage `json:"config"`
	// PluginScope is the confirmed scope of a plugin scope instance; nil for
	// an instance placed by hand.
	PluginScope *Scope `json:"plugin_scope,omitempty"`
}

// Scope is a plugin's scope as an administrator confirmed it: its models
// and channel types; an empty list leaves that side open.
type Scope struct {
	Models       []string `json:"models"`
	ChannelTypes []int    `json:"channel_types"`
}

// Instances is the stored instance list. Every load replaces the whole list
// under instancesMu, so a request keeps a consistent list it read once.
type Instances []Instance

var instancesMu sync.RWMutex

func (list *Instances) UnmarshalJSON(data []byte) error {
	var decoded []Instance
	if err := common.Unmarshal(data, &decoded); err != nil {
		return err
	}
	// Lists saved before models existed read as every model.
	for index := range decoded {
		if decoded[index].Models == nil {
			decoded[index].Models = []string{}
		}
	}
	instancesMu.Lock()
	*list = decoded
	instancesMu.Unlock()
	return nil
}

type RequestPluginSetting struct {
	Instances Instances `json:"instances"`
}

var requestPluginSetting = RequestPluginSetting{Instances: Instances{}}

func init() {
	config.GlobalConfig.Register("request_plugin_setting", &requestPluginSetting)
}

// GetInstances returns the instance list in option order. The list is shared
// and must not be changed.
func GetInstances() []Instance {
	instancesMu.RLock()
	defer instancesMu.RUnlock()
	return requestPluginSetting.Instances
}

// Covers reports whether the scope holds a request for model, whose name
// without its @ modifiers is base, sent through a channel of channelType; 0
// before a channel is selected, when only a scope without channel types
// holds it.
func (s *Scope) Covers(model, base string, channelType int) bool {
	if len(s.Models) > 0 && !slices.Contains(s.Models, base) && !slices.Contains(s.Models, model) {
		return false
	}
	return len(s.ChannelTypes) == 0 || channelType > 0 && slices.Contains(s.ChannelTypes, channelType)
}

// Within returns the part of the confirmed scope s that the scope a plugin
// declares now also holds, so a plugin update that narrows its scope takes
// effect at once and one that widens it reaches no new request until an
// administrator confirms it. ok is false when the two share no request.
func (s *Scope) Within(models []string, channelTypes []int) (*Scope, bool) {
	within := &Scope{Models: overlap(s.Models, models), ChannelTypes: overlap(s.ChannelTypes, channelTypes)}
	if len(s.Models) > 0 && len(models) > 0 && len(within.Models) == 0 {
		return nil, false
	}
	if len(s.ChannelTypes) > 0 && len(channelTypes) > 0 && len(within.ChannelTypes) == 0 {
		return nil, false
	}
	return within, true
}

// overlap is what two lists, each open when empty, both hold: the other
// list when one is open, otherwise the items in both.
func overlap[T comparable](a, b []T) []T {
	if len(a) == 0 {
		return b
	}
	if len(b) == 0 {
		return a
	}
	var both []T
	for _, item := range a {
		if slices.Contains(b, item) {
			both = append(both, item)
		}
	}
	return both
}

// Equal reports whether the scope holds the same models and channel types,
// in any order.
func (s *Scope) Equal(models []string, channelTypes []int) bool {
	return sameItems(s.Models, models) && sameItems(s.ChannelTypes, channelTypes)
}

func sameItems[T comparable](a, b []T) bool {
	if len(a) != len(b) {
		return false
	}
	for _, item := range a {
		if !slices.Contains(b, item) {
			return false
		}
	}
	return true
}

// Clone returns a copy with empty lists, never nil ones.
func (s *Scope) Clone() *Scope {
	return &Scope{Models: append([]string{}, s.Models...), ChannelTypes: append([]int{}, s.ChannelTypes...)}
}
