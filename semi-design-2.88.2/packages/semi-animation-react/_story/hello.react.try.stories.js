import React from 'react';
import { storiesOf } from '@storybook/react';
import { withKnobs, text, boolean } from '@storybook/addon-knobs';

import { Button } from '@douyinfe/semi-ui';

const stories = storiesOf('semi-animation-react/Animation', module);

stories.addDecorator(withKnobs);

stories.add('withText', () => <Button>Hello Button</Button>);

stories.add('withEmoji', () => (
    <button>
        <span role="img" aria-label="so cool">
            1
        </span>
    </button>
));
