let count: number = $state(0);

export function getCount() {
  count++;
  count++;
  return count;
}
