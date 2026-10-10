import { expect, test } from '@rstest/core';
import { screen } from '@testing-library/dom';

test('test dom', () => {
  document.body.innerHTML = `
    <span data-testid="not-empty"><span data-testid="empty"></span></span>
    <div data-testid="visible">Visible Example</div>
  `;

  expect(screen.queryByTestId('not-empty')).toBeInTheDocument();
  expect(screen.getByText('Visible Example')).toBeVisible();
});
