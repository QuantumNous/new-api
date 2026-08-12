'use client';
import * as React from 'react';
import { platform } from '@base-ui/utils/platform';
import { useTimeout } from '@base-ui/utils/useTimeout';

// Word Joiner is invisible and zero-width, so it forces a text mutation without shifting layout.
const LIVE_REGION_MARKER = '\u2060';
// Safari VoiceOver needed roughly 200ms to reliably notice the initial polite live-region change.
export const INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY = 200;

function findLastTextNode(root: HTMLElement): Text | null {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let lastTextNode: Text | null = null;

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    if (textNode.nodeValue !== '') {
      lastTextNode = textNode;
    }
  }

  return lastTextNode;
}

export function useInitialLiveRegionTextMutation<T extends HTMLElement>() {
  const timeout = useTimeout();
  const rootRef = React.useRef<T | null>(null);

  // Only the initial mounted announcement needs the marker; later text updates announce naturally.
  React.useEffect(() => {
    if (platform.os.ios) {
      return undefined;
    }

    const root = rootRef.current;
    if (root == null) {
      return undefined;
    }

    const textNode = findLastTextNode(root);
    if (textNode == null) {
      return undefined;
    }

    const originalValue = textNode.nodeValue ?? '';
    const markedValue = `${originalValue}${LIVE_REGION_MARKER}`;
    textNode.nodeValue = markedValue;

    timeout.start(INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY, () => {
      if (textNode.nodeValue === markedValue) {
        textNode.nodeValue = originalValue;
      }
    });

    return () => {
      timeout.clear();

      if (textNode.nodeValue === markedValue) {
        textNode.nodeValue = originalValue;
      }
    };
  }, [rootRef, timeout]);

  return rootRef;
}
