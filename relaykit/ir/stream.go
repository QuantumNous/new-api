package ir

import (
	"fmt"
	"sort"
)

// ToolStreamState keeps one logical streaming tool call isolated from every
// other call. Fragments may be standard deltas or provider-specific cumulative
// snapshots; projectors choose the stable final value only at block stop.
type ToolStreamState struct {
	SourceIndex    int
	BlockIndex     int
	ProviderItemID string
	ID             string
	Name           string
	Fragments      []string
	Accumulated    string
	LatestSnapshot string
	Emitted        bool
}

// ResponsesStreamItemState tracks the complete lifecycle and accumulated
// payload for one projected Responses output item.
type ResponsesStreamItemState struct {
	Kind      BlockKind
	ItemID    string
	CallID    string
	Name      string
	Text      string
	Arguments string
	Added     bool
	PartAdded bool
	Done      bool
}

// StreamState is the block-event hub for one streaming response.
type StreamState struct {
	ID      string
	Model   string
	Created int64

	Started bool
	Done    bool

	NextIndex    int
	HasOpen      bool
	OpenKind     BlockKind
	OpenIndex    int
	OpenID       string
	OpenName     string
	ToolIndex    map[int]int
	ToolCalls    map[int]*ToolStreamState
	BlockKinds   map[int]BlockKind
	ClosedBlocks map[int]bool
	ToolIDScope  string

	Finish          Finish
	ProviderFinish  string
	Usage           Usage
	UsageSet        bool
	PendingFinish   bool
	TerminalSent    bool
	stopped         bool
	finishEventSent bool
	usageEventSent  bool

	GeminiText      string
	GeminiThink     string
	GeminiToolCount int

	ChatRoleSent             bool
	ResponsesCreated         bool
	ResponsesItems           map[int]*ResponsesStreamItemState
	ResponsesSourceBlocks    map[int]int
	ResponsesSourceText      map[int]string
	ResponsesSourceReasoning map[int]string
	ResponsesSourceArguments map[int]string
	ResponsesSequence        int64
	ResponsesSummarySeen     bool
}

func NewStreamState(id, model string) *StreamState {
	return &StreamState{
		ID:           id,
		Model:        model,
		OpenIndex:    -1,
		ToolIndex:    make(map[int]int),
		ToolCalls:    make(map[int]*ToolStreamState),
		BlockKinds:   make(map[int]BlockKind),
		ClosedBlocks: make(map[int]bool),
		ToolIDScope:  NewToolCallScope(id),
	}
}

func (s *StreamState) KindOf(index int) BlockKind {
	if s == nil || s.BlockKinds == nil {
		return ""
	}
	return s.BlockKinds[index]
}

func (s *StreamState) StartEvent(id, model string) *Event {
	if s == nil || s.Started {
		return nil
	}
	if id != "" {
		s.ID = id
	}
	if model != "" {
		s.Model = model
	}
	s.Started = true
	return &Event{Kind: EventStart, ID: s.ID, Model: s.Model}
}

func (s *StreamState) EnsureBlock(kind BlockKind) (int, []Event) {
	if s == nil {
		return 0, nil
	}
	if s.HasOpen && s.OpenKind == kind && kind != BlockKindToolUse {
		return s.OpenIndex, nil
	}
	return s.startBlock(kind, "", "")
}

