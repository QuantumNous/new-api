package ir

// PartitionByToolResult splits blocks so each tool result is its own turn and
// any surrounding content (follow-up text, media, think) stays grouped in
// original order. Chat and Gemini cannot keep a tool_result and a later user
// question in one wire message without dropping the question.
func PartitionByToolResult(blocks []Block) [][]Block {
	if len(blocks) == 0 {
		return nil
	}
	var groups [][]Block
	var pending []Block
	flush := func() {
		if len(pending) == 0 {
			return
		}
		groups = append(groups, pending)
		pending = nil
	}
	for _, block := range blocks {
		if block.Kind == BlockKindToolResult {
			flush()
			groups = append(groups, []Block{block})
			continue
		}
		pending = append(pending, block)
	}
	flush()
	if len(groups) == 0 {
		return [][]Block{blocks}
	}
	return groups
}
