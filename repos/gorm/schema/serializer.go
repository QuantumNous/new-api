package schema

import (
	"bytes"
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/gob"
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
	"sync"
	"time"
)

var serializerMap = sync.Map{}

// RegisterSerializer register serializer
func RegisterSerializer(name string, serializer SerializerInterface) {
	serializerMap.Store(strings.ToLower(name), serializer)
}

// GetSerializer get serializer
func GetSerializer(name string) (serializer SerializerInterface, ok bool) {
	v, ok := serializerMap.Load(strings.ToLower(name))
	if ok {
		serializer, ok = v.(SerializerInterface)
	}
	return serializer, ok
}

func init() {
	RegisterSerializer("json", JSONSerializer{})
	RegisterSerializer("unixtime", UnixSecondSerializer{})
	RegisterSerializer("gob", GobSerializer{})
}

// Serializer field value serializer
type serializer struct {
	Field           *Field
	Serializer      SerializerInterface
	SerializeValuer SerializerValuerInterface
	Destination     reflect.Value
	Context         context.Context
	value           interface{}
	fieldValue      interface{}
}

// Scan implements sql.Scanner interface
func (s *serializer) Scan(value interface{}) error {
	s.value = value
	return nil
}

// Value implements driver.Valuer interface
func (s serializer) Value() (driver.Value, error) {
	return s.SerializeValuer.Value(s.Context, s.Field, s.Destination, s.fieldValue)
}

// SerializerInterface serializer interface
type SerializerInterface interface {
	Scan(ctx context.Context, field *Field, dst reflect.Value, dbValue interface{}) error
	SerializerValuerInterface
}

// SerializerValuerInterface serializer valuer interface
type SerializerValuerInterface interface {
	Value(ctx context.Context, field *Field, dst reflect.Value, fieldValue interface{}) (interface{}, error)
}

// JSONSerializer json serializer
type JSONSerializer struct{}

// Scan implements serializer interface
func (JSONSerializer) Scan(ctx context.Context, field *Field, dst reflect.Value, dbValue interface{}) (err error) {
	fieldValue := reflect.New(field.FieldType)

	if dbValue != nil {
		var bytes []byte
		switch v := dbValue.(type) {
		case []byte:
			bytes = v
		case string:
			bytes = []byte(v)
		default:
			return fmt.Errorf("failed to unmarshal JSONB value: %#v", dbValue)
		}

		if len(bytes) > 0 {
			err = json.Unmarshal(bytes, fieldValue.Interface())
		}
	}

	field.ReflectValueOf(ctx, dst).Set(fieldValue.Elem())
	return
}

// Value implements serializer interface
func (JSONSerializer) Value(ctx context.Context, field *Field, dst reflect.Value, fieldValue interface{}) (interface{}, error) {
	result, err := json.Marshal(fieldValue)
	if string(result) == "null" {
		if field.TagSettings["NOT NULL"] != "" {
			return "", nil
		}
		return nil, err
	}
	return string(result), err
}

// UnixSecondSerializer json serializer
type UnixSecondSerializer struct{}

// Scan implements serializer interface
func (UnixSecondSerializer) Scan(ctx context.Context, field *Field, dst reflect.Value, dbValue interface{}) (err error) {
	t := sql.NullTime{}
	if err = t.Scan(dbValue); err == nil && t.Valid {
		err = field.Set(ctx, dst, t.Time.Unix())
	}

	return
}

// Value implements serializer interface
func (UnixSecondSerializer) Value(ctx context.Context, field *Field, dst reflect.Value, fieldValue interface{}) (result interface{}, err error) {
	rv := reflect.ValueOf(fieldValue)
	switch v := fieldValue.(type) {
	case int64, int, uint, uint64, int32, uint32, int16, uint16:
		result = time.Unix(reflect.Indirect(rv).Int(), 0)
	case *int64, *int, *uint, *uint64, *int32, *uint32, *int16, *uint16:
		if rv.IsZero() {
			return nil, nil
		}
		result = time.Unix(reflect.Indirect(rv).Int(), 0)
	default:
		err = fmt.Errorf("invalid field type %#v for UnixSecondSerializer, only int, uint supported", v)
	}
	return
}

// GobSerializer gob serializer
type GobSerializer struct{}

// Scan implements serializer interface
func (GobSerializer) Scan(ctx context.Context, field *Field, dst reflect.Value, dbValue interface{}) (err error) {
	fieldValue := reflect.New(field.FieldType)

	if dbValue != nil {
		var bytesValue []byte
		switch v := dbValue.(type) {
		case []byte:
			bytesValue = v
		default:
			return fmt.Errorf("failed to unmarshal gob value: %#v", dbValue)
		}
		if len(bytesValue) > 0 {
			decoder := gob.NewDecoder(bytes.NewBuffer(bytesValue))
			err = decoder.Decode(fieldValue.Interface())
		}
	}
	field.ReflectValueOf(ctx, dst).Set(fieldValue.Elem())
	return
}

// Value implements serializer interface
func (GobSerializer) Value(ctx context.Context, field *Field, dst reflect.Value, fieldValue interface{}) (interface{}, error) {
	buf := new(bytes.Buffer)
	err := gob.NewEncoder(buf).Encode(fieldValue)
	return buf.Bytes(), err
}
