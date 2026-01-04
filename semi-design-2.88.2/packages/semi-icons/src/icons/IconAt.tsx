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
                fillRule="evenodd"
                clipRule="evenodd"
                d="M4 12a8 8 0 1 1 15.53 2.7l-.08.13c-.27.39-.67.67-1.45.67-.33 0-.63-.13-.9-.5l-.1-.15V9.5a1.5 1.5 0 0 0-2.57-1.05 5 5 0 1 0 0 8.1l.22.19.01.01c.82 1.13 2.01 1.75 3.34 1.75a4.57 4.57 0 0 0 4.27-2.54c.53-1.05.73-2.28.73-3.46h-.01L23 12a11 11 0 1 0-8.69 10.76 1.5 1.5 0 1 0-.62-2.94A8 8 0 0 1 4 12Zm9.5.5a2 2 0 1 0-4 0 2 2 0 0 0 4 0Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'at');
export default IconComponent;
