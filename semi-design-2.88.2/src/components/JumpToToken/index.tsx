import React, { useEffect } from 'react';

const JumpToToken = (): React.ReactNode => {
    useEffect(() => {
        const job = (): void => {
            const token = (new URLSearchParams(window.location.search)).get('token');
            if (!token) {
                return;
            }
            const timer = setInterval(() => {
                try {
                    const targetDom: HTMLElement | null = document.querySelector(`[data-token=${token}]`);
                    if (targetDom) {
                        targetDom.scrollIntoView({
                            block: 'center'
                        });
                        const originBGColor = targetDom.style.backgroundColor;
                        targetDom.style.backgroundColor = 'yellow';
                        const removeBGColor = (): void => {
                            targetDom.style.backgroundColor = originBGColor;
                            window.removeEventListener('click', removeBGColor);
                            window.removeEventListener('touchend', removeBGColor);
                        };
                        window.addEventListener('click', removeBGColor);
                        window.addEventListener('touchend', removeBGColor);
                        clearInterval(timer);
                    }
                } catch (e) {
                    console.log('error', e);
                }
            }, 500);
            setTimeout(() => {
                clearInterval(timer);
            }, 5000);
        };
        if (document.readyState === 'loading') {
            window.addEventListener('load', job);
        } else {
            job();
        }
    }, []);
    return null;
};

export default JumpToToken;