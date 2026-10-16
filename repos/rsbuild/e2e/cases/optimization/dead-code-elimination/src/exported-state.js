// Covers an exported state binding that is never imported by the app.
export let used = false;

export function use() {
  used = true;
}

export function test() {
  if (used) {
    return 'dce-exported-state-removed';
  }

  return 'dce-exported-state-expected';
}
