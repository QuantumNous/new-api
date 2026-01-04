import { BASE_CLASS_PREFIX } from "../base/constants";

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-hotKeys`,
} as const;

const strings = {
};

export { cssClasses, strings };
const keyCodeMap = {
    // alpha
    'a': 'KeyA', 'b': 'KeyB', 'c': 'KeyC', 'd': 'KeyD', 'e': 'KeyE',
    'f': 'KeyF', 'g': 'KeyG', 'h': 'KeyH', 'i': 'KeyI', 'j': 'KeyJ',
    'k': 'KeyK', 'l': 'KeyL', 'm': 'KeyM', 'n': 'KeyN', 'o': 'KeyO',
    'p': 'KeyP', 'q': 'KeyQ', 'r': 'KeyR', 's': 'KeyS', 't': 'KeyT',
    'u': 'KeyU', 'v': 'KeyV', 'w': 'KeyW', 'x': 'KeyX', 'y': 'KeyY',
    'z': 'KeyZ',

    // digit
    '0': 'Digit0', '1': 'Digit1', '2': 'Digit2', '3': 'Digit3',
    '4': 'Digit4', '5': 'Digit5', '6': 'Digit6', '7': 'Digit7', 
    '8': 'Digit8', '9': 'Digit9',

    // punctuation
    ' ': 'Space', 'enter': 'Enter', 'escape': 'Escape', 'backspace': 'Backspace',
    'tab': 'Tab', '-': 'Minus', '=': 'Equal', '[': 'BracketLeft',
    ']': 'BracketRight', '\\': 'Backslash', ';': 'Semicolon', 
    "'": 'Quote', '`': 'Backquote', ',': 'Comma', '.': 'Period',
    '/': 'Slash', '?': 'Slash', '!': 'Digit1', '@': 'Digit2',
    '#': 'Digit3', '$': 'Digit4', '%': 'Digit5', '^': 'Digit6',
    '&': 'Digit7', '*': 'Digit8', '(': 'Digit9', ')': 'Digit0',

    // arrow
    'arrowup': 'ArrowUp', 'arrowdown': 'ArrowDown',
    'arrowleft': 'ArrowLeft', 'arrowright': 'ArrowRight',

    // function
    'shift': 'ShiftLeft', 'control': 'ControlLeft', 'alt': 'AltLeft',
    'meta': 'MetaLeft', 'capslock': 'CapsLock', 'f1': 'F1', 
    'f2': 'F2', 'f3': 'F3', 'f4': 'F4', 'f5': 'F5', 'f6': 'F6', 
    'f7': 'F7', 'f8': 'F8', 'f9': 'F9', 'f10': 'F10', 'f11': 'F11', 
    'f12': 'F12', 'insert': 'Insert', 'delete': 'Delete', 'home': 'Home', 
    'end': 'End', 'pageup': 'PageUp', 'pagedown': 'PageDown',
    'numlock': 'NumLock', 'scrolllock': 'ScrollLock', 'pause': 'Pause',

    // numpad
    'numpad0': 'Numpad0', 'numpad1': 'Numpad1', 'numpad2': 'Numpad2',
    'numpad3': 'Numpad3', 'numpad4': 'Numpad4', 'numpad5': 'Numpad5',
    'numpad6': 'Numpad6', 'numpad7': 'Numpad7', 'numpad8': 'Numpad8',
    'numpad9': 'Numpad9', 'numpaddecimal': 'NumpadDecimal', 
    'numpaddivide': 'NumpadDivide', 'numpadmultiply': 'NumpadMultiply', 
    'numpadsubtract': 'NumpadSubtract', 'numpadadd': 'NumpadAdd', 
    'numpadenter': 'NumpadEnter',
};
export function keyToCode(key: KeyboardEvent["key"]) {
    return keyCodeMap[key.toLowerCase()] || undefined;
}

enum Keys {
    A = 'a', B = 'b', C = 'c', D = 'd', E = 'e',
    F = 'f', G = 'g', H = 'h', I = 'i', J = 'j',
    K = 'k', L = 'l', M = 'm', N = 'n', O = 'o',
    P = 'p', Q = 'q', R = 'r', S = 's', T = 't',
    U = 'u', V = 'v', W = 'w', X = 'x', Y = 'y',
    Z = 'z',

    Digit0 = '0', Digit1 = '1', Digit2 = '2', Digit3 = '3',
    Digit4 = '4', Digit5 = '5', Digit6 = '6', Digit7 = '7', 
    Digit8 = '8', Digit9 = '9',

    Space = ' ', Enter = 'enter', Escape = 'escape', Backspace = 'backspace',
    Tab = 'tab', Minus = '-', Equal = '=', BracketLeft = '[',
    BracketRight = ']', Backslash = '\\', Semicolon = ';', 
    Quote = "'", Backquote = '`', Comma = ',', Period = '.',
    Slash = '/', Exclamation = '!', At = '@', Hash = '#', 
    Dollar = '$', Percent = '%', Caret = '^', Ampersand = '&', 
    Asterisk = '*', LeftParenthesis = '(', RightParenthesis = ')',

    ArrowUp = 'arrowup', ArrowDown = 'arrowdown',
    ArrowLeft = 'arrowleft', ArrowRight = 'arrowright',

    Shift = 'shift', Control = 'control', Alt = 'alt',
    Meta = 'meta', CapsLock = 'capslock', F1 = 'f1', 
    F2 = 'f2', F3 = 'f3', F4 = 'f4', F5 = 'f5', F6 = 'f6', 
    F7 = 'f7', F8 = 'f8', F9 = 'f9', F10 = 'f10', F11 = 'f11', 
    F12 = 'f12', Insert = 'insert', Delete = 'delete', Home = 'home', 
    End = 'end', PageUp = 'pageup', PageDown = 'pagedown',
    NumLock = 'numlock', ScrollLock = 'scrolllock', Pause = 'pause',

    Numpad0 = 'numpad0', Numpad1 = 'numpad1', Numpad2 = 'numpad2',
    Numpad3 = 'numpad3', Numpad4 = 'numpad4', Numpad5 = 'numpad5',
    Numpad6 = 'numpad6', Numpad7 = 'numpad7', Numpad8 = 'numpad8',
    Numpad9 = 'numpad9', NumpadDecimal = 'numpaddecimal', 
    NumpadDivide = 'numpaddivide', NumpadMultiply = 'numpadmultiply', 
    NumpadSubtract = 'numpadsubtract', NumpadAdd = 'numpadadd', 
    NumpadEnter = 'numpadenter',
}


export { Keys };