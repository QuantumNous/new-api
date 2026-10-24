import React from 'react';
import { importedLoader, importedComponent } from '../../shared/imported';
const SplitLoader = importedLoader;
export { SplitLoader as loader };
const SplitComponent = React.memo(importedComponent);
export { SplitComponent as component };