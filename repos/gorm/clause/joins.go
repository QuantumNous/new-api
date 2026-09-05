package clause

type JoinType string

const (
	CrossJoin JoinType = "CROSS"
	InnerJoin JoinType = "INNER"
	LeftJoin  JoinType = "LEFT"
	RightJoin JoinType = "RIGHT"
)

// Join clause for from
type Join struct {
	Type       JoinType
	Table      Table
	ON         Where
	Using      []string
	Expression Expression
}

func (join Join) Build(builder Builder) {
	if join.Expression != nil {
		join.Expression.Build(builder)
	} else {
		if join.Type != "" {
			builder.WriteString(string(join.Type))
			builder.WriteByte(' ')
		}

		builder.WriteString("JOIN ")
		builder.WriteQuoted(join.Table)

		if len(join.ON.Exprs) > 0 {
			builder.WriteString(" ON ")
			join.ON.Build(builder)
		} else if len(join.Using) > 0 {
			builder.WriteString(" USING (")
			for idx, c := range join.Using {
				if idx > 0 {
					builder.WriteByte(',')
				}
				builder.WriteQuoted(c)
			}
			builder.WriteByte(')')
		}
	}
}
