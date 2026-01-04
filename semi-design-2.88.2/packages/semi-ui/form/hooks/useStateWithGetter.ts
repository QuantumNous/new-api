import { useRef, useState } from 'react';
// https://github.com/facebook/react/issues/14543
export default function useStateWithGetter(initial?: any) {
    const ref = useRef(undefined);
    const [state, setState] = useState(initial);
    ref.current = state;
    const set = (value: any) => {
        ref.current = value;
        setState(value);
    };
    const get = () => ref.current;
    return [state, set, get];
}
