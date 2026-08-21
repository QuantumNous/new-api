let set: Set<string>;
if (process.env.NODE_ENV !== 'production') {
  set = new Set<string>();
}

export function warn(...messages: string[]) {
  if (process.env.NODE_ENV !== 'production') {
    const messageKey = messages.join(' ');
    if (!set.has(messageKey)) {
      set.add(messageKey);
      console.warn(`Base UI: ${messageKey}`);
    }
  }
}
