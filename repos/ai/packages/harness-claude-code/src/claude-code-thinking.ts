export type ClaudeCodeThinkingConfig =
  | {
      readonly type: 'adaptive' | 'enabled';
      readonly display?: 'summarized' | 'omitted';
    }
  | {
      readonly type: 'disabled';
    };
