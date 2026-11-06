package clause

import "strconv"

// Limit limit clause
type Limit struct {
	Limit  *int
	Offset int
}

// Name where clause name
func (limit Limit) Name() string {
	return "LIMIT"
}

// Build build where clause
func (limit Limit) Build(builder Builder) {
	if limit.Limit != nil && *limit.Limit >= 0 {
		builder.WriteString("LIMIT ")
		builder.WriteString(strconv.Itoa(*limit.Limit))
	}
	if limit.Offset > 0 {
		if limit.Limit != nil && *limit.Limit >= 0 {
			builder.WriteByte(' ')
		}
		builder.WriteString("OFFSET ")
		builder.WriteString(strconv.Itoa(limit.Offset))
	}
}

// MergeClause merge order by clauses
func (limit Limit) MergeClause(clause *Clause) {
	clause.Name = ""

	if v, ok := clause.Expression.(Limit); ok {
		if (limit.Limit == nil || *limit.Limit == 0) && v.Limit != nil {
			limit.Limit = v.Limit
		}

		if limit.Offset == 0 && v.Offset > 0 {
			limit.Offset = v.Offset
		} else if limit.Offset < 0 {
			limit.Offset = 0
		}
	}

	clause.Expression = limit
}
