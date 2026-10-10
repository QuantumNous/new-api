import { Radio } from '@base-ui/react/radio';

const value = 'a';

<Radio.Root value={value} />;
<Radio.Root value={1} />;
<Radio.Root value={null} />;

<Radio.Root<string | null> value={null} />;

// @ts-expect-error value must match explicit generic type
<Radio.Root<'a' | 'b'> value="c" />;
