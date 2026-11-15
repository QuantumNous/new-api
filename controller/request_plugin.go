package controller

import (
	"crypto/rand"
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relay/requestplugin"
	"github.com/QuantumNous/new-api/setting/request_plugin_setting"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// maxRequestPluginOptionBytes bounds the stored instance list. It fits a
// full keyword list, and stays under MySQL's default max_allowed_packet of
// 4 MiB.
const maxRequestPluginOptionBytes = 3 << 20

// Bounds of an instance's models.
const (
	maxRequestPluginModels     = 100
	maxRequestPluginModelRunes = 128
)

// maxRequestPluginDryRunReplyBytes bounds the sample answer of a dry run.
const maxRequestPluginDryRunReplyBytes = 16 << 10

type requestPluginInstancesRequest struct {
	Instances []request_plugin_setting.Instance `json:"instances"`
}

func GetRequestPluginInstances(c *gin.Context) {
	instances := request_plugin_setting.GetInstances()
	if instances == nil {
		instances = []request_plugin_setting.Instance{}
	}
	// Binding an instance to a channel needs no config, and a config may
	// hold the key of a service the root user set up.
	if c.GetInt("role") < common.RoleRootUser {
		bindable := make([]request_plugin_setting.Instance, len(instances))
		for i, instance := range instances {
			instance.Config = nil
			bindable[i] = instance
		}
		instances = bindable
	}
	common.ApiSuccess(c, gin.H{"instances": instances})
}

// UpdateRequestPluginInstances replaces the instance list whole, in the order
// given. Each config is saved as the plugin validated it, with its defaults.
func UpdateRequestPluginInstances(c *gin.Context) {
	var request requestPluginInstancesRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Invalid parameters"))
		return
	}
	instances, err := normalizeRequestPluginInstances(request.Instances)
	if err != nil {
		common.ApiErrorStatus(c, http.StatusBadRequest, err)
		return
	}
	encoded, err := common.Marshal(instances)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if len(encoded) > maxRequestPluginOptionBytes {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Request plugin settings must not exceed {{max}} bytes", map[string]any{"max": maxRequestPluginOptionBytes}))
		return
	}
	if err = model.UpdateOption(request_plugin_setting.InstancesOption, string(encoded)); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"instances": instances})
}

// normalizeRequestPluginInstances checks an instance list and returns it as
// it is saved: ids filled in, names trimmed and configs validated. An enabled
// instance needs an available plugin; a disabled one may keep a plugin that
// was removed or switched off, so the rest of the list can still be saved.
func normalizeRequestPluginInstances(instances []request_plugin_setting.Instance) ([]request_plugin_setting.Instance, error) {
	normalized := make([]request_plugin_setting.Instance, 0, len(instances))
	ids := make(map[string]bool, len(instances))
	for _, instance := range instances {
		if instance.ID != "" {
			if ids[instance.ID] {
				return nil, common.NewMessage("Request plugin instance id {{id}} is used more than once", map[string]any{"id": instance.ID})
			}
			ids[instance.ID] = true
		}
	}
	for _, instance := range instances {
		instance.Name = strings.TrimSpace(instance.Name)
		if instance.Name == "" || utf8.RuneCountInString(instance.Name) > 64 {
			return nil, common.NewMessage("Request plugin instance names must be 1 to 64 characters")
		}
		if instance.ID == "" {
			for instance.ID == "" || ids[instance.ID] {
				instance.ID = "rp_" + strings.ToLower(rand.Text()[:8])
			}
			ids[instance.ID] = true
		}
		if instance.Groups == nil {
			instance.Groups = []string{}
		}
		for _, group := range instance.Groups {
			if strings.TrimSpace(group) == "" {
				return nil, common.NewMessage("Request plugin instance {{name}} has an empty group", map[string]any{"name": instance.Name})
			}
		}
		models := make([]string, 0, len(instance.Models))
		for _, name := range instance.Models {
			name = strings.TrimSpace(name)
			if name == "" {
				return nil, common.NewMessage("Request plugin instance {{name}} has an empty model name", map[string]any{"name": instance.Name})
			}
			if utf8.RuneCountInString(name) > maxRequestPluginModelRunes {
				return nil, common.NewMessage("Request plugin instance {{name}} has a model name longer than {{max}} characters", map[string]any{"name": instance.Name, "max": maxRequestPluginModelRunes})
			}
			if !slices.Contains(models, name) {
				models = append(models, name)
			}
		}
		if len(models) > maxRequestPluginModels {
			return nil, common.NewMessage("Request plugin instance {{name}} lists more than {{max}} models", map[string]any{"name": instance.Name, "max": maxRequestPluginModels})
		}
		instance.Models = models
		if len(instance.Config) == 0 || string(instance.Config) == "null" {
			instance.Config = json.RawMessage("{}")
		}
		// Request processing does not follow the plugin master switch.
		plugin, ok := jsplugin.DefaultRegistry.GetIgnoringMasterSwitch(instance.Plugin)
		if ok && !plugin.Meta.HasTransformPart() {
			return nil, common.NewMessage("Plugin {{plugin}} has no request processing hooks", map[string]any{"plugin": instance.Plugin})
		}
		if !ok {
			if instance.Enabled {
				return nil, common.NewMessage("Plugin {{plugin}} is not installed or is turned off", map[string]any{"plugin": instance.Plugin})
			}
			normalized = append(normalized, instance)
			continue
		}
		config, err := plugin.ValidateConfig(instance.Config)
		if err != nil {
			return nil, common.NewMessage("Request plugin instance {{name}} has an invalid config: {{error}}", map[string]any{"name": instance.Name, "error": err.Error()})
		}
		instance.Config = config
		normalized = append(normalized, instance)
	}
	return normalized, nil
}

