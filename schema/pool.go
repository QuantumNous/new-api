package schema

import (
	"reflect"
	"sync"
)

// sync pools
var (
	normalPool      sync.Map
	poolInitializer = func(reflectType reflect.Type) FieldNewValuePool {
		v, _ := normalPool.LoadOrStore(reflectType, &sync.Pool{
			New: func() interface{} {
				return reflect.New(reflectType).Interface()
			},
		})
		return v.(FieldNewValuePool)
	}
)
