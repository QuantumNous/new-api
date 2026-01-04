import { BASE_CLASS_PREFIX } from '../base/constants';

const cssClasses = {
    TABS: `${BASE_CLASS_PREFIX}-tabs`,
    TABS_BAR: `${BASE_CLASS_PREFIX}-tabs-bar`,
    TABS_BAR_LINE: `${BASE_CLASS_PREFIX}-tabs-bar-line`,
    TABS_BAR_CARD: `${BASE_CLASS_PREFIX}-tabs-bar-card`,
    TABS_BAR_BUTTON: `${BASE_CLASS_PREFIX}-tabs-bar-button`,
    TABS_BAR_SLASH: `${BASE_CLASS_PREFIX}-tabs-bar-slash`,
    TABS_BAR_EXTRA: `${BASE_CLASS_PREFIX}-tabs-bar-extra`,
    TABS_TAB: `${BASE_CLASS_PREFIX}-tabs-tab`,
    TABS_TAB_ACTIVE: `${BASE_CLASS_PREFIX}-tabs-tab-active`,
    TABS_TAB_DISABLED: `${BASE_CLASS_PREFIX}-tabs-tab-disabled`,
    TABS_CONTENT: `${BASE_CLASS_PREFIX}-tabs-content`,
    TABS_CONTENT_ANIMATED: `${BASE_CLASS_PREFIX}-tabs-content-animated`,
    TABS_CONTENT_NO_ANIMATED: `${BASE_CLASS_PREFIX}-tabs-content-no-animated`,
    TABS_PANE: `${BASE_CLASS_PREFIX}-tabs-pane`,
    TABS_PANE_INACTIVE: `${BASE_CLASS_PREFIX}-tabs-pane-inactive`,
    TABS_PANE_ACTIVE: `${BASE_CLASS_PREFIX}-tabs-pane-active`,
    TABS_PANE_MOTION_OVERLAY: `${BASE_CLASS_PREFIX}-tabs-pane-motion-overlay`,
    TABS_PANE_ANIMATING: `${BASE_CLASS_PREFIX}-tabs-pane-animating`,
    "TABS_PANE_ANIMATE_LEFT_SHOW": `${BASE_CLASS_PREFIX}-tabs-pane-animate-leftShow`,
    "TABS_PANE_ANIMATE_RIGHT_SHOW": `${BASE_CLASS_PREFIX}-tabs-pane-animate-rightShow`,
    "TABS_PANE_ANIMATE_TOP_SHOW": `${BASE_CLASS_PREFIX}-tabs-pane-animate-topShow`,
    "TABS_PANE_ANIMATE_BOTTOM_SHOW": `${BASE_CLASS_PREFIX}-tabs-pane-animate-bottomShow`,
};

const numbers = {
    DEFAULT_ACTIVE_KEY: 1,
};

const strings = {
    TYPE_MAP: ['line', 'card', 'button', 'slash'],
    SIZE: ['small', 'medium', 'large'],
    POSITION_MAP: ['top', 'left']
};

export { cssClasses, numbers, strings };
