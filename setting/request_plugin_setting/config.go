package request_plugin_setting

import (
	"encoding/json"
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
type Instance struct {
	ID      string          `json:"id"`
	Name    string          `json:"name"`
	Plugin  string          `json:"plugin"`
	Enabled bool            `json:"enabled"`
	Global  bool            `json:"global"`
	Groups  []string        `json:"groups"`
	Models  []string        `json:"models"`
	Config  json.RawMessage `json:"config"`
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