func (s *StreamState) EnsureTool(sourceIndex int, id, name string) (int, []Event) {
	if s == nil {
		return 0, nil
	}
	if s.ToolIndex == nil {
		s.ToolIndex = make(map[int]int)
	}
	if s.ToolCalls == nil {
		s.ToolCalls = make(map[int]*ToolStreamState)
	}
	if idx, ok := s.ToolIndex[sourceIndex]; ok {
		tool := s.ToolCalls[idx]
		if tool == nil {
			tool = &ToolStreamState{SourceIndex: sourceIndex, BlockIndex: idx}
			s.ToolCalls[idx] = tool
		}
		if id != "" && tool.ProviderItemID == "" {
			tool.ProviderItemID = id
		}
		if tool.ID == "" {
			tool.ID = CanonicalToolCallID(s.ToolIDScope, sourceIndex, id)
		}
		s.OpenID = tool.ID
		if name != "" {
			tool.Name = name
			s.OpenName = name
		}
		s.HasOpen = true
		s.OpenKind = BlockKindToolUse
		s.OpenIndex = idx
		return idx, nil
	}
	canonicalID := CanonicalToolCallID(s.ToolIDScope, sourceIndex, id)
	idx, events := s.startBlock(BlockKindToolUse, canonicalID, name)
	s.ToolIndex[sourceIndex] = idx
	s.ToolCalls[idx] = &ToolStreamState{
		SourceIndex:    sourceIndex,
		BlockIndex:     idx,
		ProviderItemID: id,
		ID:             canonicalID,
		Name:           name,
	}
	return idx, events
}

// ResolveToolSourceIndex safely associates a tool delta that omitted index.
// IDs win, then a unique name/current call. Ambiguous argument-only deltas are
// rejected rather than being merged into another parallel call.
func (s *StreamState) ResolveToolSourceIndex(index *int, id, name string) (int, error) {
	if index != nil {
		return *index, nil
	}
	if s == nil || len(s.ToolIndex) == 0 {
		return 0, nil
	}
	if id != "" {
		for source, block := range s.ToolIndex {
			if tool := s.ToolCalls[block]; tool != nil && (tool.ID == id || tool.ProviderItemID == id) {
				return source, nil
			}
		}
		match, matches := 0, 0
		for source, block := range s.ToolIndex {
			tool := s.ToolCalls[block]
			if tool == nil || tool.ProviderItemID != "" {
				continue
			}
			if name == "" || tool.Name == "" || tool.Name == name {
				match = source
				matches++
			}
		}
		if matches == 1 {
			return match, nil
		}
		return s.nextToolSourceIndex(), nil
	}
	if name != "" {
		match, matches := 0, 0
		for source, block := range s.ToolIndex {
			if tool := s.ToolCalls[block]; tool != nil && tool.Name == name {
				match = source
				matches++
			}
		}
		if matches == 1 {
			return match, nil
		}
		if matches > 1 {
			return 0, fmt.Errorf("ambiguous tool delta without index for function %q", name)
		}
		return s.nextToolSourceIndex(), nil
	}
	if len(s.ToolIndex) == 1 {
		for source := range s.ToolIndex {
			return source, nil
		}
	}
	return 0, fmt.Errorf("ambiguous tool arguments delta without index or call id")
}

func (s *StreamState) nextToolSourceIndex() int {
	next := 0
	for source := range s.ToolIndex {
		if source >= next {
			next = source + 1
		}
	}
	return next
}

func (s *StreamState) ToolMetadata(blockIndex int) (id, name string) {
	if s == nil || s.ToolCalls == nil {
		return "", ""
	}
	if tool := s.ToolCalls[blockIndex]; tool != nil {
		return tool.ID, tool.Name
	}
	return "", ""
}

func (s *StreamState) startBlock(kind BlockKind, id, name string) (int, []Event) {
	events := s.StopNonTools()
	if kind != BlockKindToolUse {
		events = append(events, s.StopTools()...)
	}
	idx := s.NextIndex
	s.NextIndex++
	s.HasOpen = true
	s.OpenKind = kind
	s.OpenIndex = idx
	s.OpenID = id
	s.OpenName = name
	if s.BlockKinds == nil {
		s.BlockKinds = make(map[int]BlockKind)
	}
	s.BlockKinds[idx] = kind
	block := &Block{Kind: kind}
	switch kind {
	case BlockKindText:
		block.Text = &TextBlock{}
	case BlockKindThink:
		block.Think = &ThinkBlock{}
	case BlockKindToolUse:
		block.ToolUse = &ToolUseBlock{ID: id, Name: name}
	}
	events = append(events, Event{Kind: EventBlockStart, Index: idx, ID: id, Model: s.Model, Block: block})
	return idx, events
}

