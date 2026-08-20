package content2reasoning

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSplitTextCompleteBlock(t *testing.T) {
	result := SplitText("<mm:think>分析过程</mm:think>最终答案", []Pair{{Start: "<mm:think>", End: "</mm:think>"}})

	assert.Equal(t, "分析过程", result.Reasoning)
	assert.Equal(t, "最终答案", result.Content)
	assert.True(t, result.Found)
	assert.False(t, result.Unclosed)
}

func TestSplitTextPrefixAndSuffix(t *testing.T) {
	result := SplitText("prefix<mm:think>reasoning</mm:think>suffix", []Pair{{Start: "<mm:think>", End: "</mm:think>"}})

	assert.Equal(t, "reasoning", result.Reasoning)
	assert.Equal(t, "prefixsuffix", result.Content)
}

func TestSplitTextPlainTextIsUntouched(t *testing.T) {
	result := SplitText("no markers here", []Pair{{Start: "<mm:think>", End: "</mm:think>"}})

	assert.Equal(t, "", result.Reasoning)
	assert.Equal(t, "no markers here", result.Content)
	assert.False(t, result.Found)
}

func TestStateStreamAcrossChunks(t *testing.T) {
	state, err := NewState([]Pair{{Start: "<mm:think>", End: "</mm:think>"}})
	require.NoError(t, err)

	assert.Empty(t, state.Feed("<mm:th"))
	assert.Empty(t, state.Feed("ink>abc"))
	assert.Empty(t, state.Feed("def</mm:thin"))
	assert.Equal(t,
		[]Fragment{
			{Kind: KindThinking, Text: "abcdef"},
			{Kind: KindContent, Text: "answer"},
		},
		state.Feed("k>answer"),
	)

	done, unclosed := state.Done()
	require.False(t, unclosed)
	assert.Empty(t, done)
}

func TestStateSingleChunkMixedContent(t *testing.T) {
	state, err := NewState([]Pair{{Start: "<mm:think>", End: "</mm:think>"}})
	require.NoError(t, err)

	fragments := state.Feed("prefix<mm:think>reasoning</mm:think>suffix")
	assert.Equal(t, []Fragment{
		{Kind: KindContent, Text: "prefix"},
		{Kind: KindThinking, Text: "reasoning"},
		{Kind: KindContent, Text: "suffix"},
	}, fragments)
}

func TestStateFlushesPrefixBeforeMarker(t *testing.T) {
	state, err := NewState([]Pair{{Start: "<mm:think>", End: "</mm:think>"}})
	require.NoError(t, err)

	assert.Equal(t, []Fragment{{Kind: KindContent, Text: "wait "}}, state.Feed("wait <mm:th"))
	assert.Empty(t, state.Feed("ink>"))
}

func TestStateOptimisticUnclosedReasoning(t *testing.T) {
	state, err := NewState([]Pair{{Start: "<mm:think>", End: "</mm:think>"}})
	require.NoError(t, err)

	assert.Empty(t, state.Feed("<mm:think>abc"))
	done, unclosed := state.Done()
	assert.True(t, unclosed)
	assert.Equal(t, []Fragment{{Kind: KindThinking, Text: "abc"}}, done)
}

func TestStateUnclosedTrimsPartialEndMarker(t *testing.T) {
	state, err := NewState([]Pair{{Start: "<mm:think>", End: "</mm:think>"}})
	require.NoError(t, err)

	assert.Empty(t, state.Feed("<mm:think>abc</mm:thi"))
	done, unclosed := state.Done()
	assert.True(t, unclosed)
	assert.Equal(t, []Fragment{{Kind: KindThinking, Text: "abc"}}, done)
}

func TestStateContentAfterFirstBlockIsPassthrough(t *testing.T) {
	state, err := NewState([]Pair{{Start: "<mm:think>", End: "</mm:think>"}})
	require.NoError(t, err)

	_ = state.Feed("<mm:think>a</mm:think>")
	assert.Equal(t, []Fragment{{Kind: KindContent, Text: "tail <mm:think>literal</mm:think>"}}, state.Feed("tail <mm:think>literal</mm:think>"))
	assert.True(t, state.IsContent())
	assert.True(t, state.Found())
}

func TestStateSameStartAndEndToggles(t *testing.T) {
	state, err := NewState([]Pair{{Start: "```", End: "```"}})
	require.NoError(t, err)

	assert.Equal(t, []Fragment{
		{Kind: KindThinking, Text: "think"},
		{Kind: KindContent, Text: "answer"},
	}, state.Feed("```think```answer"))
	assert.True(t, state.IsContent())
}

func TestStateMultiplePairsUsesEarliestStart(t *testing.T) {
	state, err := NewState([]Pair{
		{Start: "<a>", End: "</a>"},
		{Start: "<b>", End: "</b>"},
	})
	require.NoError(t, err)

	fragments := state.Feed("x<b>inner</b>y")
	assert.Equal(t, []Fragment{
		{Kind: KindContent, Text: "x"},
		{Kind: KindThinking, Text: "inner"},
		{Kind: KindContent, Text: "y"},
	}, fragments)
}

func TestStateMultiplePairsUnclosedActiveEnd(t *testing.T) {
	state, err := NewState([]Pair{
		{Start: "<a>", End: "</a>"},
		{Start: "<b>", End: "</b>"},
	})
	require.NoError(t, err)

	assert.Empty(t, state.Feed("<b>abc"))
	done, unclosed := state.Done()
	assert.True(t, unclosed)
	assert.Equal(t, []Fragment{{Kind: KindThinking, Text: "abc"}}, done)
}

func TestNewStateRejectsInvalidPairs(t *testing.T) {
	_, err := NewState(nil)
	require.Error(t, err)

	_, err = NewState([]Pair{{Start: "", End: ""}})
	require.Error(t, err)
}
