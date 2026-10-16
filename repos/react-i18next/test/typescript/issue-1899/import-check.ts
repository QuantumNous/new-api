/**
 * Issue #1899: Type errors when custom resources are declared
 * https://github.com/i18next/react-i18next/issues/1899
 *
 * This file imports from react-i18next to trigger TypeScript to check
 * the type definitions in index.d.ts with custom resources declared.
 */
import type { IcuTrans } from 'react-i18next';

// Just need to reference the type to trigger the check
export type _Check = typeof IcuTrans;
