import React, { useContext } from 'react';
import { ArrayFieldContext } from '../context';

function useArrayFieldState() {
    const arrayFieldContext = useContext(ArrayFieldContext);
    return arrayFieldContext;
}

export default useArrayFieldState;
