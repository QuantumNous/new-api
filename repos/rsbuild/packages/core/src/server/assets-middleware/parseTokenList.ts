export function parseTokenList(str: string): string[] {
  let end = 0;
  let start = 0;

  const list: string[] = [];

  for (let i = 0, len = str.length; i < len; i++) {
    switch (str.charCodeAt(i)) {
      case 0x20 /*   */:
        if (start === end) {
          end = i + 1;
          start = end;
        }
        break;
      case 0x2c /* , */:
        if (start !== end) {
          list.push(str.substring(start, end));
        }
        end = i + 1;
        start = end;
        break;
      default:
        end = i + 1;
        break;
    }
  }

  if (start !== end) {
    list.push(str.substring(start, end));
  }

  return list;
}
