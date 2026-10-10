import { expect, test } from '@rstest/core';
import { render, screen } from '@testing-library/vue';
import App from '../src/App.vue';

test('renders the main page', () => {
  const testMessage = 'Rsbuild with Vue';
  render(App);
  expect(screen.getByText(testMessage)).toBeInTheDocument();
});
