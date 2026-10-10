import '@testing-library/jest-dom';

import { jestPreviewConfigure } from 'jest-preview';

// Automatically preview failed tests to Jest Preview Dashboard
// https://www.jest-preview.com/blog/automatic-mode
jestPreviewConfigure({
  autoPreview: true,
});
