export const generateSvgResponseFixture = {
  id: 'svg-gen-1',
  created: 1_713_374_400,
  data: [
    {
      svg: '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>',
      mime_type: 'image/svg+xml' as const,
    },
  ],
  usage: {
    total_tokens: 21,
    input_tokens: 12,
    output_tokens: 9,
  },
};

export const vectorizeSvgResponseFixture = {
  id: 'svg-vec-1',
  created: 1_713_374_460,
  data: [
    {
      svg: '<svg viewBox="0 0 4 4"><path d="M0 0L4 4"/></svg>',
      mime_type: 'image/svg+xml' as const,
    },
  ],
  usage: {
    total_tokens: 18,
    input_tokens: 11,
    output_tokens: 7,
  },
};
