import React from 'react';
import { render } from '@testing-library/react';
import App from './App';

import './i18n';

test('renders learn react link', () => {
  const { container } = render(<App />);

  expect(container).toBeInTheDocument();
});
