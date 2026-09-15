package schema

import (
	"regexp"
	"strings"
)

// reg match english letters and midline
var regEnLetterAndMidline = regexp.MustCompile("^[A-Za-z-_]+$")

type Check struct {
	Name       string
	Constraint string // length(phone) >= 10
	*Field
}

// ParseCheckConstraints parse schema check constraints
func (schema *Schema) ParseCheckConstraints() map[string]Check {
	checks := map[string]Check{}
	for _, field := range schema.FieldsByDBName {
		if chk := field.TagSettings["CHECK"]; chk != "" {
			names := strings.Split(chk, ",")
			if len(names) > 1 && regEnLetterAndMidline.MatchString(names[0]) {
				checks[names[0]] = Check{Name: names[0], Constraint: strings.Join(names[1:], ","), Field: field}
			} else {
				if names[0] == "" {
					chk = strings.Join(names[1:], ",")
				}
				name := schema.namer.CheckerName(schema.Table, field.DBName)
				checks[name] = Check{Name: name, Constraint: chk, Field: field}
			}
		}
	}
	return checks
}
