import { Extension, RawCommands } from "@tiptap/core";

/**
 * 为什么需要这个扩展？
 * 此扩展用于管理和 SemiAIChatInput 有关的状态，避免 SemiAIChatInput 和其他扩展的行为冲突，举个例子：
 * 自定义的扩展需要通过 enter 实现快捷按键操作，会和 SemiAIChatInput 的发送热键有冲突，
 * 因此通过 editor 的 storage 存储 allowHotKeySend 的状态，扩展可以去设置这些状态，提示 SemiAIChatInput 是否需要响应热键
 * Why is this extension needed?
 * This extension is used to manage the state related to SemiAIChatInput and avoid behavioral conflicts between 
 * SemiAIChatInput and other extensions. For example:
 * Custom extensions require shortcut key operations via Enter, which conflicts with SemiAIChatInput's send hotkey.
 * Therefore, by storing the allowHotKeySend state in the editor's storage, 
 * the extension can set these states to indicate whether SemiAIChatInput needs to respond to hotkeys.
 */
const SemiStatusExtension = Extension.create({
    name: 'SemiAIChatInput',
    addStorage() {
        return { 
            allowHotKeySend: true,
        };
    },

    addCommands() {
        return {
            setAllowHotKeySendForSemiAIChatInput(allow: boolean) {
                return ({ storage }) => {
                    storage.SemiAIChatInput.allowHotKeySend = allow;
                };
            }
        } as Partial<RawCommands>;
    }
});

export default SemiStatusExtension;