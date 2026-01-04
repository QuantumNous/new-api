import haveUedDocComponents from './haveUedDocComponents';

const getSite=()=>{
    const currentUrlSplit=window.location.pathname.split('/').filter(s=>s);
    const site=currentUrlSplit[0]==='design'?'design':'main';
    return site;
};



const getAnotherSideUrl=(site: 'design'|'main')=>{
    const currentUrlSplit=window.location.pathname.split('/').filter(s=>s);
    const url=currentUrlSplit.slice(currentUrlSplit.length-2);
    const locale=/zh-CN/.test(window.location.pathname)?'zh-CN':'en-US';
    if (site==='main') {
        return `${window.location.origin}/${locale}/${url[0]}/${url[1]}`;
    } else {
        return `${window.location.origin}/design/${locale}/${url[0]}/${url[1]}`;
    }
};


const cache={ scrollHeight: null };

const transContent=(site: 'main'|'design')=>{
    const url=`${getAnotherSideUrl('design')}?concisemode=true`;
    const mainSiteContentDOM= document.querySelector('.main-article') as HTMLDivElement;
    if (site==='design') {
        mainSiteContentDOM.style['display']='none';
        let iframeContainer=document.querySelector('#iframeContainer') as HTMLDivElement;
        if (iframeContainer) {
            iframeContainer.style['display']='block';
            iframeContainer.style['margin-bottom']='120px';
            const iframeDOM=iframeContainer.querySelector('iframe');
            if (iframeDOM.getAttribute('src')!==url) {
                iframeDOM.setAttribute('src', url);
            }
            if (cache.scrollHeight) {
                iframeContainer.style['height']=cache['scrollHeight'];
                iframeDOM.style['height']=cache['scrollHeight'];
            }
        } else {
            iframeContainer=document.createElement('div') as HTMLDivElement;
            iframeContainer.setAttribute('class', 'iframeContainer');
            iframeContainer.setAttribute('id', 'iframeContainer');
            const iframeDOM=document.createElement('iframe');
            iframeDOM.setAttribute('src', url);
            iframeDOM.setAttribute('scrolling', 'no');
            window.addEventListener('message', e=>{
                console.log('message', e.data);
                try {
                    const data=JSON.parse(e.data);
                    if (data['scrollHeight']) {
                        // @ts-ignore
                        window.syncThemeToIframe && window.syncThemeToIframe();
                        iframeDOM.style['height']=`${data['scrollHeight']}px`;
                        iframeContainer.style['height']=`${data['scrollHeight']}px`;
                        console.log('height===>', data['scrollHeight']);
                        cache['scrollHeight']=`${data['scrollHeight']}px`;
                        // @ts-ignore
                        iframeDOM?.contentWindow?.semidoc?.setDarkmode(document.body.getAttribute('theme-mode')==='dark');
                    }
                } catch (e) {
                    console.log('getMessage ====>', e);
                }
            });
            iframeContainer.prepend(iframeDOM);

            const contentAreaDOM=document.querySelector('.article-wrapper');
            contentAreaDOM.appendChild(iframeContainer);

        }



    } else {
        mainSiteContentDOM.style['display']='block';
        const iframeContainer=document.querySelector('#iframeContainer') as HTMLDivElement;
        iframeContainer.style['display']='none';
    }
};

const isHaveUedDocs=(pathName: string)=>{

    if (pathName) {
        const urlSplitArray=pathName.split('/').filter(v=>v);
        const componentName=urlSplitArray[urlSplitArray.length-1];
        return haveUedDocComponents.includes(componentName);
    }
    return false;
};

const isJumpToDesignSite=(pathName: string)=>{
    const components=['toast', 'popconfirm', 'scrolllist', 'popover', 'select', 'dropdown', 'treeselect'];
    if (pathName) {
        const urlSplitArray=pathName.split('/').filter(v=>v);
        const componentName=urlSplitArray[urlSplitArray.length-1];
        return components.includes(componentName);
    }
    return false;
};

export {
    isHaveUedDocs,
    isJumpToDesignSite,
    getAnotherSideUrl
};

export default transContent;


