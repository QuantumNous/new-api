import { expect, test } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import App from '../src/App';

test('renders the main page', () => {
  const testMessage = 'Rsbuild with React';
  render(<App />);
  expect(screen.getByText(testMessage)).toBeInTheDocument();
});
