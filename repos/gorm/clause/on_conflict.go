package clause

type OnConflict struct {
	Columns      []Column
	Where        Where
	TargetWhere  Where
	OnConstraint string
	DoNothing    bool
	DoUpdates    Set
	UpdateAll    bool
}

func (OnConflict) Name() string {
	return "ON CONFLICT"
}

// Build build onConflict clause
func (onConflict OnConflict) Build(builder Builder) {
	if onConflict.OnConstraint != "" {
		builder.WriteString("ON CONSTRAINT ")
		builder.WriteString(onConflict.OnConstraint)
		builder.WriteByte(' ')
	} else {
		if len(onConflict.Columns) > 0 {
			builder.WriteByte('(')
			for idx, column := range onConflict.Columns {
				if idx > 0 {
					builder.WriteByte(',')
				}
				builder.WriteQuoted(column)
			}
			builder.WriteString(`) `)
		}

		if len(onConflict.TargetWhere.Exprs) > 0 {
			builder.WriteString(" WHERE ")
			onConflict.TargetWhere.Build(builder)
			builder.WriteByte(' ')
		}
	}

	if onConflict.DoNothing {
		builder.WriteString("DO NOTHING")
	} else {
		builder.WriteString("DO UPDATE SET ")
		onConflict.DoUpdates.Build(builder)
	}

	if len(onConflict.Where.Exprs) > 0 {
		builder.WriteString(" WHERE ")
		onConflict.Where.Build(builder)
		builder.WriteByte(' ')
	}
}

// MergeClause merge onConflict clauses
func (onConflict OnConflict) MergeClause(clause *Clause) {
	clause.Expression = onConflict
}
