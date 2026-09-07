package main

import (
	"fmt"
	"sort"
	"strings"
)

// validationIssue — one finding from validateSpec. Severity controls whether
// the run prints WARN (continues) or ERROR (returns non-nil error).
type validationIssue struct {
	Path     string
	Method   string
	Code     string
	Message  string
	Severity string // "error" | "warn"
}

// validateSpec scans the generated paths + components for known broken patterns:
//   - POST/PUT/PATCH endpoints with placeholder body schema
//   - dangling $refs (handled in main.go separately for components)
//   - response schemas that look like the inline placeholder template
//   - operations with no responses["200"]
//
// Returns ([]issues, hasErrors). Caller decides whether to fail the run.
func validateSpec(paths, components map[string]interface{}) ([]validationIssue, bool) {
	issues := []validationIssue{}
	schemas, _ := components["schemas"].(map[string]interface{})

	pathKeys := make([]string, 0, len(paths))
	for k := range paths {
		pathKeys = append(pathKeys, k)
	}
	sort.Strings(pathKeys)

	for _, path := range pathKeys {
		methods, _ := paths[path].(map[string]interface{})
		if methods == nil {
			continue
		}
		methodKeys := make([]string, 0, len(methods))
		for m := range methods {
			methodKeys = append(methodKeys, m)
		}
		sort.Strings(methodKeys)
		for _, method := range methodKeys {
			op, _ := methods[method].(map[string]interface{})
			if op == nil {
				continue
			}
			issues = append(issues, validateOperation(path, method, op, schemas)...)
		}
	}

	hasErr := false
	for _, i := range issues {
		if i.Severity == "error" {
			hasErr = true
			break
		}
	}
	return issues, hasErr
}

func validateOperation(path, method string, op map[string]interface{}, schemas map[string]interface{}) []validationIssue {
	out := []validationIssue{}

	// --- requestBody checks: only POST/PUT/PATCH ---
	if method == "post" || method == "put" || method == "patch" {
		if body, ok := op["requestBody"].(map[string]interface{}); ok {
			if schema := extractBodySchema(body); schema != nil {
				if _, hasRef := schema["$ref"]; !hasRef {
					if isPlaceholderSchema(schema) {
						out = append(out, validationIssue{
							Path: path, Method: method, Code: "BODY_PLACEHOLDER",
							Message:  "requestBody is a placeholder template — declare a named DTO or fix the controller signature",
							Severity: "error",
						})
					}
				} else if ref, _ := schema["$ref"].(string); ref != "" {
					if name := refName(ref); name != "" && schemas != nil {
						if _, ok := schemas[name]; !ok {
							out = append(out, validationIssue{
								Path: path, Method: method, Code: "BODY_DANGLING_REF",
								Message:  fmt.Sprintf("requestBody $ref %q not in components.schemas", name),
								Severity: "error",
							})
						}
					}
				}
			}
		}
	}

	// --- response checks: every operation must have responses["200"] ---
	resp, _ := op["responses"].(map[string]interface{})
	if resp == nil {
		out = append(out, validationIssue{
			Path: path, Method: method, Code: "RESP_MISSING",
			Message:  "operation has no responses block",
			Severity: "error",
		})
		return out
	}
	r200, _ := resp["200"].(map[string]interface{})
	if r200 == nil {
		for status, response := range resp {
			if strings.HasPrefix(status, "2") {
				r200, _ = response.(map[string]interface{})
				break
			}
		}
	}
	if r200 == nil {
		out = append(out, validationIssue{
			Path: path, Method: method, Code: "RESP_NO_SUCCESS",
			Message:  "operation has no successful response",
			Severity: "warn",
		})
		return out
	}
	if schema := extractContentSchema(r200); schema != nil {
		if _, hasRef := schema["$ref"]; !hasRef && isPlaceholderSchema(schema) {
			out = append(out, validationIssue{
				Path: path, Method: method, Code: "RESP_PLACEHOLDER",
				Message:  "response 200 schema is a placeholder template",
				Severity: "warn",
			})
		}
	}
	return out
}

func extractBodySchema(body map[string]interface{}) map[string]interface{} {
	content, _ := body["content"].(map[string]interface{})
	if content == nil {
		return nil
	}
	js, _ := content["application/json"].(map[string]interface{})
	if js == nil {
		return nil
	}
	schema, _ := js["schema"].(map[string]interface{})
	return schema
}

func extractContentSchema(node map[string]interface{}) map[string]interface{} {
	content, _ := node["content"].(map[string]interface{})
	if content == nil {
		return nil
	}
	js, _ := content["application/json"].(map[string]interface{})
	if js == nil {
		return nil
	}
	schema, _ := js["schema"].(map[string]interface{})
	return schema
}

func refName(ref string) string {
	const prefix = "#/components/schemas/"
	if !strings.HasPrefix(ref, prefix) {
		return ""
	}
	return ref[len(prefix):]
}

// printIssues writes issues grouped by severity. Returns count of errors.
func printIssues(issues []validationIssue) int {
	if len(issues) == 0 {
		return 0
	}
	errs := 0
	warns := 0
	for _, i := range issues {
		if i.Severity == "error" {
			errs++
		} else {
			warns++
		}
	}
	fmt.Printf("    validation: %d errors, %d warnings\n", errs, warns)
	for _, i := range issues {
		tag := "WARN"
		if i.Severity == "error" {
			tag = "ERROR"
		}
		fmt.Printf("     [%s] %s %s %s — %s\n", tag, i.Code, strings.ToUpper(i.Method), i.Path, i.Message)
	}
	return errs
}
