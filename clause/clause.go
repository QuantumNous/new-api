package clause

// Interface clause interface
type Interface interface {
	Name() string
	Build(Builder)
	MergeClause(*Clause)
}

// ClauseBuilder clause builder, allows to customize how to build clause
type ClauseBuilder func(Clause, Builder)

type Writer interface {
	WriteByte(byte) error
	WriteString(string) (int, error)
}

// Builder builder interface
type Builder interface {
	Writer
	WriteQuoted(field interface{})
	AddVar(Writer, ...interface{})
	AddError(error) error
}

// Clause
type Clause struct {
	Name                string // WHERE
	BeforeExpression    Expression
	AfterNameExpression Expression
	AfterExpression     Expression
	Expression          Expression
	Builder             ClauseBuilder
}

// Build build clause
func (c Clause) Build(builder Builder) {
	if c.Builder != nil {
		c.Builder(c, builder)
	} else if c.Expression != nil {
		if c.BeforeExpression != nil {
			c.BeforeExpression.Build(builder)
			builder.WriteByte(' ')
		}

		if c.Name != "" {
			builder.WriteString(c.Name)
			builder.WriteByte(' ')
		}

		if c.AfterNameExpression != nil {
			c.AfterNameExpression.Build(builder)
			builder.WriteByte(' ')
		}

		c.Expression.Build(builder)

		if c.AfterExpression != nil {
			builder.WriteByte(' ')
			c.AfterExpression.Build(builder)
		}
	}
}

const (
	PrimaryKey   string = "~~~py~~~" // primary key
	CurrentTable string = "~~~ct~~~" // current table
	Associations string = "~~~as~~~" // associations
)

var (
	currentTable  = Table{Name: CurrentTable}
	PrimaryColumn = Column{Table: CurrentTable, Name: PrimaryKey}
)

// Column quote with name
type Column struct {
	Table string
	Name  string
	Alias string
	Raw   bool
}

// Table quote with name
type Table struct {
	Name  string
	Alias string
	Raw   bool
}
