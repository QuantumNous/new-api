/**
 * @ignore
 * some key-codes definition and utils from closure-library
 */

const keyCode = {
    /**
     * MAC_ENTER
     */
    MAC_ENTER: 3,
    /**
     * BACKSPACE
     */
    BACKSPACE: 8,
    /**
     * TAB
     */
    TAB: 9,
    /**
     * NUMLOCK on FF/Safari Mac
     */
    NUM_CENTER: 12, // NUMLOCK on FF/Safari Mac
    /**
     * ENTER
     */
    ENTER: 13,
    /**
     * SHIFT
     */
    SHIFT: 16,
    /**
     * CTRL
     */
    CTRL: 17,
    /**
     * ALT
     */
    ALT: 18,
    /**
     * PAUSE
     */
    PAUSE: 19,
    /**
     * CAPS_LOCK
     */
    CAPS_LOCK: 20,
    /**
     * ESC
     */
    ESC: 27,
    /**
     * SPACE
     */
    SPACE: 32,
    /**
     * PAGE_UP
     */
    PAGE_UP: 33, // also NUM_NORTH_EAST
    /**
     * PAGE_DOWN
     */
    PAGE_DOWN: 34, // also NUM_SOUTH_EAST
    /**
     * END
     */
    END: 35, // also NUM_SOUTH_WEST
    /**
     * HOME
     */
    HOME: 36, // also NUM_NORTH_WEST
    /**
     * LEFT
     */
    LEFT: 37, // also NUM_WEST
    /**
     * UP
     */
    UP: 38, // also NUM_NORTH
    /**
     * RIGHT
     */
    RIGHT: 39, // also NUM_EAST
    /**
     * DOWN
     */
    DOWN: 40, // also NUM_SOUTH
    /**
     * PRINT_SCREEN
     */
    PRINT_SCREEN: 44,
    /**
     * INSERT
     */
    INSERT: 45, // also NUM_INSERT
    /**
     * DELETE
     */
    DELETE: 46, // also NUM_DELETE
    /**
     * ZERO
     */
    ZERO: 48,
    /**
     * ONE
     */
    ONE: 49,
    /**
     * TWO
     */
    TWO: 50,
    /**
     * THREE
     */
    THREE: 51,
    /**
     * FOUR
     */
    FOUR: 52,
    /**
     * FIVE
     */
    FIVE: 53,
    /**
     * SIX
     */
    SIX: 54,
    /**
     * SEVEN
     */
    SEVEN: 55,
    /**
     * EIGHT
     */
    EIGHT: 56,
    /**
     * NINE
     */
    NINE: 57,
    /**
     * QUESTION_MARK
     */
    QUESTION_MARK: 63, // needs localization
    /**
     * A
     */
    A: 65,
    /**
     * B
     */
    B: 66,
    /**
     * C
     */
    C: 67,
    /**
     * D
     */
    D: 68,
    /**
     * E
     */
    E: 69,
    /**
     * F
     */
    F: 70,
    /**
     * G
     */
    G: 71,
    /**
     * H
     */
    H: 72,
    /**
     * I
     */
    I: 73,
    /**
     * J
     */
    J: 74,
    /**
     * K
     */
    K: 75,
    /**
     * L
     */
    L: 76,
    /**
     * M
     */
    M: 77,
    /**
     * N
     */
    N: 78,
    /**
     * O
     */
    O: 79,
    /**
     * P
     */
    P: 80,
    /**
     * Q
     */
    Q: 81,
    /**
     * R
     */
    R: 82,
    /**
     * S
     */
    S: 83,
    /**
     * T
     */
    T: 84,
    /**
     * U
     */
    U: 85,
    /**
     * V
     */
    V: 86,
    /**
     * W
     */
    W: 87,
    /**
     * X
     */
    X: 88,
    /**
     * Y
     */
    Y: 89,
    /**
     * Z
     */
    Z: 90,
    /**
     * META
     */
    META: 91, // WIN_KEY_LEFT
    /**
     * WIN_KEY_RIGHT
     */
    WIN_KEY_RIGHT: 92,
    /**
     * CONTEXT_MENU
     */
    CONTEXT_MENU: 93,
    /**
     * NUM_ZERO
     */
    NUM_ZERO: 96,
    /**
     * NUM_ONE
     */
    NUM_ONE: 97,
    /**
     * NUM_TWO
     */
    NUM_TWO: 98,
    /**
     * NUM_THREE
     */
    NUM_THREE: 99,
    /**
     * NUM_FOUR
     */
    NUM_FOUR: 100,
    /**
     * NUM_FIVE
     */
    NUM_FIVE: 101,
    /**
     * NUM_SIX
     */
    NUM_SIX: 102,
    /**
     * NUM_SEVEN
     */
    NUM_SEVEN: 103,
    /**
     * NUM_EIGHT
     */
    NUM_EIGHT: 104,
    /**
     * NUM_NINE
     */
    NUM_NINE: 105,
    /**
     * NUM_MULTIPLY
     */
    NUM_MULTIPLY: 106,
    /**
     * NUM_PLUS
     */
    NUM_PLUS: 107,
    /**
     * NUM_MINUS
     */
    NUM_MINUS: 109,
    /**
     * NUM_PERIOD
     */
    NUM_PERIOD: 110,
    /**
     * NUM_DIVISION
     */
    NUM_DIVISION: 111,
    /**
     * F1
     */
    F1: 112,
    /**
     * F2
     */
    F2: 113,
    /**
     * F3
     */
    F3: 114,
    /**
     * F4
     */
    F4: 115,
    /**
     * F5
     */
    F5: 116,
    /**
     * F6
     */
    F6: 117,
    /**
     * F7
     */
    F7: 118,
    /**
     * F8
     */
    F8: 119,
    /**
     * F9
     */
    F9: 120,
    /**
     * F10
     */
    F10: 121,
    /**
     * F11
     */
    F11: 122,
    /**
     * F12
     */
    F12: 123,
    /**
     * NUMLOCK
     */
    NUMLOCK: 144,
    /**
     * SEMICOLON
     */
    SEMICOLON: 186, // needs localization
    /**
     * DASH
     */
    DASH: 189, // needs localization
    /**
     * EQUALS
     */
    EQUALS: 187, // needs localization
    /**
     * COMMA
     */
    COMMA: 188, // needs localization
    /**
     * PERIOD
     */
    PERIOD: 190, // needs localization
    /**
     * SLASH
     */
    SLASH: 191, // needs localization
    /**
     * APOSTROPHE
     */
    APOSTROPHE: 192, // needs localization
    /**
     * SINGLE_QUOTE
     */
    SINGLE_QUOTE: 222, // needs localization
    /**
     * OPEN_SQUARE_BRACKET
     */
    OPEN_SQUARE_BRACKET: 219, // needs localization
    /**
     * BACKSLASH
     */
    BACKSLASH: 220, // needs localization
    /**
     * CLOSE_SQUARE_BRACKET
     */
    CLOSE_SQUARE_BRACKET: 221, // needs localization
    /**
     * WIN_KEY
     */
    WIN_KEY: 224,
    /**
     * MAC_FF_META
     */
    MAC_FF_META: 224, // Firefox (Gecko) fires this for the meta key instead of 91
    /**
     * WIN_IME
     */
    WIN_IME: 229,
};

export const ENTER_KEY = 'Enter';
export const TAB_KEY = 'Tab';
export const ESC_KEY = 'Escape';

export default keyCode;
