import { describe, expect, test } from 'bun:test';

import {
  buildRouteManagerHubAvailabilitySignature,
  hasRouteManagerHubAvailabilityChanged,
} from './hubAvailability.js';

describe('route-manager hub availability helpers', () => {
  test('builds a stable signature for each availability combination', () => {
    expect(buildRouteManagerHubAvailabilitySignature()).toBe('0:0');
    expect(
      buildRouteManagerHubAvailabilitySignature({
        configured: true,
        reachable: false,
      }),
    ).toBe('1:0');
    expect(
      buildRouteManagerHubAvailabilitySignature({
        configured: true,
        reachable: true,
      }),
    ).toBe('1:1');
  });

  test('treats async hub status arrival as an availability change', () => {
    expect(
      hasRouteManagerHubAvailabilityChanged(undefined, {
        configured: true,
        reachable: true,
      }),
    ).toBe(true);
    expect(
      hasRouteManagerHubAvailabilityChanged(
        {
          configured: true,
          reachable: true,
        },
        {
          configured: true,
          reachable: true,
        },
      ),
    ).toBe(false);
    expect(
      hasRouteManagerHubAvailabilityChanged(
        {
          configured: true,
          reachable: true,
        },
        {
          configured: false,
          reachable: false,
        },
      ),
    ).toBe(true);
  });
});
