import React, { useContext, useCallback } from 'react';
import useNotification from '../../useNotification';
import { Button, ConfigProvider } from '../../../index';
import Context from './context';

function App({ children, globalVars }) {
    return (
        <div data-cy="notice-container">
            <Context.Provider value={{ title: '1111', ...globalVars }}>{children}</Context.Provider>
        </div>
    );
}

export default function Demo() {
    const [notice, elements] = useNotification();
    const config = {
        content: 'Hello World',
        position: 'top',
        title: <Context.Consumer>{({ title }) => <strong>{title}</strong>}</Context.Consumer>,
        duration: 0,
    };

    const addNotice = () => {
        const id1 = notice.info(config);
        const id2 = notice.success(config);
        const id3 = notice.warning(config);
        const id4 = notice.error(config);
        const id5 = notice.open(config);

        // setTimeout(() => {
        //     notice.close(id5);
        // }, 1000);
    };

    return (
        <div>
            <App globalVars={{ title: '2222' }}>{elements}</App>
            <div>
                <Button onClick={addNotice}>Add Notice</Button>
            </div>
        </div>
    );
}
