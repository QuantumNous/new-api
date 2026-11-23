package jsplugin

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"math"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/MoeForge/moego/regexp"
	"github.com/QuantumNous/new-api/common"
	"github.com/tidwall/gjson"
)

const (
	// maxConfigSchemaDepth bounds the nesting of meta.configSchema: a
	// top-level property is level 1, and items and nested properties add a
	// level each.
	maxConfigSchemaDepth      = 4
	maxConfigTitleRunes       = 256
	maxConfigDescriptionRunes = 512
	// maxConfigInteger is the largest integer a config number holds exactly.
	maxConfigInteger = 1 << 53
	// maxValidateConfigMessageRunes bounds the message a validateConfig throw
	// shows the administrator saving an instance.
	maxValidateConfigMessageRunes = 256
	// maxConfigMapEntries and maxConfigMapKeyBytes bound the value of an
	// additionalProperties field of meta.channelConfig, a value per model.
	maxConfigMapEntries  = 1024
	maxConfigMapKeyBytes = 256
)

var configFieldTypes = []string{"string", "number", "integer", "boolean", "array", "object"}

// configKeywordTypes maps each member of a configSchema field to the field
// types it applies to; nil applies to every type.
var configKeywordTypes = map[string][]string{
	"type":        nil,
	"title":       nil,
	"description": nil,
	"default":     nil,
	"examples":    nil,
	"enum":        {"string", "number", "integer"},
	"enumTitles":  {"string", "number", "integer"},
	"minimum":     {"number", "integer"},
	"maximum":     {"number", "integer"},
	"unit":        {"number", "integer"},
	"minLength":   {"string"},
	"maxLength":   {"string"},
	"pattern":     {"string"},
	"format":      {"string", "object"},
	"items":       {"array"},
	"minItems":    {"array"},
	"maxItems":    {"array"},
	"uniqueItems": {"array"},
	"properties":  {"object"},
	"required":    {"object"},
	// additionalProperties is a channelConfig field only: a value per model.
	"additionalProperties": {"object"},
	// visibleWhen applies to every type but only on a property: the parent
	// reads it with decodeVisibleWhen.
	"visibleWhen": nil,
}

// configFormats are the formats a field type may declare. They are form
// hints, except url and keywords: a non-empty url value must be an absolute
// http(s) URL, and its host is one utils.fetch may address (ConfigURLHosts);
// a keywords value is a list of keywords, one per line, that hooks match
// with utils.keywords and never read themselves (KeywordFields).
var configFormats = map[string][]string{"string": {"textarea", "regex", "url", "password", "keywords"}, "object": {"json"}}

// configUnits are the units unit may give a number or integer field; the UI
// shows its value in them.
var configUnits = []string{"byte", "pixel", "character", "second"}

// ConfigSchema is meta.configSchema, the schema of the config of a request
// processing instance, or meta.channelConfig, the schema of a channel's plugin
// config. It is decoded once when the plugin loads and never changes; its JSON
// is the normalized schema, with properties in the order the plugin declares
// them.
type ConfigSchema struct {
	root *configField
	text json.RawMessage
	// keywords are the names of the keywords format properties.
	keywords []string
}

func (s *ConfigSchema) MarshalJSON() ([]byte, error) {
	return s.text, nil
}

// ConfigSchemaJSON returns meta.configSchema as normalized JSON text, nil
// when the plugin declares none.
func (m Meta) ConfigSchemaJSON() json.RawMessage {
	if m.ConfigSchema == nil {
		return nil
	}
	return slices.Clone(m.ConfigSchema.text)
}

// ConfigURLHosts returns the host, with its port when it has one, of every
// non-empty url format value of an instance config: the hosts utils.fetch may
// address besides meta.allowedHosts. config is a validated config.
func (p *LoadedPlugin) ConfigURLHosts(config json.RawMessage) []string {
	if p.Meta.ConfigSchema == nil || len(config) == 0 {
		return nil
	}
	var value any
	if err := common.Unmarshal(config, &value); err != nil {
		return nil
	}
	return p.Meta.ConfigSchema.root.urlHosts(value, nil)
}

