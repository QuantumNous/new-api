package config

import (
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

// ConfigManager 统一管理所有配置
type ConfigManager struct {
	configs     map[string]interface{}
	updateHooks map[string]func()
	updateLocks map[string]sync.Locker
	mutex       sync.RWMutex
}

type configModuleSnapshot struct {
	name   string
	config interface{}
	hook   func()
	lock   sync.Locker
}

var GlobalConfig = NewConfigManager()

func NewConfigManager() *ConfigManager {
	return &ConfigManager{
		configs:     make(map[string]interface{}),
		updateHooks: make(map[string]func()),
		updateLocks: make(map[string]sync.Locker),
	}
}

// Register 注册一个配置模块
func (cm *ConfigManager) Register(name string, config interface{}) {
	cm.mutex.Lock()
	defer cm.mutex.Unlock()
	cm.configs[name] = config
	if cm.updateLocks[name] == nil {
		cm.updateLocks[name] = &sync.Mutex{}
	}
}

// RegisterUpdateHook registers a callback that runs after LoadFromDB updates a
// config module. It is useful for modules that publish derived runtime caches.
func (cm *ConfigManager) RegisterUpdateHook(name string, hook func()) {
	cm.mutex.Lock()
	defer cm.mutex.Unlock()
	if hook == nil {
		delete(cm.updateHooks, name)
		return
	}
	cm.updateHooks[name] = hook
}

// RegisterUpdateLock registers a module-level lock for direct reflective config
// reads and writes performed by ConfigManager.
func (cm *ConfigManager) RegisterUpdateLock(name string, lock sync.Locker) {
	cm.mutex.Lock()
	defer cm.mutex.Unlock()
	if lock == nil {
		cm.updateLocks[name] = &sync.Mutex{}
		return
	}
	cm.updateLocks[name] = lock
}

// Get 获取指定配置模块
func (cm *ConfigManager) Get(name string) interface{} {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()
	return cm.configs[name]
}

// LoadFromDB 从数据库加载配置
func (cm *ConfigManager) LoadFromDB(options map[string]string) error {
	var hooks []func()
	var modules []struct {
		configModuleSnapshot
		configMap map[string]string
	}

	func() {
		cm.mutex.Lock()
		defer cm.mutex.Unlock()

		for name, config := range cm.configs {
			prefix := name + "."
			configMap := make(map[string]string)

			// 收集属于此配置的所有选项
			for key, value := range options {
				if strings.HasPrefix(key, prefix) {
					configKey := strings.TrimPrefix(key, prefix)
					configMap[configKey] = value
				}
			}

			// 如果找到配置项，则更新配置
			if len(configMap) > 0 {
				modules = append(modules, struct {
					configModuleSnapshot
					configMap map[string]string
				}{
					configModuleSnapshot: configModuleSnapshot{
						name:   name,
						config: config,
						hook:   cm.updateHooks[name],
						lock:   cm.updateLocks[name],
					},
					configMap: configMap,
				})
			}
		}
	}()

	for _, module := range modules {
		err := func() error {
			unlock := lockConfig(module.lock)
			defer unlock()
			return updateConfigFromMap(module.config, module.configMap)
		}()
		if err != nil {
			common.SysError("failed to update config " + module.name + ": " + err.Error())
			continue
		}
		if module.hook != nil {
			hooks = append(hooks, module.hook)
		}
	}

	for _, hook := range hooks {
		func(hook func()) {
			defer func() {
				if r := recover(); r != nil {
					common.SysError("config update hook panic")
				}
			}()
			hook()
		}(hook)
	}

	return nil
}

// SaveToDB 将配置保存到数据库
func (cm *ConfigManager) SaveToDB(updateFunc func(key, value string) error) error {
	modules := cm.moduleSnapshots()

	for _, module := range modules {
		configMap, err := func() (map[string]string, error) {
			unlock := lockConfig(module.lock)
			defer unlock()
			return configToMap(module.config)
		}()
		if err != nil {
			return err
		}

		for key, value := range configMap {
			dbKey := module.name + "." + key
			if err := updateFunc(dbKey, value); err != nil {
				return err
			}
		}
	}

	return nil
}

func (cm *ConfigManager) moduleSnapshots() []configModuleSnapshot {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()

	modules := make([]configModuleSnapshot, 0, len(cm.configs))
	for name, config := range cm.configs {
		modules = append(modules, configModuleSnapshot{
			name:   name,
			config: config,
			hook:   cm.updateHooks[name],
			lock:   cm.updateLocks[name],
		})
	}
	return modules
}

func lockConfig(lock sync.Locker) func() {
	if lock == nil {
		return func() {}
	}
	lock.Lock()
	return lock.Unlock
}

// 辅助函数：将配置对象转换为map
func configToMap(config interface{}) (map[string]string, error) {
	result := make(map[string]string)

	val := reflect.ValueOf(config)
	if val.Kind() == reflect.Ptr {
		val = val.Elem()
	}

	if val.Kind() != reflect.Struct {
		return nil, nil
	}

	typ := val.Type()
	for i := 0; i < val.NumField(); i++ {
		field := val.Field(i)
		fieldType := typ.Field(i)

		// 跳过未导出字段
		if !fieldType.IsExported() {
			continue
		}

		// 获取json标签作为键名
		key := fieldType.Tag.Get("json")
		if key == "" || key == "-" {
			key = fieldType.Name
		}

		// 处理不同类型的字段
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
		case reflect.Ptr:
			// 处理指针类型：如果非 nil，序列化指向的值
			if !field.IsNil() {
				bytes, err := common.Marshal(field.Interface())
				if err != nil {
					return nil, err
				}
				strValue = string(bytes)
			} else {
				// nil 指针序列化为 "null"
				strValue = "null"
			}
		case reflect.Map, reflect.Slice, reflect.Struct:
			// 复杂类型使用JSON序列化
			bytes, err := common.Marshal(field.Interface())
			if err != nil {
				return nil, err
			}
			strValue = string(bytes)
		default:
			// 跳过不支持的类型
			continue
		}

		result[key] = strValue
	}

	return result, nil
}

