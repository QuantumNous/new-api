// Package content2reasoning parses reasoning markers embedded in streamed or
// buffered text. It is intentionally protocol agnostic: callers feed text in,
// receive ordered fragments out, and are responsible for mapping fragments onto
// their response DTOs.
package content2reasoning

import (
	"fmt"
	"strings"
)

// Pair is one start/end marker pair. Start and End must be non-empty after
// trimming. When Start equals End the marker toggles: the first occurrence opens
// a reasoning block and the next closes it.
type Pair struct {
	Start string
	End   string
}

type Kind int

const (
	KindContent Kind = iota
	KindThinking
)

type Fragment struct {
	Kind Kind
	Text string
}

type phase int

const (
	phaseAwaiting phase = iota
	phaseThinking
	phaseContent
)

// State parses one choice across arbitrary chunk boundaries. It is not safe for
// concurrent use.
type State struct {
	markers []Pair
	phase   phase
	active  int

	tail      string
	knowledge strings.Builder
	found     bool
}

// NewState validates markers and returns a parser ready to consume the first chunk.
func NewState(markers []Pair) (*State, error) {
	if len(markers) == 0 {
		return nil, fmt.Errorf("content2reasoning: at least one marker pair is required")
	}
	normalized := make([]Pair, len(markers))
	for i, marker := range markers {
		start := strings.TrimSpace(marker.Start)
		end := strings.TrimSpace(marker.End)
		if start == "" || end == "" {
			return nil, fmt.Errorf("content2reasoning: marker[%d] start and end must not be empty", i)
		}
		normalized[i] = Pair{Start: start, End: end}
	}
	return &State{
		markers: normalized,
		phase:   phaseAwaiting,
	}, nil
}

// Feed consumes text and returns fragments that can be emitted immediately.
func (s *State) Feed(text string) []Fragment {
	if s == nil || text == "" {
		return nil
	}
	if s.phase == phaseContent {
		return []Fragment{{Kind: KindContent, Text: text}}
	}

	s.tail += text
	if s.phase == phaseThinking {
		return s.consumeThinking()
	}
	return s.consumeAwaiting()
}

// IsContent reports whether the parser has already emitted its first complete
// reasoning block and is now passing text through untouched.
func (s *State) IsContent() bool {
	return s != nil && s.phase == phaseContent
}

// IsThinking reports whether a reasoning block is currently open.
func (s *State) IsThinking() bool {
	return s != nil && s.phase == phaseThinking
}

// Found reports whether at least one reasoning block has been entered.
func (s *State) Found() bool {
	return s != nil && s.found
}

// Done flushes the parser. If a reasoning block is still open, the collected text
// is emitted as reasoning and unclosed is true. Any buffered partial end marker is
// trimmed so the marker itself does not leak into reasoning.
func (s *State) Done() ([]Fragment, bool) {
	if s == nil {
		return nil, false
	}
	switch s.phase {
	case phaseThinking:
		trimmed := s.tail
		if partial := longestPartialSuffix(s.tail, s.activeEnd()); partial > 0 {
			trimmed = s.tail[:len(s.tail)-partial]
		}
		reasoning := s.knowledge.String() + trimmed
		s.tail = ""
		s.knowledge.Reset()
		s.phase = phaseContent
		if reasoning == "" {
			return nil, true
		}
		return []Fragment{{Kind: KindThinking, Text: reasoning}}, true
	case phaseAwaiting:
		content := s.tail
		s.tail = ""
		s.phase = phaseContent
		if content == "" {
			return nil, false
		}
		return []Fragment{{Kind: KindContent, Text: content}}, false
	default:
		return nil, false
	}
}