func (f *configField) urlHosts(value any, hosts []string) []string {
	switch f.Type {
	case "string":
		text, _ := value.(string)
		if f.Format != "url" || text == "" {
			return hosts
		}
		if parsed, err := url.Parse(text); err == nil && parsed.Host != "" {
			hosts = append(hosts, parsed.Host)
		}
	case "array":
		items, _ := value.([]any)
		if f.Items == nil {
			return hosts
		}
		for _, item := range items {
			hosts = f.Items.urlHosts(item, hosts)
		}
	case "object":
		object, _ := value.(map[string]any)
		if f.Properties == nil {
			return hosts
		}
		for _, property := range *f.Properties {
			if item, present := object[property.name]; present {
				hosts = property.field.urlHosts(item, hosts)
			}
		}
	}
	return hosts
}

// ValidateConfig checks an instance config against meta.configSchema and
// returns it with the defaults of absent properties applied. Without a schema
// only {} is valid; an empty config reads as {}. When the plugin exports
// validateConfig, it then runs on that result, and its throw is the error.
func (p *LoadedPlugin) ValidateConfig(config json.RawMessage) (json.RawMessage, error) {
	if len(bytes.TrimSpace(config)) == 0 {
		config = json.RawMessage("{}")
	}
	var value any
	if err := common.Unmarshal(config, &value); err != nil {
		return nil, fmt.Errorf("config must be a JSON object")
	}
	object, ok := value.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("config must be a JSON object")
	}
	validated := json.RawMessage("{}")
	if p.Meta.ConfigSchema == nil {
		if len(object) > 0 {
			return nil, fmt.Errorf("plugin %s takes no config; config must be {}", p.Meta.Key)
		}
	} else {
		value, err := p.Meta.ConfigSchema.root.validate(object, "config")
		if err != nil {
			return nil, err
		}
		if validated, err = common.Marshal(value); err != nil {
			return nil, err
		}
	}
	if !p.Engine.HasExport("validateConfig") {
		return validated, nil
	}
	// The call carries no fetcher and no stage, so utils.fetch and
	// utils.paramOverride throw in it. It reads keywords fields as hooks do.
	hookConfig := validated
	if fields := p.Meta.ConfigSchema.KeywordFields(); len(fields) > 0 {
		hookConfig = instanceKeywordsOf(p.Engine.key, &TransformContext{Config: validated, keywordFields: fields}).view
	}
	if _, err := p.Engine.Call(context.Background(), "validateConfig", RawJSON(hookConfig)); err != nil {
		var hookErr *HookError
		switch {
		case errors.As(err, &hookErr):
			return nil, errors.New(truncateRunes(hookErr.Message, maxValidateConfigMessageRunes))
		case errors.Is(err, errCallTimeout), errors.Is(err, ErrCallAdmissionTimeout), errors.Is(err, context.DeadlineExceeded):
			return nil, fmt.Errorf("plugin %s validateConfig timed out", p.Meta.Key)
		}
		return nil, fmt.Errorf("plugin %s validateConfig failed", p.Meta.Key)
	}
	return validated, nil
}

// ChannelConfigSchemaJSON returns meta.channelConfig as normalized JSON text,
// nil when the plugin declares none.
func (m Meta) ChannelConfigSchemaJSON() json.RawMessage {
	if m.ChannelConfig == nil {
		return nil
	}
	return slices.Clone(m.ChannelConfig.text)
}

// ValidateChannelConfig checks the plugin config an administrator saves on a
// channel against meta.channelConfig and returns what the channel stores:
// the config without the top-level properties the schema does not declare
// and without the defaults of absent ones, which apply when it is read. An
// empty config reads as {}; without a schema the result is always {}.
func (p *LoadedPlugin) ValidateChannelConfig(config json.RawMessage) (json.RawMessage, error) {
	object, err := configObject(config)
	if err != nil {
		return nil, err
	}
	schema := p.Meta.ChannelConfig
	if schema == nil {
		return json.RawMessage("{}"), nil
	}
	for name := range object {
		if !schema.root.Properties.has(name) {
			delete(object, name)
		}
	}
	given := slices.Collect(maps.Keys(object))
	value, err := schema.root.validate(object, "plugin_config")
	if err != nil {
		return nil, err
	}
	validated := value.(map[string]any)
	for name := range validated {
		if !slices.Contains(given, name) {
			delete(validated, name)
		}
	}
	return common.Marshal(validated)
}

