const abbreviations = ['UI', 'POC', 'RTL'];

export function camelToSentenceCase(camel: string) {
  let text = camel
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase()
    .replace(/^./, (str) => str.toUpperCase());

  for (const abbreviation of abbreviations) {
    text = text.replace(new RegExp(`\\b${abbreviation}\\b`, 'gi'), abbreviation);
  }

  return text;
}