type requestPluginDryRunRequest struct {
	Format    string          `json:"format"`
	Path      string          `json:"path"`
	Model     string          `json:"model"`
	Group     string          `json:"group"`
	ChannelID int             `json:"channel_id"`
	Body      json.RawMessage `json:"body"`
	// Reply is an answer text to run the reply checks on.
	Reply *string `json:"reply"`
	// Instance is an unsaved instance to run alone instead of the saved ones.
	Instance *request_plugin_setting.Instance `json:"instance"`
}

// DryRunRequestPlugins runs the saved instances on a request body as a relay
// request would, with a channel's bindings, without sending or charging it.
// Given an unsaved instance, it runs that one alone, as the editor tries it.
func DryRunRequestPlugins(c *gin.Context) {
	var request requestPluginDryRunRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Invalid parameters"))
		return
	}
	var body map[string]any
	if request.Format == "" || request.Model == "" || common.Unmarshal(request.Body, &body) != nil || body == nil {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("A dry run needs a format, a model and a JSON object body"))
		return
	}
	if request.Reply != nil && len(*request.Reply) > maxRequestPluginDryRunReplyBytes {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("A dry run reply must not exceed {{max}} bytes", map[string]any{"max": maxRequestPluginDryRunReplyBytes}))
		return
	}
	input := requestplugin.DryRunInput{
		Format:         request.Format,
		Path:           request.Path,
		Model:          request.Model,
		Group:          request.Group,
		Body:           request.Body,
		ModifierEffort: helper.ModelModifierEffort(request.Model),
		User:           jsplugin.TransformUser{ID: c.GetInt("id"), Username: c.GetString("username")},
		Reply:          request.Reply,
	}
	if request.Instance != nil {
		instance := *request.Instance
		instance.Enabled = true
		if strings.TrimSpace(instance.Name) == "" {
			instance.Name = instance.Plugin
		}
		normalized, err := normalizeRequestPluginInstances([]request_plugin_setting.Instance{instance})
		if err != nil {
			common.ApiErrorStatus(c, http.StatusBadRequest, err)
			return
		}
		input.Instance = &normalized[0]
	}
	if request.ChannelID > 0 {
		channel, err := model.GetChannelById(request.ChannelID, false)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Channel does not exist"))
			return
		}
		if err != nil {
			common.ApiError(c, err)
			return
		}
		input.Channel = &jsplugin.TransformChannel{ID: channel.Id, Type: channel.Type}
		input.Bound = channel.GetSetting().RequestPlugins
	}
	common.ApiSuccess(c, requestplugin.DryRun(c.Request.Context(), input))
}
