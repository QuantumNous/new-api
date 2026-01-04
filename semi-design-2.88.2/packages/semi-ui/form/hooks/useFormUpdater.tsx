import React, { useContext } from 'react';
import { FormUpdaterContext } from '../context';

export default function useFormUpdater() {
    return useContext(FormUpdaterContext);
}