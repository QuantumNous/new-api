/**
 * Tokenize a translation string with numbered tags
 * Note: Variables are already interpolated by the i18n system before we receive the string
 *
 * @param {string} translation - Translation string with numbered tags
 * @returns {Array<Token>} Array of tokens
 */
export const tokenize = (translation) => {
  const tokens = [];

  let position = 0;

  let currentText = '';

  const flushText = () => {
    if (currentText) {
      tokens.push({
        type: 'Text',
        value: currentText,
        position: position - currentText.length,
      });

      currentText = '';
    }
  };

  while (position < translation.length) {
    const char = translation[position];

    // Check for opening tag: <0>, <1>, etc.
    if (char === '<') {
      const tagMatch = translation.slice(position).match(/^<(\d+)>/);

      if (tagMatch) {
        flushText();

        tokens.push({
          type: 'TagOpen',
          value: tagMatch[0],
          position,
          tagNumber: parseInt(tagMatch[1], 10),
        });

        position += tagMatch[0].length;
      } else {
        // Check for closing tag: </0>, </1>, etc.
        const closeTagMatch = translation.slice(position).match(/^<\/(\d+)>/);

        if (closeTagMatch) {
          flushText();

          tokens.push({
            type: 'TagClose',
            value: closeTagMatch[0],
            position,
            tagNumber: parseInt(closeTagMatch[1], 10),
          });

          position += closeTagMatch[0].length;
        } else {
          // Regular text (including any { } characters that aren't our tags)
          currentText += char;

          position += 1;
        }
      }
    } else {
      // Regular text (including any { } characters that aren't our tags)
      currentText += char;

      position += 1;
    }
  }

  flushText();

  return tokens;
};
