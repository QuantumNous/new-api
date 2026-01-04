import React, { useState, useMemo } from 'react';
function cache(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.log(error);
    }
}

function getCache(key) {
    try {
        return JSON.parse(localStorage.getItem(key));
    } catch (error) {
        console.log(error);
        return undefined;
    }
}


const initialMode = { mode: getCache('semiMode') };
const ModeContext = React.createContext(initialMode);

const ModeProvider = ({ children }) => {
    const [mode, setMode] = useState(initialMode.mode);
    // handle mode switch
    const handleModeSwitch = mode => {
        const { body } = document;
        if (mode === 'light' && body.hasAttribute('theme-mode')) {
            body.removeAttribute('theme-mode');
        } else if (mode === 'dark') {
            body.setAttribute('theme-mode', 'dark');
        }
    };
    const modeContextValue = useMemo(() => {
        handleModeSwitch(mode);
        return { mode, setMode };
    }, [mode]);

    return (
        <ModeContext.Provider value={modeContextValue}>
            {children}
        </ModeContext.Provider>
    );
};

export {
    ModeProvider,
    ModeContext
};
