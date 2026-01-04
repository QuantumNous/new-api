import * as React from 'react';
import { convertIcon } from '../components/Icon';
function SvgComponent(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            focusable={false}
            aria-hidden={true}
            {...props}
        >
            <path
                d="M6.94 8.66a.2.2 0 0 0-.26-.14A7.5 7.5 0 1 0 16.9 16.7a.2.2 0 0 0-.2-.23h-2.65a.2.2 0 0 0-.2.16 4.5 4.5 0 1 1-6.35-5.19.2.2 0 0 0 .11-.24l-.67-2.54Z"
                fill="#4CC3FA"
            />
            <path d="M13 3a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" fill="#6A6F7F" />
            <path
                d="M9.7 13.8a2 2 0 0 0 2 1.5h5.9c.1 0 .18.06.2.16l1.38 6.03a1.75 1.75 0 1 0 3.42-.78l-1.83-7.97a1.75 1.75 0 0 0-1.1-1.25 2 2 0 0 0-.85-.19h-5.47a.2.2 0 0 1-.19-.15l-.23-.9a.2.2 0 0 1 .2-.25h3.62a1.25 1.25 0 1 0 0-2.5h-4.52l-.13-.51a2 2 0 1 0-3.88.99l1.49 5.81Z"
                fill="#6A6F7F"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'wheel-chair');
export default IconComponent;
