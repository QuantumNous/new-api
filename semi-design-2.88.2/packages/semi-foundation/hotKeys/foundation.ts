import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import { keyToCode, Keys } from './constants';

export interface HotKeysAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    notifyHotKey: (e: KeyboardEvent) => void;
    registerEvent: () => void;
    unregisterEvent: () => void
}

export default class HotKeysFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<HotKeysAdapter<P, S>, P, S> {
    constructor(adapter: HotKeysAdapter<P, S>) {
        super({ ...adapter });
    }

    init(): void {
        // init Listener
        this._adapter.registerEvent();
        const hotKeys = this.getProps().hotKeys;
        if (!this.isValidHotKeys(hotKeys)) {
            throw new Error('HotKeys must have one common key and 0/some modifier key');
        }   
    }

    isValidHotKeys = (hotKeys: string[]): boolean => {
        let commonKeyCnt = 0;
        const modifierKeys: string[] = [Keys.Meta, Keys.Alt, Keys.Shift, Keys.Control];

        hotKeys.forEach(key => {
            key = key.toLowerCase();
            if (!Object.values(Keys).some((value) => value === key)) {
                throw new Error(`${key} is not a valid key`);
            }
            if (!modifierKeys.includes(key)) {
                commonKeyCnt += 1;
            }
        });

        return commonKeyCnt === 1;
    }

    handleKeyDown = (event: KeyboardEvent): void => {
        const { mergeMetaCtrl: merged, hotKeys, preventDefault } = this.getProps();
        let allModifier = new Array(4).fill(false); // Meta Shift Alt Ctrl
        let clickedModifier = [event.metaKey, event.shiftKey, event.altKey, event.ctrlKey];
        const keysPressed = hotKeys?.map((key: KeyboardEvent["key"]) => {
            key = key.toLowerCase();
            if (key === Keys.Meta) {
                allModifier[0] = true;
                return event.metaKey; 
            } else if (key === Keys.Shift) {
                allModifier[1] = true;
                return event.shiftKey;
            } else if (key === Keys.Alt) {
                allModifier[2] = true;
                return event.altKey;
            } else if (key === Keys.Control) {
                allModifier[3] = true;
                return event.ctrlKey;
            }
            return event.code === keyToCode(key); 
        });

        if (!allModifier.every((value, index) => value === clickedModifier[index])) {
            return;
        }
        if (keysPressed.every(Boolean)) {
            if (preventDefault) {
                event.preventDefault();
            }
            this._adapter.notifyHotKey(event);
            return;
        }
        
    }

    destroy(): void {
        // remove Listener
        this._adapter.unregisterEvent();
    }
}
