import { CSPProvider } from '@base-ui/react/csp-provider';
import { createTypes } from 'docs/src/utils/createTypes';

export const TypesCSPProvider = createTypes(import.meta.url, CSPProvider);
