const FIELD_PATH_RE = /[.[\]'"]/;

export default (input: string): string[] =>
  input.split(FIELD_PATH_RE).filter(Boolean);
