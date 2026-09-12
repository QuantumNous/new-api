/// <reference types="@testing-library/jest-dom/vitest" />
import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);
