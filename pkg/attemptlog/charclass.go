package attemptlog

import "unicode"

// CharCounts breaks input text down by script class. This is a cheap proxy for
// tokenizer behaviour: Latin text averages far more characters per token than
// Han text, so the ratio between these buckets carries information that a
// single token estimate does not.
type CharCounts struct {
	Latin int
	Han   int
	Other int
}

// CountChars classifies each rune of text.
//
// Latin counts ASCII and Latin-script letters. Han counts CJK ideographs, which
// includes the Han characters used by Japanese and Korean text. Everything else
// (digits, punctuation, whitespace, emoji, Cyrillic, Greek, Arabic, kana,
// Hangul) falls into Other. Invalid UTF-8 bytes decode to U+FFFD and count as
// Other rather than being dropped.
func CountChars(text string) CharCounts {
	var counts CharCounts
	for _, r := range text {
		switch {
		case isLatin(r):
			counts.Latin++
		case unicode.Is(unicode.Han, r):
			counts.Han++
		default:
			counts.Other++
		}
	}
	return counts
}

func isLatin(r rune) bool {
	if r < unicode.MaxASCII {
		return (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z')
	}
	return unicode.Is(unicode.Latin, r)
}
