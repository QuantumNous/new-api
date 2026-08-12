// https://deepinfra.com/models/embeddings
export type DeepInfraEmbeddingModelId =
  | 'BAAI/bge-base-en-v1.5'
  | 'BAAI/bge-large-en-v1.5'
  | 'BAAI/bge-m3'
  | 'intfloat/e5-base-v2'
  | 'intfloat/e5-large-v2'
  | 'intfloat/multilingual-e5-large'
  | 'sentence-transformers/all-MiniLM-L12-v2'
  | 'sentence-transformers/all-MiniLM-L6-v2'
  | 'sentence-transformers/all-mpnet-base-v2'
  | 'sentence-transformers/clip-ViT-B-32'
  | 'sentence-transformers/clip-ViT-B-32-multilingual-v1'
  | 'sentence-transformers/multi-qa-mpnet-base-dot-v1'
  | 'sentence-transformers/paraphrase-MiniLM-L6-v2'
  | 'shibing624/text2vec-base-chinese'
  | 'thenlper/gte-base'
  | 'thenlper/gte-large'
  | (string & {});
