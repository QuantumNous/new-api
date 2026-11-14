/**
 * @type {import('@mui/internal-code-infra/changelog').ChangelogConfig}
 */
export default {
  format: {
    version: 'v{{version}}',
    dateFormat: process.env.FORMAT === 'docs' ? '**MMM DD, YYYY**' : '_MMM DD, YYYY_',
    changelogMessage:
      process.env.FORMAT === 'docs'
        ? '{{flagPrefix}} {{message}} ([#{{prNumber}}]({{prUrl}}))'
        : '{{flagPrefix}} {{message}} (#{{prNumber}}) by @{{author}}',
  },

  filter: {
    // Exclude bot commits
    excludeCommitByAuthors: [/\[bot\]$/],

    // Exclude commits with certain labels
    excludeCommitWithLabels: [
      'internal',
      'dependencies',
      'scope: code-infra',
      'scope: docs-infra',
      'scope: support-infra',
      'test',
      'release',
      'docs',
      'website',
    ],
    excludeAuthorsFromContributors: ['Copilot'],
  },

  categorization: {
    strategy: 'component',

    labels: {
      component: {
        prefix: ['component:', 'hook:'],
      },
      // Category overrides - labels that force a specific section
      categoryOverrides: {
        'scope: all components': 'General changes',
        'component: otp field': 'OTP Field',
      },
      // Explicit flag labels
      flags: {
        'breaking change': {
          prefix: '🚨 **Breaking change:**',
        },
      },
    },

    sections: {
      order: {
        'General changes': -1,
      },
      fallbackSection: 'General changes',
    },
  },
};
