const styles: Record<string, string> = {
  1: 'font-weight:bold', // bold
  2: 'opacity:0.5', // dim
  3: 'font-style:italic', // italic
  4: 'text-decoration:underline;text-underline-offset:3px', // underscore
  8: 'display:none', // hidden
  9: 'text-decoration:line-through', // delete
  30: 'color:#000', // darkgrey
  31: 'color:#fb6a6a', // red, hsl(0deg 95% 70%)
  32: 'color:#6ef790', // green, hsl(65deg 90% 75%)
  33: 'color:#eff986', // yellow, hsl(185deg 90% 70%)
  34: 'color:#6eb2f7', // blue, hsl(325deg 90% 70%)
  35: 'color:#f76ebe', // magenta, hsl(300deg 90% 70%)
  36: 'color:#6eecf7', // cyan, hsl(210deg 90% 70%)
  37: 'color:#f0f0f0', // lightgrey, hsl(0deg 0% 94%)
  90: 'color:#888', // bright black
};

// use the same color for bright colors
for (let i = 91; i <= 97; i++) {
  styles[i] = styles[i - 60];
}

const closeCode = [0, 21, 22, 23, 24, 27, 28, 29, 39, 49];

/**
 * Converts text with ANSI color codes to HTML markup
 */
export function ansiHTML(text: string): string {
  // Cache opened sequence
  const ansiCodes: string[] = [];
  // Replace with markup
  // rslint-disable-next-line no-control-regex
  let ret = text.replace(/\x1B\[([0-9;]+)m/g, (_match: string, sequences: string): string => {
    let style = '';
    for (const seq of sequences.split(';')) {
      if (styles[seq]) {
        style += `${styles[seq]};`;
      }
    }

    if (style) {
      ansiCodes.push(sequences);
      return `<span style="${style}">`;
    }

    if (closeCode.includes(Number(sequences)) && ansiCodes.length > 0) {
      ansiCodes.pop();
      return '</span>';
    }
    return '';
  });

  // Make sure tags are closed
  if (ansiCodes.length > 0) {
    ret += Array(ansiCodes.length + 1).join('</span>');
  }

  return ret;
}
