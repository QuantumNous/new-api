package clause

import (
	"database/sql"
	"database/sql/driver"
	"go/ast"
	"reflect"
)

// Expression expression interface
type Expression interface {
	Build(builder Builder)
}

// NegationExpressionBuilder negation expression builder
type NegationExpressionBuilder interface {
	NegationBuild(builder Builder)
}

// Expr raw expression
type Expr struct {
	SQL                string
	Vars               []interface{}
	WithoutParentheses bool
}

// Build build raw expression
func (expr Expr) Build(builder Builder) {
	var (
		afterParenthesis bool
		idx              int
	)

	for _, v := range []byte(expr.SQL) {
		if v == '?' && len(expr.Vars) > idx {
			if afterParenthesis || expr.WithoutParentheses {
				if _, ok := expr.Vars[idx].(driver.Valuer); ok {
					builder.AddVar(builder, expr.Vars[idx])
				} else {
					switch rv := reflect.ValueOf(expr.Vars[idx]); rv.Kind() {
					case reflect.Slice, reflect.Array:
						if rv.Len() == 0 {
							builder.AddVar(builder, nil)
						} else {
							for i := 0; i < rv.Len(); i++ {
								if i > 0 {
									builder.WriteByte(',')
								}
								builder.AddVar(builder, rv.Index(i).Interface())
							}
						}
					default:
						builder.AddVar(builder, expr.Vars[idx])
					}
				}
			} else {
				builder.AddVar(builder, expr.Vars[idx])
			}

			idx++
		} else {
			if v == '(' {
				afterParenthesis = true
			} else {
				afterParenthesis = false
			}
			builder.WriteByte(v)
		}
	}

	if idx < len(expr.Vars) {
		for _, v := range expr.Vars[idx:] {
			builder.AddVar(builder, sql.NamedArg{Value: v})
		}
	}
}

// NamedExpr raw expression for named expr
type NamedExpr struct {
	SQL  string
	Vars []interface{}
}

// Build build raw expression
func (expr NamedExpr) Build(builder Builder) {
	var (
		idx              int
		inName           bool
		afterParenthesis bool
		namedMap         = make(map[string]interface{}, len(expr.Vars))
	)

	for _, v := range expr.Vars {
		switch value := v.(type) {
		case sql.NamedArg:
			namedMap[value.Name] = value.Value
		case map[string]interface{}:
			for k, v := range value {
				namedMap[k] = v
			}
		default:
			var appendFieldsToMap func(reflect.Value)
			appendFieldsToMap = func(reflectValue reflect.Value) {
				reflectValue = reflect.Indirect(reflectValue)
				switch reflectValue.Kind() {
				case reflect.Struct:
					modelType := reflectValue.Type()
					for i := 0; i < modelType.NumField(); i++ {
						if fieldStruct := modelType.Field(i); ast.IsExported(fieldStruct.Name) {
							namedMap[fieldStruct.Name] = reflectValue.Field(i).Interface()

							if fieldStruct.Anonymous {
								appendFieldsToMap(reflectValue.Field(i))
							}
						}
					}
				}
			}

			appendFieldsToMap(reflect.ValueOf(value))
		}
	}

	name := make([]byte, 0, 10)

	for _, v := range []byte(expr.SQL) {
		if v == '@' && !inName {
			inName = true
			name = []byte{}
		} else if v == ' ' || v == ',' || v == ')' || v == '"' || v == '\'' || v == '`' || v == '\r' || v == '\n' || v == ';' {
			if inName {
				if nv, ok := namedMap[string(name)]; ok {
					builder.AddVar(builder, nv)
				} else {
					builder.WriteByte('@')
					builder.WriteString(string(name))
				}
				inName = false
			}

			afterParenthesis = false
			builder.WriteByte(v)
		} else if v == '?' && len(expr.Vars) > idx {
			if afterParenthesis {
				if _, ok := expr.Vars[idx].(driver.Valuer); ok {
					builder.AddVar(builder, expr.Vars[idx])
				} else {
					switch rv := reflect.ValueOf(expr.Vars[idx]); rv.Kind() {
					case reflect.Slice, reflect.Array:
						if rv.Len() == 0 {
							builder.AddVar(builder, nil)
						} else {
							for i := 0; i < rv.Len(); i++ {
								if i > 0 {
									builder.WriteByte(',')
								}
								builder.AddVar(builder, rv.Index(i).Interface())
							}
						}
					default:
						builder.AddVar(builder, expr.Vars[idx])
					}
				}
			} else {
				builder.AddVar(builder, expr.Vars[idx])
			}

			idx++
		} else if inName {
			name = append(name, v)
		} else {
			if v == '(' {
				afterParenthesis = true
			} else {
				afterParenthesis = false
			}
			builder.WriteByte(v)
		}
	}

	if inName {
		if nv, ok := namedMap[string(name)]; ok {
			builder.AddVar(builder, nv)
		} else {
			builder.WriteByte('@')
			builder.WriteString(string(name))
		}
	}
}

// IN Whether a value is within a set of values
type IN struct {
	Column interface{}
	Values []interface{}
}

