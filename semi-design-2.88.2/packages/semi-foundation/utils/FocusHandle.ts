import { isHTMLElement } from "./dom";
import { without } from "lodash";


type FocusRedirectListener = (element: HTMLElement) => boolean;

interface HandleOptions {
    enable?: boolean;
    onFocusRedirectListener?: FocusRedirectListener | FocusRedirectListener[];
    preventScroll?: boolean
}

/*
* Usage:
*   // Eg1: Pass a dom as the tab tarp container.
*  const handle = new FocusTrapHandle(container, { enable: true });
*
*   // Eg2: The focus redirect listener will be triggered when user pressed tab whiling last focusable dom is focusing in trap dom, return false to cancel redirect and use the browser normal tab focus index.
*   handle.addFocusRedirectListener((e)=>{
*       return true; // return false to prevent redirect on target DOM;
*   });
*
*   // Eg3: Set it to false in order to disable tab tarp at any moment;
*   handle.enable = true;
*
*   // Eg4: Destroy instance when component is unmounting for saving resource;
*   handle.destroy();
*
* */

class FocusTrapHandle {
    public container: HTMLElement;
    private options: HandleOptions;
    private focusRedirectListenerList: FocusRedirectListener[];
    private _enable: boolean;

    constructor(container: HTMLElement, options?: HandleOptions) {
        Object.freeze(options); // prevent user to change options after init;
        this.container = container;
        this.options = options;
        this.enable = options?.enable ?? true;
        this.focusRedirectListenerList = (() => {
            if (options?.onFocusRedirectListener) {
                return Array.isArray(options.onFocusRedirectListener) ? [...options.onFocusRedirectListener] : [options.onFocusRedirectListener];
            } else {
                return [];
            }
        })();
        this.container.addEventListener('keydown', this.onKeyPress);
    }

    public addFocusRedirectListener = (listener: FocusRedirectListener) => {
        this.focusRedirectListenerList.push(listener);
        return () => this.removeFocusRedirectListener(listener);
    }

    public removeFocusRedirectListener = (listener: FocusRedirectListener) => {
        this.focusRedirectListenerList = without(this.focusRedirectListenerList, listener);
    }

    public get enable() {
        return this._enable;
    }

    public set enable(value) {
        this._enable = value;
    }

    public destroy = () => {
        this.container?.removeEventListener('keydown', this.onKeyPress);
    }

    // ---- private func ----

    private shouldFocusRedirect = (element: HTMLElement) => {
        if (!this.enable) {
            return false;
        }
        for (const listener of this.focusRedirectListenerList) {
            const should = listener(element);
            if (!should) {
                return false;
            }
        }
        return true;
    }

    private focusElement = (element: HTMLElement, event: KeyboardEvent) => {
        const { preventScroll } = this.options;
        element?.focus({ preventScroll });
        event.preventDefault(); // prevent browser default tab move behavior
    }


    private onKeyPress = (event: KeyboardEvent) => {
        if (event && event.key === 'Tab') {
            const focusableElements = FocusTrapHandle.getFocusableElements(this.container);
            const focusableNum = focusableElements.length;
            if (focusableNum) {
                // Shift + Tab will move focus backward
                if (event.shiftKey) {
                    this.handleContainerShiftTabKeyDown(focusableElements, event);
                } else {
                    this.handleContainerTabKeyDown(focusableElements, event);
                }
            }
        }
    }

    private handleContainerTabKeyDown = (focusableElements: any[], event: any) => {
        const activeElement = FocusTrapHandle.getActiveElement();
        const isLastCurrentFocus = focusableElements[focusableElements.length - 1] === activeElement;

        const redirectForcingElement = focusableElements[0];
        if (isLastCurrentFocus && this.shouldFocusRedirect(redirectForcingElement)) {
            this.focusElement(redirectForcingElement, event);
        }
    };


    private handleContainerShiftTabKeyDown = (focusableElements: any[], event: KeyboardEvent) => {
        const activeElement = FocusTrapHandle.getActiveElement();
        const isFirstCurrentFocus = focusableElements[0] === activeElement;
        const redirectForcingElement = focusableElements[focusableElements.length - 1];
        if (isFirstCurrentFocus && this.shouldFocusRedirect(redirectForcingElement)) {
            this.focusElement(redirectForcingElement, event);
        }
    };


    // ---- static func ----

    static getFocusableElements(node: HTMLElement) {
        if (!isHTMLElement(node)) {
            return [];
        }
        const focusableSelectorsList = [
            "input:not([disabled]):not([tabindex='-1'])",
            "textarea:not([disabled]):not([tabindex='-1'])",
            "button:not([disabled]):not([tabindex='-1'])",
            "a[href]:not([tabindex='-1'])",
            "select:not([disabled]):not([tabindex='-1'])",
            "area[href]:not([tabindex='-1'])",
            "iframe:not([tabindex='-1'])",
            "object:not([tabindex='-1'])",
            "*[tabindex]:not([tabindex='-1'])",
            "*[contenteditable]:not([tabindex='-1'])",
        ];
        const focusableSelectorsStr = focusableSelectorsList.join(',');
        // we are not filtered elements which are invisible
        return Array.from(node.querySelectorAll<HTMLElement>(focusableSelectorsStr));
    }

    static getActiveElement(): HTMLElement | null {
        return document ? document.activeElement as HTMLElement : null;
    }


}

export default FocusTrapHandle;
