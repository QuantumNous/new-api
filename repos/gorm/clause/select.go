package clause

// Select select attrs when querying, updating, creating
type Select struct {
	Distinct   bool
	Columns    []Column
	Expression Expression
}

func (s Select) Name() string {
	return "SELECT"
}

func (s Select) Build(builder Builder) {
	if len(s.Columns) > 0 {
		if s.Distinct {
			builder.WriteString("DISTINCT ")
		}

		for idx, column := range s.Columns {
			if idx > 0 {
				builder.WriteByte(',')
			}
			builder.WriteQuoted(column)
		}
	} else {
		builder.WriteByte('*')
	}
}

func (s Select) MergeClause(clause *Clause) {
	if s.Expression != nil {
		if s.Distinct {
			if expr, ok := s.Expression.(Expr); ok {
				expr.SQL = "DISTINCT " + expr.SQL
				clause.Expression = expr
				return
			}
		}

		clause.Expression = s.Expression
	} else {
		clause.Expression = s
	}
}

// CommaExpression represents a group of expressions separated by commas.
type CommaExpression struct {
	Exprs []Expression
}

func (comma CommaExpression) Build(builder Builder) {
	for idx, expr := range comma.Exprs {
		if idx > 0 {
			_, _ = builder.WriteString(", ")
		}
		expr.Build(builder)
	}
}