func (in IN) Build(builder Builder) {
	builder.WriteQuoted(in.Column)

	switch len(in.Values) {
	case 0:
		builder.WriteString(" IN (NULL)")
	case 1:
		if _, ok := in.Values[0].([]interface{}); !ok {
			builder.WriteString(" = ")
			builder.AddVar(builder, in.Values[0])
			break
		}

		fallthrough
	default:
		builder.WriteString(" IN (")
		builder.AddVar(builder, in.Values...)
		builder.WriteByte(')')
	}
}

func (in IN) NegationBuild(builder Builder) {
	builder.WriteQuoted(in.Column)
	switch len(in.Values) {
	case 0:
		builder.WriteString(" IS NOT NULL")
	case 1:
		if _, ok := in.Values[0].([]interface{}); !ok {
			builder.WriteString(" <> ")
			builder.AddVar(builder, in.Values[0])
			break
		}

		fallthrough
	default:
		builder.WriteString(" NOT IN (")
		builder.AddVar(builder, in.Values...)
		builder.WriteByte(')')
	}
}

// Eq equal to for where
type Eq struct {
	Column interface{}
	Value  interface{}
}

func (eq Eq) Build(builder Builder) {
	builder.WriteQuoted(eq.Column)

	switch eq.Value.(type) {
	case []string, []int, []int32, []int64, []uint, []uint32, []uint64, []interface{}:
		builder.WriteString(" IN (")
		rv := reflect.ValueOf(eq.Value)
		for i := 0; i < rv.Len(); i++ {
			if i > 0 {
				builder.WriteByte(',')
			}
			builder.AddVar(builder, rv.Index(i).Interface())
		}
		builder.WriteByte(')')
	default:
		if eqNil(eq.Value) {
			builder.WriteString(" IS NULL")
		} else {
			builder.WriteString(" = ")
			builder.AddVar(builder, eq.Value)
		}
	}
}

func (eq Eq) NegationBuild(builder Builder) {
	Neq(eq).Build(builder)
}

// Neq not equal to for where
type Neq Eq

func (neq Neq) Build(builder Builder) {
	builder.WriteQuoted(neq.Column)

	switch neq.Value.(type) {
	case []string, []int, []int32, []int64, []uint, []uint32, []uint64, []interface{}:
		builder.WriteString(" NOT IN (")
		rv := reflect.ValueOf(neq.Value)
		for i := 0; i < rv.Len(); i++ {
			if i > 0 {
				builder.WriteByte(',')
			}
			builder.AddVar(builder, rv.Index(i).Interface())
		}
		builder.WriteByte(')')
	default:
		if eqNil(neq.Value) {
			builder.WriteString(" IS NOT NULL")
		} else {
			builder.WriteString(" <> ")
			builder.AddVar(builder, neq.Value)
		}
	}
}

func (neq Neq) NegationBuild(builder Builder) {
	Eq(neq).Build(builder)
}

// Gt greater than for where
type Gt Eq

func (gt Gt) Build(builder Builder) {
	builder.WriteQuoted(gt.Column)
	builder.WriteString(" > ")
	builder.AddVar(builder, gt.Value)
}

func (gt Gt) NegationBuild(builder Builder) {
	Lte(gt).Build(builder)
}

// Gte greater than or equal to for where
type Gte Eq

func (gte Gte) Build(builder Builder) {
	builder.WriteQuoted(gte.Column)
	builder.WriteString(" >= ")
	builder.AddVar(builder, gte.Value)
}

func (gte Gte) NegationBuild(builder Builder) {
	Lt(gte).Build(builder)
}

// Lt less than for where
type Lt Eq

func (lt Lt) Build(builder Builder) {
	builder.WriteQuoted(lt.Column)
	builder.WriteString(" < ")
	builder.AddVar(builder, lt.Value)
}

func (lt Lt) NegationBuild(builder Builder) {
	Gte(lt).Build(builder)
}

// Lte less than or equal to for where
type Lte Eq

func (lte Lte) Build(builder Builder) {
	builder.WriteQuoted(lte.Column)
	builder.WriteString(" <= ")
	builder.AddVar(builder, lte.Value)
}

func (lte Lte) NegationBuild(builder Builder) {
	Gt(lte).Build(builder)
}

// Like whether string matches regular expression
type Like Eq

func (like Like) Build(builder Builder) {
	builder.WriteQuoted(like.Column)
	builder.WriteString(" LIKE ")
	builder.AddVar(builder, like.Value)
}

func (like Like) NegationBuild(builder Builder) {
	builder.WriteQuoted(like.Column)
	builder.WriteString(" NOT LIKE ")
	builder.AddVar(builder, like.Value)
}

func eqNil(value interface{}) bool {
	if valuer, ok := value.(driver.Valuer); ok && !eqNilReflect(valuer) {
		value, _ = valuer.Value()
	}

	return value == nil || eqNilReflect(value)
}

func eqNilReflect(value interface{}) bool {
	reflectValue := reflect.ValueOf(value)
	return reflectValue.Kind() == reflect.Ptr && reflectValue.IsNil()
}
