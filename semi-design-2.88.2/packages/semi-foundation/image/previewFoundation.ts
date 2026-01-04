import BaseFoundation, { DefaultAdapter } from "../base/foundation";

export default class PreviewFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<Partial<DefaultAdapter>> {
    
    handleVisibleChange = (newVisible: boolean) => {
        const { visible, onVisibleChange } = this.getProps();
        if (!(visible in this.getProps())) {
            this.setState({
                visible: newVisible,
            });
        }
        onVisibleChange && onVisibleChange(newVisible);
    };

    handleCurrentIndexChange = (index: number) => {
        const { currentIndex, onChange } = this.getProps();
        if (!(currentIndex in this.getProps())) {
            this.setState({
                currentIndex: index,
            } as any);
        }
        onChange && onChange(index);
    };
    
}