// ChannelConfigFor returns a channel's stored plugin config as its hooks get
// it: the properties meta.channelConfig declares, with the defaults of absent
// ones applied. A stored value the schema no longer accepts, after a plugin
// update, reaches the plugin as stored, as a request processing instance's
// config does; the next save checks it again. Without a schema it is {}.
func (p *LoadedPlugin) ChannelConfigFor(stored json.RawMessage) json.RawMessage {
	schema := p.Meta.ChannelConfig
	if schema == nil {
		return json.RawMessage("{}")
	}
	object, err := configObject(stored)
	if err != nil {
		object = map[string]any{}
	}
	for name := range object {
		if !schema.root.Properties.has(name) {
			delete(object, name)
		}
	}
	for _, property := range *schema.root.Properties {
		if _, present := object[property.name]; present || property.field.Default == nil {
			continue
		}
		var item any
		if common.Unmarshal(property.field.Default, &item) == nil {
			object[property.name] = item
		}
	}
	// validate normalizes url values in place; a rejected config keeps them
	// as stored.
	if encoded, err := common.Marshal(object); err == nil {
		var checked map[string]any
		if common.Unmarshal(encoded, &checked) == nil {
			if value, validateErr := schema.root.validate(checked, "plugin_config"); validateErr == nil {
				object = value.(map[string]any)
			}
		}
	}
	encoded, err := common.Marshal(object)
	if err != nil {
		return json.RawMessage("{}")
	}
	return encoded
}

// ChannelConfigURL returns the url property name of a channel plugin config,
// empty when it has no value.
func ChannelConfigURL(config json.RawMessage, name string) string {
	return strings.TrimSpace(gjson.GetBytes(config, gjson.Escape(name)).String())
}

// hasAddress reports whether the schema has a top-level url property name.
func (s *ConfigSchema) hasAddress(name string) bool {
	if s == nil || s.root.Properties == nil {
		return false
	}
	index := slices.IndexFunc(*s.root.Properties, func(property configProperty) bool { return property.name == name })
	return index >= 0 && (*s.root.Properties)[index].field.Type == "string" && (*s.root.Properties)[index].field.Format == "url"
}

func configObject(config json.RawMessage) (map[string]any, error) {
	if len(bytes.TrimSpace(config)) == 0 || string(bytes.TrimSpace(config)) == "null" {
		return map[string]any{}, nil
	}
	var value any
	if err := common.Unmarshal(config, &value); err != nil {
		return nil, fmt.Errorf("plugin_config must be a JSON object")
	}
	object, ok := value.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("plugin_config must be a JSON object")
	}
	return object, nil
}

// channelAddress normalizes a url value of meta.channelConfig as the plugin's
// meta.baseUrl is: an absolute http(s) URL with an ASCII host and no
// credentials, query or fragment, without a trailing slash.
func channelAddress(text string) (string, bool) {
	address, err := normalizeMetaBaseURL(text)
	return address, err == nil
}

// configField is one field of meta.configSchema, or the schema itself. Its
// JSON is the normalized field.
type configField struct {
	Type        string            `json:"type"`
	Title       LocalizedText     `json:"title,omitempty"`
	Description LocalizedText     `json:"description,omitempty"`
	Default     json.RawMessage   `json:"default,omitempty"`
	Examples    []json.RawMessage `json:"examples,omitempty"`
	Enum        []json.RawMessage `json:"enum,omitempty"`
	EnumTitles  []LocalizedText   `json:"enumTitles,omitempty"`
	Minimum     *float64          `json:"minimum,omitempty"`
	Maximum     *float64          `json:"maximum,omitempty"`
	Unit        string            `json:"unit,omitempty"`
	MinLength   *int              `json:"minLength,omitempty"`
	MaxLength   *int              `json:"maxLength,omitempty"`
	Pattern     string            `json:"pattern,omitempty"`
	Format      string            `json:"format,omitempty"`
	Items       *configField      `json:"items,omitempty"`
	MinItems    *int              `json:"minItems,omitempty"`
	MaxItems    *int              `json:"maxItems,omitempty"`
	UniqueItems bool              `json:"uniqueItems,omitempty"`
	// Properties is nil when the field declares none: such an object field
	// accepts any object.
	Properties *configProperties `json:"properties,omitempty"`
	Required   []string          `json:"required,omitempty"`
	// AdditionalProperties is the field of every value of a channelConfig
	// object keyed by model name, a string, number, integer or boolean field.
	AdditionalProperties *configField `json:"additionalProperties,omitempty"`
	// VisibleWhen maps sibling property names to the values that show the
	// field in the form, always as lists. Like Unit it is a display hint and
	// never changes validation.
	VisibleWhen map[string][]json.RawMessage `json:"visibleWhen,omitempty"`

	pattern    *regexp.Regexp
	enumValues []any
	// channel marks a field of meta.channelConfig, whose url values are
	// channel addresses.
	channel bool
}

