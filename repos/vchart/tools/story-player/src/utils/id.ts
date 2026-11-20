let lastElementId = 0;
const elementIdMax = 9999999;

export function createID(): number {
  lastElementId++;
  lastElementId >= elementIdMax && (lastElementId = 1);
  return lastElementId;
}

export function resetID() {
  lastElementId = 0;
}
