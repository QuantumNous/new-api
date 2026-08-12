import { Button } from '@base-ui/react/button';

<Button />;
<Button type="submit" form="form-id" name="action" />;

<Button nativeButton={false} render={<span />} />;
<Button nativeButton={false} render={(props) => <div {...props} />} />;
<Button nativeButton={false} disabled render={<span />} />;

<Button nativeButton={false} type="submit" />;
