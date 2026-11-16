package config

import (
	"encoding/json"
	"reflect"
	"strconv"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

// ConfigManager manages all configurations in a unified manner
type ConfigManager struct {
	configs map[string]any
	mutex   sync.RWMutex
}

var GlobalConfig = NewConfigManager()

func NewConfigManager() *ConfigManager {
	return &ConfigManager{
		configs: make(map[string]any),
	}
}

// Register registers a configuration module
func (cm *ConfigManager) Register(name string, config any) {
	cm.mutex.Lock()
	defer cm.mutex.Unlock()
	cm.configs[name] = config
}

// Get gets the specified configuration module
func (cm *ConfigManager) Get(name string) any {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()
	return cm.configs[name]
}

// LoadFromDB loads configuration from database
func (cm *ConfigManager) LoadFromDB(options map[string]string) error {
	cm.mutex.Lock()
	defer cm.mutex.Unlock()

	for name, config := range cm.configs {
		prefix := name + "."
		configMap := make(map[string]string)

		// Collect all options belonging to this configuration
		for key, value := range options {
			if after, ok := strings.CutPrefix(key, prefix); ok {
				configKey := after
				configMap[configKey] = value
			}
		}

		// If the configuration item is found, update the configuration
		if len(configMap) > 0 {
			if err := updateConfigFromMap(config, configMap); err != nil {
				common.SysError(common.LogText("failed to update config %s: %s", name, err.Error()))
				continue
			}
		}
	}

	return nil
}

// SaveToDB saves the configuration to the database
func (cm *ConfigManager) SaveToDB(updateFunc func(key, value string) error) error {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()

	for name, config := range cm.configs {
		configMap, err := configToMap(config)
		if err != nil {
			return err
		}

		for key, value := range configMap {
			dbKey := name + "." + key
			if err := updateFunc(dbKey, value); err != nil {
				return err
			}
		}
	}

	return nil
}

// Helper function: Convert configuration object to map
func configToMap(config any) (map[string]string, error) {
	result := make(map[string]string)

	val := reflect.ValueOf(config)
	if val.Kind() == reflect.Pointer {
		val = val.Elem()
	}

	if val.Kind() != reflect.Struct {
		return nil, nil
	}

	typ := val.Type()
	for i := 0; i < val.NumField(); i++ {
		field := val.Field(i)
		fieldType := typ.Field(i)

		// Skip unexported fields
		if !fieldType.IsExported() {
			continue
		}

		// Get json tag as key name
		key := fieldType.Tag.Get("json")
		if key == "" || key == "-" {
			key = fieldType.Name
		}

		// Handle different types of fields
		var strValue string
		switch field.Kind() {
		case reflect.String:
			strValue = field.String()
		case reflect.Bool:
			strValue = strconv.FormatBool(field.Bool())
		case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
			strValue = strconv.FormatInt(field.Int(), 10)
		case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
			strValue = strconv.FormatUint(field.Uint(), 10)
		case reflect.Float32, reflect.Float64:
			strValue = strconv.FormatFloat(field.Float(), 'f', -1, 64)
		case reflect.Pointer:
			// Handle pointer types: if non-nil, serialize the value pointed to
			if !field.IsNil() {
				bytes, err := json.Marshal(field.Interface())
				if err != nil {
					return nil, err
				}
				strValue = string(bytes)
			} else {
				// nil pointers serialize to "null"
				strValue = "null"
			}
		case reflect.Map, reflect.Slice, reflect.Struct:
			// Complex types are serialized using JSON
			bytes, err := json.Marshal(field.Interface())
			if err != nil {
				return nil, err
			}
			strValue = string(bytes)
		default:
			// Skip unsupported types
			continue
		}

		result[key] = strValue
	}

	return result, nil
}

// Helper function: update configuration object from map
func updateConfigFromMap(config any, configMap map[string]string) error {
	val := reflect.ValueOf(config)
	if val.Kind() != reflect.Pointer {
		return nil
	}
	val = val.Elem()

	if val.Kind() != reflect.Struct {
		return nil
	}

	typ := val.Type()
	for i := 0; i < val.NumField(); i++ {
		field := val.Field(i)
		fieldType := typ.Field(i)

		// Skip unexported fields
		if !fieldType.IsExported() {
			continue
		}

		// Get json tag as key name
		key := fieldType.Tag.Get("json")
		if key == "" || key == "-" {
			key = fieldType.Name
		}

		// Check whether there is a corresponding value in the map
		strValue, ok := configMap[key]
		if !ok {
			continue
		}

		// Set value based on field type
		if !field.CanSet() {
			continue
		}

		switch field.Kind() {
		case reflect.String:
			field.SetString(strValue)
		case reflect.Bool:
			boolValue, err := strconv.ParseBool(strValue)
			if err != nil {
				continue
			}
			field.SetBool(boolValue)
		case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
			intValue, err := strconv.ParseInt(strValue, 10, 64)
			if err != nil {
				// Strings compatible with float format (such as "2.000000")
				floatValue, fErr := strconv.ParseFloat(strValue, 64)
				if fErr != nil {
					continue
				}
				intValue = int64(floatValue)
			}
			field.SetInt(intValue)
		case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
			uintValue, err := strconv.ParseUint(strValue, 10, 64)
			if err != nil {
				// Strings compatible with float format
				floatValue, fErr := strconv.ParseFloat(strValue, 64)
				if fErr != nil || floatValue < 0 {
					continue
				}
				uintValue = uint64(floatValue)
			}
			field.SetUint(uintValue)
		case reflect.Float32, reflect.Float64:
			floatValue, err := strconv.ParseFloat(strValue, 64)
			if err != nil {
				continue
			}
			field.SetFloat(floatValue)
		case reflect.Pointer:
			// Handling pointer types
			if strValue == "null" {
				field.Set(reflect.Zero(field.Type()))
			} else {
				// If the pointer is nil, it needs to be initialized first
				if field.IsNil() {
					field.Set(reflect.New(field.Type().Elem()))
				}
				// Deserialize to the value pointed to by the pointer
				err := json.Unmarshal([]byte(strValue), field.Interface())
				if err != nil {
					continue
				}
			}
		case reflect.Map:
			// json.Unmarshal merges into existing maps (keeps old keys that are
			// absent from the new JSON). Allocate a fresh map so removed keys
			// are properly cleared.
			fresh := reflect.New(field.Type())
			if err := json.Unmarshal([]byte(strValue), fresh.Interface()); err != nil {
				continue
			}
			field.Set(fresh.Elem())
		case reflect.Slice, reflect.Struct:
			err := json.Unmarshal([]byte(strValue), field.Addr().Interface())
			if err != nil {
				continue
			}
		}
	}

	return nil
}

// ConfigToMap converts the configuration object to map (export function)
func ConfigToMap(config any) (map[string]string, error) {
	return configToMap(config)
}

// UpdateConfigFromMap updates configuration objects from map (export function)
func UpdateConfigFromMap(config any, configMap map[string]string) error {
	return updateConfigFromMap(config, configMap)
}

// ExportAllConfigs exports all registered configurations into a flat structure
func (cm *ConfigManager) ExportAllConfigs() map[string]string {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()

	result := make(map[string]string)

	for name, cfg := range cm.configs {
		configMap, err := ConfigToMap(cfg)
		if err != nil {
			continue
		}

		// Add to the results using the format "module name.configuration item"
		for key, value := range configMap {
			result[name+"."+key] = value
		}
	}

	return result
}
