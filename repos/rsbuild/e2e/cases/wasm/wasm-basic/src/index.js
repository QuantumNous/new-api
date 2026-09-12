import { _Z4facti } from './factorial.wasm';

const factorial = _Z4facti;

document.querySelector('#root').innerHTML = factorial(3);