// 辅助函数：从map更新配置对象
func updateConfigFromMap(config interface{}, configMap map[string]string) error {
	val := reflect.ValueOf(config)
	if val.Kind() != reflect.Ptr {
		return nil
	}
	val = val.Elem()

	if val.Kind() != reflect.Struct {
		return nil
	}

	typ := val.Type()
	commit := make([]func() error, 0, len(configMap))
	for i := 0; i < val.NumField(); i++ {
		field := val.Field(i)
		fieldType := typ.Field(i)

		// 跳过未导出字段
		if !fieldType.IsExported() {
			continue
		}

		// 获取json标签作为键名
		key := fieldType.Tag.Get("json")
		if key == "" || key == "-" {
			key = fieldType.Name
		}

		// 检查map中是否有对应的值
		strValue, ok := configMap[key]
		if !ok {
			continue
		}

		// 根据字段类型设置值
		if !field.CanSet() {
			continue
		}

		switch field.Kind() {
		case reflect.String:
			commit = append(commit, func() error {
				field.SetString(strValue)
				return nil
			})
		case reflect.Bool:
			boolValue, err := strconv.ParseBool(strValue)
			if err != nil {
				continue
			}
			commit = append(commit, func() error {
				field.SetBool(boolValue)
				return nil
			})
		case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
			intValue, err := strconv.ParseInt(strValue, 10, 64)
			if err != nil {
				// 兼容 float 格式的字符串（如 "2.000000"）
				floatValue, fErr := strconv.ParseFloat(strValue, 64)
				if fErr != nil {
					continue
				}
				intValue = int64(floatValue)
			}
			commit = append(commit, func() error {
				field.SetInt(intValue)
				return nil
			})
		case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
			uintValue, err := strconv.ParseUint(strValue, 10, 64)
			if err != nil {
				// 兼容 float 格式的字符串
				floatValue, fErr := strconv.ParseFloat(strValue, 64)
				if fErr != nil || floatValue < 0 {
					continue
				}
				uintValue = uint64(floatValue)
			}
			commit = append(commit, func() error {
				field.SetUint(uintValue)
				return nil
			})
		case reflect.Float32, reflect.Float64:
			floatValue, err := strconv.ParseFloat(strValue, 64)
			if err != nil {
				continue
			}
			commit = append(commit, func() error {
				field.SetFloat(floatValue)
				return nil
			})
		case reflect.Ptr:
			// 处理指针类型
			if strValue == "null" {
				commit = append(commit, func() error {
					field.Set(reflect.Zero(field.Type()))
					return nil
				})
			} else {
				raw := []byte(strValue)
				if field.IsNil() {
					fresh := reflect.New(field.Type().Elem())
					if err := common.Unmarshal(raw, fresh.Interface()); err != nil {
						return fmt.Errorf("failed to parse JSON config field %s: %w", key, err)
					}
					commit = append(commit, func() error {
						field.Set(fresh)
						return nil
					})
					continue
				}

				fresh := reflect.New(field.Type().Elem())
				backup, err := common.Marshal(field.Interface())
				if err != nil {
					return fmt.Errorf("failed to backup JSON config field %s: %w", key, err)
				}
				if err := common.Unmarshal(backup, fresh.Interface()); err != nil {
					return fmt.Errorf("failed to backup JSON config field %s: %w", key, err)
				}
				if err := common.Unmarshal(raw, fresh.Interface()); err != nil {
					return fmt.Errorf("failed to parse JSON config field %s: %w", key, err)
				}
				commit = append(commit, func() error {
					if err := common.Unmarshal(raw, field.Interface()); err != nil {
						return fmt.Errorf("failed to commit JSON config field %s: %w", key, err)
					}
					return nil
				})
			}
		case reflect.Map:
			// json.Unmarshal merges into existing maps (keeps old keys that are
			// absent from the new JSON). Allocate a fresh map so removed keys
			// are properly cleared.
			fresh := reflect.New(field.Type())
			if err := common.Unmarshal([]byte(strValue), fresh.Interface()); err != nil {
				return fmt.Errorf("failed to parse JSON config field %s: %w", key, err)
			}
			commit = append(commit, func() error {
				field.Set(fresh.Elem())
				return nil
			})
		case reflect.Slice:
			fresh := reflect.New(field.Type())
			if err := common.Unmarshal([]byte(strValue), fresh.Interface()); err != nil {
				return fmt.Errorf("failed to parse JSON config field %s: %w", key, err)
			}
			commit = append(commit, func() error {
				field.Set(fresh.Elem())
				return nil
			})
		case reflect.Struct:
			fresh := reflect.New(field.Type())
			fresh.Elem().Set(field)
			if err := common.Unmarshal([]byte(strValue), fresh.Interface()); err != nil {
				return fmt.Errorf("failed to parse JSON config field %s: %w", key, err)
			}
			commit = append(commit, func() error {
				field.Set(fresh.Elem())
				return nil
			})
		}
	}

	for _, fn := range commit {
		if err := fn(); err != nil {
			return err
		}
	}
	return nil
}

// ConfigToMap 将配置对象转换为map（导出函数）
func ConfigToMap(config interface{}) (map[string]string, error) {
	return configToMap(config)
}

// UpdateConfigFromMap 从map更新配置对象（导出函数）
func UpdateConfigFromMap(config interface{}, configMap map[string]string) error {
	return updateConfigFromMap(config, configMap)
}

// ExportAllConfigs 导出所有已注册的配置为扁平结构
func (cm *ConfigManager) ExportAllConfigs() map[string]string {
	modules := cm.moduleSnapshots()
	result := make(map[string]string)

	for _, module := range modules {
		configMap, err := func() (map[string]string, error) {
			unlock := lockConfig(module.lock)
			defer unlock()
			return ConfigToMap(module.config)
		}()
		if err != nil {
			continue
		}

		// 使用 "模块名.配置项" 的格式添加到结果中
		for key, value := range configMap {
			result[module.name+"."+key] = value
		}
	}

	return result
}
