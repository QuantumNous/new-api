let used = false;

// This unused export is the only possible mutator of the branch guard.
export function use() {
  used = true;
}

export function test() {
  if (used) {
    return 'dce-unused-mutator-removed';
  }

  return 'dce-unused-mutator-expected';
}
