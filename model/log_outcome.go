package model

import "cmp"

// compareRequestOutcomes ranks settled request facts shared by the list and
// summary queries. Consumption outranks errors, then event time and ID decide.
// ClickHouse IDs may all be zero. Exact time/ID ties use the lexicographically
// greatest (is_stream, other, quota, prompt_tokens, completion_tokens), with
// true > false and other compared as raw bytes. This is deterministic tie
// resolution, not recovered insertion order. Equal projected facts are equal.
func compareRequestOutcomes(a, b *Log) int {
	if a.Type != b.Type {
		if a.Type == LogTypeConsume {
			return 1
		}
		if b.Type == LogTypeConsume {
			return -1
		}
	}
	if order := cmp.Compare(a.CreatedAt, b.CreatedAt); order != 0 {
		return order
	}
	if order := cmp.Compare(a.Id, b.Id); order != 0 {
		return order
	}
	if a.IsStream != b.IsStream {
		if a.IsStream {
			return 1
		}
		return -1
	}
	if order := cmp.Compare(a.Other, b.Other); order != 0 {
		return order
	}
	if order := cmp.Compare(a.Quota, b.Quota); order != 0 {
		return order
	}
	if order := cmp.Compare(a.PromptTokens, b.PromptTokens); order != 0 {
		return order
	}
	return cmp.Compare(a.CompletionTokens, b.CompletionTokens)
}