type configProperty struct {
	name  string
	field *configField
}

// configProperties are an object field's properties in declaration order.
type configProperties []configProperty

func (p configProperties) MarshalJSON() ([]byte, error) {
	var encoded bytes.Buffer
	encoded.WriteByte('{')
	for index, property := range p {
		if index > 0 {
			encoded.WriteByte(',')
		}
		name, err := common.Marshal(property.name)
		if err != nil {
			return nil, err
		}
		field, err := common.Marshal(property.field)
		if err != nil {
			return nil, err
		}
		encoded.Write(name)
		encoded.WriteByte(':')
		encoded.Write(field)
	}
	encoded.WriteByte('}')
	return encoded.Bytes(), nil
}

// decodeConfigSchema reads meta.configSchema from the JSON text the plugin
// declares, which keeps its property order.
func decodeConfigSchema(text []byte) (*ConfigSchema, error) {
	return decodeSchema(text, "plugin meta configSchema", false)
}

// decodeChannelConfigSchema reads meta.channelConfig: the configSchema format,
// where a url field is a channel address and an object field may hold a
// value per model (additionalProperties).
func decodeChannelConfigSchema(text []byte) (*ConfigSchema, error) {
	return decodeSchema(text, "plugin meta channelConfig", true)
}

func decodeSchema(text []byte, subject string, channel bool) (*ConfigSchema, error) {
	root, err := decodeConfigField(gjson.ParseBytes(text), subject, 0, channel)
	if err != nil {
		return nil, err
	}
	normalized, err := common.Marshal(root)
	if err != nil {
		return nil, err
	}
	schema := &ConfigSchema{root: root, text: normalized}
	// utils.keywords names a keywords list by its property, so a list is a
	// property of the instance config itself.
	for _, property := range *root.Properties {
		if property.field.Format == "keywords" && !channel {
			schema.keywords = append(schema.keywords, property.name)
		} else if nestedKeywords(property.field) || property.field.Format == "keywords" {
			return nil, fmt.Errorf("%s.properties.%s: format keywords applies to the properties of configSchema itself", subject, property.name)
		}
	}
	return schema, nil
}

// nestedKeywords reports a keywords format field inside field.
func nestedKeywords(field *configField) bool {
	if field.Items != nil && (field.Items.Format == "keywords" || nestedKeywords(field.Items)) {
		return true
	}
	if field.AdditionalProperties != nil && (field.AdditionalProperties.Format == "keywords" || nestedKeywords(field.AdditionalProperties)) {
		return true
	}
	if field.Properties != nil {
		for _, property := range *field.Properties {
			if property.field.Format == "keywords" || nestedKeywords(property.field) {
				return true
			}
		}
	}
	return false
}

// KeywordFields returns the names of the keywords format properties.
func (s *ConfigSchema) KeywordFields() []string {
	if s == nil {
		return nil
	}
	return s.keywords
}

