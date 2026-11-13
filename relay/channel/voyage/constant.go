package voyage

// ModelKind selects the Voyage endpoint a model is served by.
type ModelKind int

const (
	KindEmbedding ModelKind = iota + 1
	KindContextualizedEmbedding
	KindMultimodalEmbedding
	KindRerank
)

var catalog = []struct {
	Name string
	Kind ModelKind
}{
	{"voyage-4-large", KindEmbedding},
	{"voyage-4", KindEmbedding},
	{"voyage-4-lite", KindEmbedding},
	{"voyage-code-4", KindEmbedding},
	{"voyage-3-large", KindEmbedding},
	{"voyage-3.5", KindEmbedding},
	{"voyage-3.5-lite", KindEmbedding},
	{"voyage-code-3", KindEmbedding},
	{"voyage-finance-2", KindEmbedding},
	{"voyage-law-2", KindEmbedding},
	{"voyage-context-4", KindContextualizedEmbedding},
	{"voyage-context-3", KindContextualizedEmbedding},
	{"voyage-multimodal-3.5", KindMultimodalEmbedding},
	{"voyage-multimodal-3", KindMultimodalEmbedding},
	{"rerank-3", KindRerank},
	{"rerank-3-lite", KindRerank},
	{"rerank-2.5", KindRerank},
	{"rerank-2.5-lite", KindRerank},
}

var modelKinds = make(map[string]ModelKind, len(catalog))

// ModelList is the explicit list of Voyage models served by this channel.
var ModelList = make([]string, 0, len(catalog))

func init() {
	for _, entry := range catalog {
		modelKinds[entry.Name] = entry.Kind
		ModelList = append(ModelList, entry.Name)
	}
}

var ChannelName = "voyage"
