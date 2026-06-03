package cost_report

import (
	"fmt"
	"math"
	"sort"
	"strings"

	"github.com/expr-lang/expr"
	"github.com/expr-lang/expr/vm"
)

type formulaProgram struct {
	field   FieldConfig
	program *vm.Program
	initial *vm.Program
}

type formulaEvaluator struct {
	programs        []formulaProgram
	fieldsByKey     map[string]FieldConfig
	partitionFields []string
}

func newFormulaEvaluator(config CostReportTemplateConfig) (*formulaEvaluator, error) {
	fieldsByKey := make(map[string]FieldConfig, len(config.Fields))
	for _, field := range config.Fields {
		fieldsByKey[field.Key] = field
	}
	env := formulaCompileEnv(fieldsByKey)
	ordered, err := formulaEvaluationOrder(config.Fields, fieldsByKey)
	if err != nil {
		return nil, err
	}

	programs := make([]formulaProgram, 0, len(ordered))
	for _, field := range ordered {
		prog, err := expr.Compile(field.Expression, expr.Env(env), expr.AsFloat64())
		if err != nil {
			return nil, fmt.Errorf("formula %q compile failed: %w", field.Key, err)
		}
		fp := formulaProgram{field: field, program: prog}
		if field.InitialExpression != "" {
			initial, err := expr.Compile(field.InitialExpression, expr.Env(env), expr.AsFloat64())
			if err != nil {
				return nil, fmt.Errorf("formula %q initial compile failed: %w", field.Key, err)
			}
			fp.initial = initial
		}
		programs = append(programs, fp)
	}
	return &formulaEvaluator{programs: programs, fieldsByKey: fieldsByKey, partitionFields: defaultRunningPartitionFields(config.Grouping)}, nil
}

func formulaCompileEnv(fields map[string]FieldConfig) map[string]interface{} {
	env := make(map[string]interface{}, len(fields)*2+5)
	for key := range fields {
		env[key] = float64(0)
		env["previous_"+key] = float64(0)
	}
	env["max"] = math.Max
	env["min"] = math.Min
	env["abs"] = math.Abs
	env["ceil"] = math.Ceil
	env["floor"] = math.Floor
	return env
}

func formulaEvaluationOrder(fields []FieldConfig, fieldsByKey map[string]FieldConfig) ([]FieldConfig, error) {
	byKey := map[string]FieldConfig{}
	deps := map[string][]string{}
	for _, field := range fields {
		if field.Kind != FieldKindFormula {
			continue
		}
		byKey[field.Key] = field
		exprs := []string{field.Expression}
		if field.InitialExpression != "" {
			exprs = append(exprs, field.InitialExpression)
		}
		seen := map[string]bool{}
		for _, expression := range exprs {
			prog, err := expr.Compile(expression, expr.Env(formulaCompileEnv(fieldsByKey)), expr.AsFloat64())
			if err != nil {
				return nil, fmt.Errorf("formula %q compile failed: %w", field.Key, err)
			}
			for ref, usage := range formulaRefs(prog.Node(), fieldsByKey) {
				if usage.Direct && fieldsByKey[ref].Kind == FieldKindFormula && ref != field.Key && !seen[ref] {
					deps[field.Key] = append(deps[field.Key], ref)
					seen[ref] = true
				}
			}
		}
	}

	visiting := map[string]bool{}
	visited := map[string]bool{}
	ordered := make([]FieldConfig, 0, len(byKey))
	var visit func(string) error
	visit = func(key string) error {
		if visiting[key] {
			return fmt.Errorf("formula dependency cycle detected at %q", key)
		}
		if visited[key] {
			return nil
		}
		visiting[key] = true
		depKeys := append([]string(nil), deps[key]...)
		sort.Strings(depKeys)
		for _, dep := range depKeys {
			if err := visit(dep); err != nil {
				return err
			}
		}
		visiting[key] = false
		visited[key] = true
		ordered = append(ordered, byKey[key])
		return nil
	}

	fieldOrder := append([]FieldConfig(nil), fields...)
	sort.SliceStable(fieldOrder, func(i, j int) bool { return fieldOrder[i].Order < fieldOrder[j].Order })
	for _, field := range fieldOrder {
		if field.Kind != FieldKindFormula {
			continue
		}
		if err := visit(field.Key); err != nil {
			return nil, err
		}
	}
	return ordered, nil
}

func (e *formulaEvaluator) evaluateRows(rows []PreviewRow) []string {
	if e == nil {
		return nil
	}
	warnings := []string{}
	previousByPartition := map[string]map[string]float64{}
	for rowIndex := range rows {
		partition := runningPartitionKey(rows[rowIndex], e.partitionFields)
		previousByField := previousByPartition[partition]
		if previousByField == nil {
			previousByField = map[string]float64{}
			previousByPartition[partition] = previousByField
		}
		for _, fp := range e.programs {
			_, hasPreviousForField := previousByField[fp.field.Key]
			if rows[rowIndex].ManualOverrides[fp.field.Key] {
				previousByField[fp.field.Key] = toFloat64(rows[rowIndex].Values[fp.field.Key])
				continue
			}

			env := formulaCompileEnv(e.fieldsByKey)
			for key, value := range rows[rowIndex].Values {
				env[key] = toFloat64(value)
			}
			for key, value := range previousByField {
				env["previous_"+key] = value
			}

			prog := fp.program
			if fp.field.FormulaMode == FormulaModeRunning && !hasPreviousForField && fp.initial != nil {
				prog = fp.initial
			}
			out, err := expr.Run(prog, env)
			if err != nil {
				warnings = append(warnings, fmt.Sprintf("row %q formula %q failed: %v", rows[rowIndex].RowKey, fp.field.Key, err))
				rows[rowIndex].FormulaValues[fp.field.Key] = float64(0)
				rows[rowIndex].Values[fp.field.Key] = float64(0)
				previousByField[fp.field.Key] = 0
				continue
			}
			value, ok := out.(float64)
			if !ok || math.IsNaN(value) || math.IsInf(value, 0) {
				warnings = append(warnings, fmt.Sprintf("row %q formula %q produced non-finite value", rows[rowIndex].RowKey, fp.field.Key))
				value = 0
			}
			rows[rowIndex].FormulaValues[fp.field.Key] = value
			rows[rowIndex].Values[fp.field.Key] = value
			previousByField[fp.field.Key] = value
		}
	}
	return warnings
}

func defaultRunningPartitionFields(grouping []string) []string {
	fields := make([]string, 0, len(grouping))
	for _, key := range grouping {
		switch key {
		case "row_index", "report_date":
			continue
		default:
			fields = append(fields, key)
		}
	}
	return fields
}

func runningPartitionKey(row PreviewRow, fields []string) string {
	if len(fields) == 0 {
		return ""
	}
	parts := make([]string, 0, len(fields))
	for _, field := range fields {
		parts = append(parts, field+"="+valueToString(row.Values[field]))
	}
	return strings.Join(parts, "|")
}