// decodeConfigField reads one field at depth; depth 0 is the schema itself,
// which has only type "object", properties and required. channel marks a
// field of meta.channelConfig.
func decodeConfigField(value gjson.Result, subject string, depth int, channel bool) (*configField, error) {
	if depth > maxConfigSchemaDepth {
		return nil, fmt.Errorf("%s nests deeper than %d levels", strings.SplitN(subject, ".", 2)[0], maxConfigSchemaDepth)
	}
	if !value.IsObject() {
		return nil, fmt.Errorf("%s must be an object", subject)
	}
	members := make(map[string]gjson.Result)
	value.ForEach(func(key, member gjson.Result) bool {
		members[key.String()] = member
		return true
	})
	field := &configField{Type: members["type"].Str, channel: channel}
	if members["type"].Type != gjson.String || !slices.Contains(configFieldTypes, field.Type) {
		return nil, fmt.Errorf("%s.type must be one of %s", subject, strings.Join(configFieldTypes, ", "))
	}
	if depth == 0 && (field.Type != "object" || !members["properties"].IsObject()) {
		return nil, fmt.Errorf("%s must be {type: \"object\", properties: {...}}", subject)
	}
	for name := range members {
		types, known := configKeywordTypes[name]
		if depth == 0 {
			known = name == "type" || name == "properties" || name == "required"
		}
		if !known {
			return nil, fmt.Errorf("%s has unknown member %q", subject, name)
		}
		if types != nil && !slices.Contains(types, field.Type) {
			return nil, fmt.Errorf("%s.%s does not apply to a field of type %s", subject, name, field.Type)
		}
		if name == "additionalProperties" && !channel {
			return nil, fmt.Errorf("%s.additionalProperties applies only to meta.channelConfig", subject)
		}
	}
	var err error
	if depth > 0 {
		if !members["title"].Exists() {
			return nil, fmt.Errorf("%s.title is required", subject)
		}
		if field.Title, err = decodeLocalizedText(members["title"].Value(), subject+".title", maxConfigTitleRunes); err != nil {
			return nil, err
		}
	}
	if member, exists := members["description"]; exists {
		if field.Description, err = decodeLocalizedText(member.Value(), subject+".description", maxConfigDescriptionRunes); err != nil {
			return nil, err
		}
	}
	if field.Minimum, err = configNumber(members, "minimum", subject); err != nil {
		return nil, err
	}
	if field.Maximum, err = configNumber(members, "maximum", subject); err != nil {
		return nil, err
	}
	if field.Minimum != nil && field.Maximum != nil && *field.Minimum > *field.Maximum {
		return nil, fmt.Errorf("%s.minimum must not exceed maximum", subject)
	}
	for _, bound := range []struct {
		low, high string
		lowValue  **int
		highValue **int
	}{{"minLength", "maxLength", &field.MinLength, &field.MaxLength}, {"minItems", "maxItems", &field.MinItems, &field.MaxItems}} {
		if *bound.lowValue, err = configCount(members, bound.low, subject); err != nil {
			return nil, err
		}
		if *bound.highValue, err = configCount(members, bound.high, subject); err != nil {
			return nil, err
		}
		if *bound.lowValue != nil && *bound.highValue != nil && **bound.lowValue > **bound.highValue {
			return nil, fmt.Errorf("%s.%s must not exceed %s", subject, bound.low, bound.high)
		}
	}
	if member, exists := members["pattern"]; exists {
		if member.Type != gjson.String {
			return nil, fmt.Errorf("%s.pattern must be a string", subject)
		}
		if field.pattern, err = regexp.Compile(member.Str); err != nil {
			return nil, fmt.Errorf("%s.pattern is not a valid RE2 regular expression", subject)
		}
		field.Pattern = member.Str
	}
	if member, exists := members["format"]; exists {
		if member.Type != gjson.String || !slices.Contains(configFormats[field.Type], member.Str) {
			return nil, fmt.Errorf("%s.format must be one of %s for a field of type %s", subject, strings.Join(configFormats[field.Type], ", "), field.Type)
		}
		field.Format = member.Str
	}
	if member, exists := members["unit"]; exists {
		if member.Type != gjson.String || !slices.Contains(configUnits, member.Str) {
			return nil, fmt.Errorf("%s.unit must be one of %s", subject, strings.Join(configUnits, ", "))
		}
		field.Unit = member.Str
	}
	if member, exists := members["uniqueItems"]; exists {
		if member.Type != gjson.True && member.Type != gjson.False {
			return nil, fmt.Errorf("%s.uniqueItems must be a boolean", subject)
		}
		field.UniqueItems = member.Bool()
	}
	if member, exists := members["enum"]; exists {
		if !member.IsArray() || len(member.Array()) == 0 {
			return nil, fmt.Errorf("%s.enum must be a non-empty array", subject)
		}
		for _, item := range member.Array() {
			var enumValue any
			switch {
			case field.Type == "string" && item.Type == gjson.String:
				enumValue = item.Str
			case field.Type != "string" && item.Type == gjson.Number && (field.Type == "number" || item.Num == math.Trunc(item.Num)):
				enumValue = item.Num
			default:
				return nil, fmt.Errorf("%s.enum values must be of type %s", subject, field.Type)
			}
			if slices.Contains(field.enumValues, enumValue) {
				return nil, fmt.Errorf("%s.enum values must be unique", subject)
			}
			field.enumValues = append(field.enumValues, enumValue)
			field.Enum = append(field.Enum, json.RawMessage(item.Raw))
		}
	}
	if member, exists := members["enumTitles"]; exists {
		if !member.IsArray() || len(member.Array()) != len(field.Enum) {
			return nil, fmt.Errorf("%s.enumTitles must be an array as long as enum", subject)
		}
		for index, item := range member.Array() {
			title, titleErr := decodeLocalizedText(item.Value(), fmt.Sprintf("%s.enumTitles[%d]", subject, index), maxConfigTitleRunes)
			if titleErr != nil {
				return nil, titleErr
			}
			field.EnumTitles = append(field.EnumTitles, title)
		}
	}
	if member, exists := members["items"]; exists {
		if field.Items, err = decodeConfigField(member, subject+".items", depth+1, channel); err != nil {
			return nil, err
		}
		if member.Get("visibleWhen").Exists() {
			return nil, fmt.Errorf("%s.items.visibleWhen applies only to a property", subject)
		}
	}
	if member, exists := members["properties"]; exists {
		if !member.IsObject() {
			return nil, fmt.Errorf("%s.properties must be an object", subject)
		}
		properties := configProperties{}
		var conditions []gjson.Result
		member.ForEach(func(key, item gjson.Result) bool {
			name := key.String()
			if strings.TrimSpace(name) == "" {
				err = fmt.Errorf("%s.properties names must not be empty", subject)
				return false
			}
			var property *configField
			if property, err = decodeConfigField(item, subject+".properties."+name, depth+1, channel); err != nil {
				return false
			}
			properties = append(properties, configProperty{name: name, field: property})
			conditions = append(conditions, item.Get("visibleWhen"))
			return true
		})
		if err != nil {
			return nil, err
		}
		// visibleWhen names sibling properties, so it is read once all of
		// them are decoded.
		for index, condition := range conditions {
			if !condition.Exists() {
				continue
			}
			property := properties[index]
			if property.field.VisibleWhen, err = properties.decodeVisibleWhen(property.name, condition, subject+".properties."+property.name+".visibleWhen"); err != nil {
				return nil, err
			}
		}
		field.Properties = &properties
	}
	if member, exists := members["additionalProperties"]; exists {
		if field.Properties != nil {
			return nil, fmt.Errorf("%s has both properties and additionalProperties", subject)
		}
		itemSubject := subject + ".additionalProperties"
		if field.AdditionalProperties, err = decodeConfigField(member, itemSubject, depth+1, channel); err != nil {
			return nil, err
		}
		item := field.AdditionalProperties
		if !slices.Contains([]string{"string", "number", "integer", "boolean"}, item.Type) {
			return nil, fmt.Errorf("%s.type must be string, number, integer or boolean", itemSubject)
		}
		if item.Default != nil || member.Get("visibleWhen").Exists() {
			return nil, fmt.Errorf("%s takes no default or visibleWhen: a model without a value takes the plugin's own default", itemSubject)
		}
	}
	if member, exists := members["required"]; exists {
		if !member.IsArray() || field.Properties == nil {
			return nil, fmt.Errorf("%s.required must be an array of declared property names", subject)
		}
		for _, item := range member.Array() {
			if item.Type != gjson.String || !field.Properties.has(item.Str) || slices.Contains(field.Required, item.Str) {
				return nil, fmt.Errorf("%s.required must be an array of declared property names", subject)
			}
			field.Required = append(field.Required, item.Str)
		}
	}
	// default and examples are checked against the complete field.
	if member, exists := members["default"]; exists {
		if err = field.checkValue(member.Raw, subject+".default"); err != nil {
			return nil, err
		}
		field.Default = json.RawMessage(member.Raw)
		// A channel address default reads as a saved address does.
		if address, ok := channelAddress(member.Str); ok && field.channel && field.Format == "url" {
			field.Default, _ = common.Marshal(address)
		}
	}
	if member, exists := members["examples"]; exists {
		if !member.IsArray() {
			return nil, fmt.Errorf("%s.examples must be an array", subject)
		}
		for index, item := range member.Array() {
			if err = field.checkValue(item.Raw, fmt.Sprintf("%s.examples[%d]", subject, index)); err != nil {
				return nil, err
			}
			field.Examples = append(field.Examples, json.RawMessage(item.Raw))
		}
	}
	return field, nil
}

