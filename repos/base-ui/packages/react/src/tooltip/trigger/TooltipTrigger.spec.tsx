import type * as React from 'react';
import { Tooltip } from '@base-ui/react/tooltip';

// `props: any` will error
<Tooltip.Trigger render={(props) => <button type="button" {...props} />} />;
<Tooltip.Trigger render={(props) => <input {...props} />} />;
