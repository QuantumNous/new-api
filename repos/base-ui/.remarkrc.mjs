import { createRemarkConfig } from '@mui/internal-code-infra/remark';

export default createRemarkConfig({
  overrides: [
    {
      files: '**/*.{md,mdx}',
      rules: {
        // `[//]: # 'comment'` is used as a markdown comment idiom across the docs.
        'no-duplicate-headings': false,
        'no-unused-definitions': false,
        'no-empty-url': false,
        'no-undefined-references': false,
      },
    },
    {
      files: '.github/**/*.md',
      rules: {
        'mui-first-block-heading': false,
      },
    },
  ],
});