func configNumber(members map[string]gjson.Result, name, subject string) (*float64, error) {
	member, exists := members[name]
	if !exists {
		return nil, nil
	}
	if member.Type != gjson.Number {
		return nil, fmt.Errorf("%s.%s must be a number", subject, name)
	}
	return &member.Num, nil
}

func configCount(members map[string]gjson.Result, name, subject string) (*int, error) {
	member, exists := members[name]
	if !exists {
		return nil, nil
	}
	if member.Type != gjson.Number || member.Num < 0 || member.Num > math.MaxInt32 || member.Num != math.Trunc(member.Num) {
		return nil, fmt.Errorf("%s.%s must be a non-negative integer", subject, name)
	}
	count := int(member.Num)
	return &count, nil
}

// checkValue validates a value a field declares itself: its default or an
// example.
func (f *configField) checkValue(raw string, path string) error {
	var value any
	if err := common.UnmarshalJsonStr(raw, &value); err != nil {
		return fmt.Errorf("%s must be JSON", path)
	}
	_, err := f.validate(value, path)
	return err
}

func (p configProperties) has(name string) bool {
	return slices.ContainsFunc(p, func(property configProperty) bool { return property.name == name })
}

// decodeVisibleWhen reads the visibleWhen of the property name: each key names
// another of these properties, of type string, number, integer or boolean,
// and maps to a value or a non-empty list of distinct values that property
// accepts. Every value comes back as a list.
func (p configProperties) decodeVisibleWhen(name string, condition gjson.Result, subject string) (map[string][]json.RawMessage, error) {
	members := condition.Map()
	if !condition.IsObject() || len(members) == 0 {
		return nil, fmt.Errorf("%s must be a non-empty object", subject)
	}
	visibleWhen := make(map[string][]json.RawMessage, len(members))
	for _, siblingName := range slices.Sorted(maps.Keys(members)) {
		siblingSubject := subject + "." + siblingName
		index := slices.IndexFunc(p, func(property configProperty) bool { return property.name == siblingName })
		if siblingName == name || index < 0 {
			return nil, fmt.Errorf("%s must name another property of the same object", siblingSubject)
		}
		sibling := p[index].field
		if !slices.Contains([]string{"string", "number", "integer", "boolean"}, sibling.Type) {
			return nil, fmt.Errorf("%s must name a property of type string, number, integer or boolean", siblingSubject)
		}
		member := members[siblingName]
		values := []gjson.Result{member}
		if member.IsArray() {
			values = member.Array()
		}
		if len(values) == 0 {
			return nil, fmt.Errorf("%s must be a value or a non-empty array of values", siblingSubject)
		}
		var seen []any
		for position, value := range values {
			valueSubject := siblingSubject
			if member.IsArray() {
				valueSubject = fmt.Sprintf("%s[%d]", siblingSubject, position)
			}
			// The check rejects arrays and objects, which seen could not compare.
			if err := sibling.checkValue(value.Raw, valueSubject); err != nil {
				return nil, err
			}
			if slices.Contains(seen, value.Value()) {
				return nil, fmt.Errorf("%s values must be unique", siblingSubject)
			}
			seen = append(seen, value.Value())
			visibleWhen[siblingName] = append(visibleWhen[siblingName], json.RawMessage(value.Raw))
		}
	}
	return visibleWhen, nil
}

