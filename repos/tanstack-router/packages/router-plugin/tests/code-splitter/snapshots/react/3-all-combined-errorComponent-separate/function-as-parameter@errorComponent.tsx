import * as React from 'react';
// @ts-expect-error
import { useMemo } from 'tan-react';
const useUsedVar = 'i-am-unused';
const ReactUseMemoCall1 = React.useMemo(function performAction() {
  return 'true';
}, []);
console.info(ReactUseMemoCall1);
const ReactUseMemoCall2 = React.useMemo(() => {
  return 'true';
}, []);
console.info(ReactUseMemoCall2);
const UseMemoCall1 = useMemo(function performAction() {
  return 'true';
}, []);
console.info(UseMemoCall1);
const UseMemoCall2 = useMemo(() => {
  return 'true';
}, []);
console.info(UseMemoCall2);