func (s *StreamState) StopOpen() []Event {
	if s == nil || !s.HasOpen {
		return nil
	}
	return s.StopBlock(s.OpenIndex)
}

func (s *StreamState) StopBlock(index int) []Event {
	if s == nil || s.ClosedBlocks[index] {
		return nil
	}
	kind := s.KindOf(index)
	if kind == "" {
		return nil
	}
	if s.ClosedBlocks == nil {
		s.ClosedBlocks = make(map[int]bool)
	}
	s.ClosedBlocks[index] = true
	if s.HasOpen && s.OpenIndex == index {
		s.HasOpen = false
		s.OpenKind = ""
	}
	block := &Block{Kind: kind}
	return []Event{{Kind: EventBlockStop, Index: index, Block: block}}
}

func (s *StreamState) StopNonTools() []Event {
	if s == nil || !s.HasOpen || s.OpenKind == BlockKindToolUse {
		return nil
	}
	return s.StopOpen()
}

func (s *StreamState) StopTools() []Event {
	if s == nil {
		return nil
	}
	type toolStop struct {
		source int
		block  int
	}
	stops := make([]toolStop, 0, len(s.ToolIndex))
	for source, block := range s.ToolIndex {
		if s.ClosedBlocks[block] {
			continue
		}
		stops = append(stops, toolStop{source: source, block: block})
	}
	sort.Slice(stops, func(i, j int) bool {
		if stops[i].source == stops[j].source {
			return stops[i].block < stops[j].block
		}
		return stops[i].source < stops[j].source
	})
	events := make([]Event, 0, len(stops))
	for _, stop := range stops {
		events = append(events, s.StopBlock(stop.block)...)
	}
	return events
}

func (s *StreamState) StopAll() []Event {
	if s == nil {
		return nil
	}
	events := s.StopNonTools()
	events = append(events, s.StopTools()...)
	s.HasOpen = false
	s.OpenKind = ""
	return events
}

func (s *StreamState) SetFinish(finish Finish, provider string) {
	if s == nil {
		return
	}
	if finish != "" {
		s.Finish = finish
	}
	if provider != "" {
		s.ProviderFinish = provider
	}
	s.PendingFinish = true
}

func (s *StreamState) SetUsage(usage Usage) {
	if s == nil {
		return
	}
	s.Usage = usage
	s.UsageSet = true
}

func (s *StreamState) hasUsage() bool {
	return s != nil && s.UsageSet
}

func (s *StreamState) TerminalEvents() []Event {
	if s == nil || s.Done {
		return nil
	}
	var events []Event
	if !s.stopped {
		events = s.StopAll()
		s.stopped = true
	}
	if (s.PendingFinish || s.Finish != "") && !s.finishEventSent {
		finish := s.Finish
		events = append(events, Event{Kind: EventFinish, Finish: &finish, ID: s.ID, Model: s.Model})
		s.finishEventSent = true
	}
	if s.hasUsage() && !s.usageEventSent {
		usage := s.Usage
		events = append(events, Event{Kind: EventUsage, Usage: &usage, ID: s.ID, Model: s.Model})
		s.usageEventSent = true
	}
	if s.finishEventSent && s.usageEventSent {
		s.TerminalSent = true
		s.Done = true
		s.PendingFinish = false
	}
	return events
}

func (s *StreamState) Finalize() []Event {
	if s == nil || s.Done {
		return nil
	}
	if !s.PendingFinish && s.Finish == "" {
		finish := FinishStop
		if len(s.ToolIndex) > 0 {
			finish = FinishTool
		}
		s.SetFinish(finish, "")
	}
	// EOF is authoritative. Even when the provider omitted usage entirely, a
	// zero usage event lets target protocols emit their terminal envelope and
	// marks the state complete. Runtime handlers replace it with final or
	// estimated usage before finalization whenever available.
	if !s.UsageSet {
		s.SetUsage(Usage{})
	}
	return s.TerminalEvents()
}
