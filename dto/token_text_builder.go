package dto

import "strings"

type tokenTextBuilder struct {
	builder   strings.Builder
	partCount int
}

func (b *tokenTextBuilder) Add(text string) {
	if b.partCount > 0 {
		b.builder.WriteByte('\n')
	}
	b.builder.WriteString(text)
	b.partCount++
}

func (b *tokenTextBuilder) String() string {
	return b.builder.String()
}