// validate checks a decoded config value against the field and returns it
// with the defaults of absent properties filled in. path names the value in
// errors, which never quote it.
func (f *configField) validate(value any, path string) (any, error) {
	switch f.Type {
	case "string":
		text, ok := value.(string)
		if !ok {
			return nil, fmt.Errorf("%s must be a string", path)
		}
		length := utf8.RuneCountInString(text)
		if f.MinLength != nil && length < *f.MinLength {
			return nil, fmt.Errorf("%s must be at least %d characters", path, *f.MinLength)
		}
		if f.MaxLength != nil && length > *f.MaxLength {
			return nil, fmt.Errorf("%s must not exceed %d characters", path, *f.MaxLength)
		}
		if f.pattern != nil && !f.pattern.MatchString(text) {
			return nil, fmt.Errorf("%s does not match the required pattern", path)
		}
		if f.Format == "url" && text != "" && f.channel {
			address, ok := channelAddress(text)
			if !ok {
				return nil, fmt.Errorf("%s must be an absolute http or https URL with an ASCII host and without credentials, query or fragment", path)
			}
			value = address
		} else if f.Format == "url" && text != "" {
			parsed, err := url.Parse(text)
			if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" || parsed.User != nil || parsed.Fragment != "" || strings.HasSuffix(text, "#") {
				return nil, fmt.Errorf("%s must be an absolute http or https URL without credentials or fragment", path)
			}
		}
	case "number", "integer":
		number, ok := value.(float64)
		if !ok {
			return nil, fmt.Errorf("%s must be a number", path)
		}
		if f.Type == "integer" && (number != math.Trunc(number) || math.Abs(number) > maxConfigInteger) {
			return nil, fmt.Errorf("%s must be an integer", path)
		}
		if f.Minimum != nil && number < *f.Minimum {
			return nil, fmt.Errorf("%s must be at least %v", path, *f.Minimum)
		}
		if f.Maximum != nil && number > *f.Maximum {
			return nil, fmt.Errorf("%s must not exceed %v", path, *f.Maximum)
		}
	case "boolean":
		if _, ok := value.(bool); !ok {
			return nil, fmt.Errorf("%s must be a boolean", path)
		}
	case "array":
		items, ok := value.([]any)
		if !ok {
			return nil, fmt.Errorf("%s must be an array", path)
		}
		if f.MinItems != nil && len(items) < *f.MinItems {
			return nil, fmt.Errorf("%s must have at least %d items", path, *f.MinItems)
		}
		if f.MaxItems != nil && len(items) > *f.MaxItems {
			return nil, fmt.Errorf("%s must not have more than %d items", path, *f.MaxItems)
		}
		seen := make(map[string]struct{}, len(items))
		for index := range items {
			itemPath := fmt.Sprintf("%s[%d]", path, index)
			if f.Items != nil {
				item, err := f.Items.validate(items[index], itemPath)
				if err != nil {
					return nil, err
				}
				items[index] = item
			}
			if !f.UniqueItems {
				continue
			}
			// The host codec writes maps sorted, so equal values encode equally.
			encoded, err := common.Marshal(items[index])
			if err != nil {
				return nil, err
			}
			if _, duplicate := seen[string(encoded)]; duplicate {
				return nil, fmt.Errorf("%s repeats an earlier item", itemPath)
			}
			seen[string(encoded)] = struct{}{}
		}
	case "object":
		object, ok := value.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("%s must be an object", path)
		}
		if f.AdditionalProperties != nil {
			if len(object) > maxConfigMapEntries {
				return nil, fmt.Errorf("%s must not have more than %d entries", path, maxConfigMapEntries)
			}
			for name, item := range object {
				if strings.TrimSpace(name) == "" || len(name) > maxConfigMapKeyBytes {
					return nil, fmt.Errorf("%s keys must be model names of 1 to %d bytes", path, maxConfigMapKeyBytes)
				}
				validated, err := f.AdditionalProperties.validate(item, path+"["+strconv.Quote(name)+"]")
				if err != nil {
					return nil, err
				}
				object[name] = validated
			}
		}
		if f.Properties == nil {
			break
		}
		for name := range object {
			if !f.Properties.has(name) {
				return nil, fmt.Errorf("%s has unknown property %q", path, name)
			}
		}
		for _, property := range *f.Properties {
			item, present := object[property.name]
			if !present {
				if property.field.Default == nil {
					continue
				}
				// A fresh copy: the result must not share the schema's default.
				if err := common.Unmarshal(property.field.Default, &item); err != nil {
					return nil, err
				}
			}
			validated, err := property.field.validate(item, path+"."+property.name)
			if err != nil {
				return nil, err
			}
			object[property.name] = validated
		}
		for _, name := range f.Required {
			if _, present := object[name]; !present {
				return nil, fmt.Errorf("%s.%s is required", path, name)
			}
		}
	}
	if len(f.enumValues) > 0 && !slices.Contains(f.enumValues, value) {
		return nil, fmt.Errorf("%s must be one of the listed values", path)
	}
	return value, nil
}
