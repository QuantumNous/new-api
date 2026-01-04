import React, {useEffect, useState} from 'react';
import Lottie from "../index";


export default {
  title: 'Lottie',
  parameters: {
    chromatic: { disableSnapshot: true },
  },
}

export const BasicLottieAnimation = ()=>{
    const jsonURL = "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/icon-click.json";
    const [data,setData] = useState("");

    useEffect(() => {
        (async ()=>{
            const resp = await fetch(jsonURL);
            const json = await resp.json();
            setData(json)
        })()
    }, []);

    return <Lottie params={{animationData:data}} width={"300px"}  getAnimationInstance={(animation )=>{console.log(animation)}}/>
}


