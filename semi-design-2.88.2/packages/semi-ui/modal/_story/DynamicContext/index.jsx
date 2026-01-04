import React, { useContext } from 'react';
import { Modal, Button } from '../../../index';

import Context from './context';

const FormattedMessage = ({ id }) => {
    const context = useContext(Context);

    return context ? context[id] : null;
};

export default function Demo() {
    return (
        <div>
            <Button
                onClick={() =>
                    Modal.confirm({
                        getContainerContext: () => ({
                            Provider: Context.Provider,
                            value: { attr1: 'attr1' },
                        }),
                        content: <FormattedMessage id={'attr1'} />,
                    })
                }
            >
                Click Me
            </Button>
        </div>
    );
}
