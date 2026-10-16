const ARRAY_INDEX_RE = /\.\d+(\.|$)/;

export default (name: string) =>
  name.substring(0, name.search(ARRAY_INDEX_RE)) || name;
