package ir

// StreamState is the block-event hub for one streaming response.
type StreamState struct {
	ID      string
	Model   string
	Created int64

	Started bool
	Done    bool

	NextIndex  int
	HasOpen    bool
	OpenKind   BlockKind
	OpenIndex  int
	OpenID     string
	OpenName   string
	ToolIndex  map[int]int
	BlockKinds map[int]BlockKind

	Finish          Finish
	ProviderFinish  string
	Usage           Usage
	PendingFinish   bool
	TerminalSent    bool
	stopped         bool
	finishEventSent bool
	usageEventSent  bool

	GeminiText        string
	GeminiThink       string
	GeminiToolCount   int
	GeminiToolJSON    map[int]string
	GeminiToolName    map[int]string
	GeminiToolEmitted map[int]bool

	ChatRoleSent         bool
	ResponsesCreated     bool
	ResponsesTextOpen    bool
	ResponsesItemID      map[int]string
	ResponsesItemAdded   map[int]bool
	ResponsesSummarySeen bool
}

func NewStreamState(id, model string) *StreamState {
	return &StreamState{
		ID:         id,
		Model:      model,
		OpenIndex:  -1,
		ToolIndex:  make(map[int]int),
		BlockKinds: make(map[int]BlockKind),
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

func (s *StreamState) EnsureTool(chatIndex int, id, name string) (int, []Event) {
	if s == nil {
		return 0, nil
	}
	if s.ToolIndex == nil {
		s.ToolIndex = make(map[int]int)
	}
	if idx, ok := s.ToolIndex[chatIndex]; ok {
		s.HasOpen = true
		s.OpenKind = BlockKindToolUse
		s.OpenIndex = idx
		return idx, nil
	}
	idx, events := s.startBlock(BlockKindToolUse, id, name)
	s.ToolIndex[chatIndex] = idx
	return idx, events
}

func (s *StreamState) startBlock(kind BlockKind, id, name string) (int, []Event) {
	events := s.StopNonTools()
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
	idx := s.OpenIndex
	kind := s.OpenKind
	s.HasOpen = false
	s.OpenKind = ""
	block := &Block{Kind: kind}
	return []Event{{Kind: EventBlockStop, Index: idx, Block: block}}
}

func (s *StreamState) StopNonTools() []Event {
	if s == nil || !s.HasOpen || s.OpenKind == BlockKindToolUse {
		return nil
	}
	return s.StopOpen()
}

func (s *StreamState) StopAll() []Event {
	if s == nil || !s.HasOpen {
		return nil
	}
	if s.OpenKind == BlockKindToolUse {
		events := make([]Event, 0, len(s.ToolIndex))
		seen := map[int]struct{}{}
		for _, idx := range s.ToolIndex {
			if _, ok := seen[idx]; ok {
				continue
			}
			seen[idx] = struct{}{}
			events = append(events, Event{Kind: EventBlockStop, Index: idx, Block: &Block{Kind: BlockKindToolUse}})
		}
		s.HasOpen = false
		s.OpenKind = ""
		return events
	}
	return s.StopOpen()
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
}

func (s *StreamState) hasUsage() bool {
	return s != nil && (s.Usage.Input != 0 || s.Usage.Output != 0 || s.Usage.Thought != 0 || s.Usage.CacheRead != 0 || s.Usage.CacheWrite != 0)
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
		s.SetFinish(FinishStop, "")
	}
	return s.TerminalEvents()
}
