import BaseFoundation, { DefaultAdapter } from "../base/foundation";
import lottie, { AnimationItem } from "lottie-web";
import { ArgsType } from "../collapse/foundation";

export interface LottieAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    getContainer: () => Element;
    getLoadParams: () => ArgsType<typeof lottie.loadAnimation>[0]
}

export interface LottieBaseProps {
    width?: string;
    height?: string;
    params: Partial<ArgsType<typeof lottie.loadAnimation>[0]>;
    getAnimationInstance?: (instance: AnimationItem|null) => void;
    getLottie?: (lottiePKG: typeof lottie) => void

}

export interface LottieBaseState {


}

class LottieFoundation <P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<LottieAdapter<P, S>, P, S> {

    animation: null|AnimationItem = null

    constructor(adapter: LottieAdapter<P, S>) {
        super({ ...LottieFoundation.defaultAdapter, ...adapter });
    }


    static getLottie = ()=>{
        return lottie;
    }

    init(lifecycle?: any) {
        super.init(lifecycle);
        this.animation = lottie.loadAnimation(this._adapter.getLoadParams());
        this.getProp("getAnimationInstance")?.(this.animation);
        this.getProp("getLottie")?.(LottieFoundation.getLottie());
    }

    handleParamsUpdate = ()=>{
        this.animation.destroy();
        this.animation = lottie.loadAnimation(this._adapter.getLoadParams());
        this.getProp("getAnimationInstance")?.(this.animation);
    }

    destroy() {
        super.destroy();
        this.animation.destroy();
    }




}

export default LottieFoundation;
