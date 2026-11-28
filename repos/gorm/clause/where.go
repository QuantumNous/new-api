package clause

import (
	"strings"
)

const (
	AndWithSpace = " AND "
	OrWithSpace  = " OR "
)

// Where where clause
type Where struct {
	Exprs []Expression
}

// Name where clause name
func (where Where) Name() string {
	return "WHERE"
}

// Build build where clause
func (where Where) Build(builder Builder) {
	// Switch position if the first query expression is a single Or condition
	for idx, expr := range where.Exprs {
		if v, ok := expr.(OrConditions); !ok || len(v.Exprs) > 1 {
			if idx != 0 {
				where.Exprs[0], where.Exprs[idx] = where.Exprs[idx], where.Exprs[0]
			}
			break
		}
	}

	buildExprs(where.Exprs, builder, AndWithSpace)
}

func buildExprs(exprs []Expression, builder Builder, joinCond string) {
	wrapInParentheses := false

	for idx, expr := range exprs {
		if idx > 0 {
			if v, ok := expr.(OrConditions); ok && len(v.Exprs) == 1 {
				builder.WriteString(OrWithSpace)
			} else {
				builder.WriteString(joinCond)
			}
		}

		if len(exprs) > 1 {
			switch v := expr.(type) {
			case OrConditions:
				if len(v.Exprs) == 1 {
					if e, ok := v.Exprs[0].(Expr); ok {
						sql := strings.ToUpper(e.SQL)
						wrapInParentheses = strings.Contains(sql, AndWithSpace) || strings.Contains(sql, OrWithSpace)
					}
				}
			case AndConditions:
				if len(v.Exprs) == 1 {
					if e, ok := v.Exprs[0].(Expr); ok {
						sql := strings.ToUpper(e.SQL)
						wrapInParentheses = strings.Contains(sql, AndWithSpace) || strings.Contains(sql, OrWithSpace)
					}
				}
			case Expr:
				sql := strings.ToUpper(v.SQL)
				wrapInParentheses = strings.Contains(sql, AndWithSpace) || strings.Contains(sql, OrWithSpace)
			case NamedExpr:
				sql := strings.ToUpper(v.SQL)
				wrapInParentheses = strings.Contains(sql, AndWithSpace) || strings.Contains(sql, OrWithSpace)
			}
		}

		if wrapInParentheses {
			builder.WriteByte('(')
			expr.Build(builder)
			builder.WriteByte(')')
			wrapInParentheses = false
		} else {
			expr.Build(builder)
		}
	}
}

// MergeClause merge where clauses
func (where Where) MergeClause(clause *Clause) {
	if w, ok := clause.Expression.(Where); ok {
		exprs := make([]Expression, len(w.Exprs)+len(where.Exprs))
		copy(exprs, w.Exprs)
		copy(exprs[len(w.Exprs):], where.Exprs)
		where.Exprs = exprs
	}

	clause.Expression = where
}

func And(exprs ...Expression) Expression {
	if len(exprs) == 0 {
		return nil
	}

	if len(exprs) == 1 {
		if _, ok := exprs[0].(OrConditions); !ok {
			return exprs[0]
		}
	}

	return AndConditions{Exprs: exprs}
}

type AndConditions struct {
	Exprs []Expression
}

func (and AndConditions) Build(builder Builder) {
	if len(and.Exprs) > 1 {
		builder.WriteByte('(')
		buildExprs(and.Exprs, builder, AndWithSpace)
		builder.WriteByte(')')
	} else {
		buildExprs(and.Exprs, builder, AndWithSpace)
	}
}

func Or(exprs ...Expression) Expression {
	if len(exprs) == 0 {
		return nil
	}
	return OrConditions{Exprs: exprs}
}

type OrConditions struct {
	Exprs []Expression
}

func (or OrConditions) Build(builder Builder) {
	if len(or.Exprs) > 1 {
		builder.WriteByte('(')
		buildExprs(or.Exprs, builder, OrWithSpace)
		builder.WriteByte(')')
	} else {
		buildExprs(or.Exprs, builder, OrWithSpace)
	}
}

func Not(exprs ...Expression) Expression {
	if len(exprs) == 0 {
		return nil
	}
	return NotConditions{Exprs: exprs}
}

type NotConditions struct {
	Exprs []Expression
}

func (not NotConditions) Build(builder Builder) {
	if len(not.Exprs) > 1 {
		builder.WriteByte('(')
	}

	for idx, c := range not.Exprs {
		if idx > 0 {
			builder.WriteString(AndWithSpace)
		}

		if negationBuilder, ok := c.(NegationExpressionBuilder); ok {
			negationBuilder.NegationBuild(builder)
		} else {
			builder.WriteString("NOT ")
			e, wrapInParentheses := c.(Expr)
			if wrapInParentheses {
				sql := strings.ToUpper(e.SQL)
				if wrapInParentheses = strings.Contains(sql, AndWithSpace) || strings.Contains(sql, OrWithSpace); wrapInParentheses {
					builder.WriteByte('(')
				}
			}

			c.Build(builder)

			if wrapInParentheses {
				builder.WriteByte(')')
			}
		}
	}

	if len(not.Exprs) > 1 {
		builder.WriteByte(')')
	}
}