func (s *State) consumeAwaiting() []Fragment {
	var fragments []Fragment
	for s.phase == phaseAwaiting {
		index, markerIndex := earliestStart(s.tail, s.markers)
		if index < 0 {
			keep := longestPartialPrefix(s.tail, startMarkers(s.markers))
			if end := len(s.tail) - keep; end > 0 {
				fragments = append(fragments, Fragment{Kind: KindContent, Text: s.tail[:end]})
				s.tail = s.tail[end:]
			}
			return fragments
		}

		if index > 0 {
			fragments = append(fragments, Fragment{Kind: KindContent, Text: s.tail[:index]})
		}
		s.active = markerIndex
		s.found = true
		s.tail = s.tail[index+len(s.markers[markerIndex].Start):]
		s.knowledge.Reset()
		s.phase = phaseThinking

		fragments = append(fragments, s.consumeThinking()...)
	}
	return fragments
}

func (s *State) consumeThinking() []Fragment {
	var fragments []Fragment
	if s.phase != phaseThinking {
		return fragments
	}

	endMarker := s.activeEnd()
	index := strings.Index(s.tail, endMarker)
	if index >= 0 {
		reasoning := s.knowledge.String() + s.tail[:index]
		rest := s.tail[index+len(endMarker):]
		s.tail = ""
		s.knowledge.Reset()
		s.phase = phaseContent
		if reasoning != "" {
			fragments = append(fragments, Fragment{Kind: KindThinking, Text: reasoning})
		}
		if rest != "" {
			fragments = append(fragments, Fragment{Kind: KindContent, Text: rest})
		}
		return fragments
	}

	// Keep only a trailing slice that may be the start of the end marker.
	keep := longestPartialSuffix(s.tail, endMarker)
	if end := len(s.tail) - keep; end > 0 {
		s.knowledge.WriteString(s.tail[:end])
		s.tail = s.tail[end:]
	}
	return fragments
}

func (s *State) activeEnd() string {
	if s == nil || s.active < 0 || s.active >= len(s.markers) {
		return ""
	}
	return s.markers[s.active].End
}

func startMarkers(markers []Pair) []string {
	starts := make([]string, len(markers))
	for i := range markers {
		starts[i] = markers[i].Start
	}
	return starts
}

func earliestStart(text string, markers []Pair) (int, int) {
	bestIndex := -1
	bestMarker := -1
	for i := range markers {
		index := strings.Index(text, markers[i].Start)
		if index < 0 {
			continue
		}
		if bestIndex < 0 || index < bestIndex || (index == bestIndex && i < bestMarker) {
			bestIndex = index
			bestMarker = i
		}
	}
	return bestIndex, bestMarker
}

// longestPartialPrefix returns the length of the longest non-empty suffix of text
// that is a strict prefix of one of the candidate strings.
func longestPartialPrefix(text string, candidates []string) int {
	best := 0
	for _, candidate := range candidates {
		if candidate == "" {
			continue
		}
		best = max(best, longestPartialSuffix(text, candidate))
	}
	return best
}

// longestPartialSuffix returns the length of the longest non-empty suffix of text
// that is a strict prefix of marker.
func longestPartialSuffix(text string, marker string) int {
	if marker == "" {
		return 0
	}
	limit := len(text)
	if limit > len(marker)-1 {
		limit = len(marker) - 1
	}
	for length := limit; length > 0; length-- {
		if strings.HasPrefix(marker, text[len(text)-length:]) {
			return length
		}
	}
	return 0
}

type SplitResult struct {
	Reasoning string
	Content   string
	Found     bool
	Unclosed  bool
}

// SplitText parses a complete text buffer with the same semantics as State.
func SplitText(text string, markers []Pair) SplitResult {
	result := SplitResult{}
	if len(markers) == 0 {
		return result
	}
	state, err := NewState(markers)
	if err != nil {
		return result
	}
	for _, fragment := range state.Feed(text) {
		result.append(fragment)
	}
	done, unclosed := state.Done()
	for _, fragment := range done {
		if fragment.Kind == KindThinking {
			result.Found = true
		}
		result.append(fragment)
	}
	result.Found = state.Found()
	result.Unclosed = unclosed
	return result
}

func (r *SplitResult) append(fragment Fragment) {
	switch fragment.Kind {
	case KindThinking:
		r.Reasoning += fragment.Text
	case KindContent:
		r.Content += fragment.Text
	}
}
