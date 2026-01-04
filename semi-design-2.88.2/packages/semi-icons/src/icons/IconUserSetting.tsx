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
                d="M16.86 14.85c-.36.21-.81.21-1.17 0l-.11-.07a.64.64 0 0 0-.83.13 5 5 0 0 0-.7 1.23c-.13.3.01.62.3.78l.1.06a1.17 1.17 0 0 1 0 2.04l-.1.06a.64.64 0 0 0-.3.79 5.06 5.06 0 0 0 .7 1.22c.2.25.55.3.83.13l.1-.06a1.17 1.17 0 0 1 1.77 1.01v.13c0 .32.21.6.53.65a5 5 0 0 0 1.4 0 .63.63 0 0 0 .54-.65v-.13a1.17 1.17 0 0 1 1.76-1.01l.11.06c.28.16.63.12.83-.13a5 5 0 0 0 .7-1.23.64.64 0 0 0-.3-.78l-.1-.06a1.17 1.17 0 0 1 0-2.04l.1-.06a.64.64 0 0 0 .3-.78 5.04 5.04 0 0 0-.7-1.23.63.63 0 0 0-.83-.13l-.11.07a1.17 1.17 0 0 1-1.76-1.02v-.13c0-.32-.21-.6-.53-.65a5 5 0 0 0-1.41 0 .64.64 0 0 0-.53.65v.13c0 .42-.22.81-.59 1.02Zm2.73 4.73a1.82 1.82 0 1 0-1.82-3.15 1.82 1.82 0 0 0 1.82 3.15Z"
                fill="currentColor"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12.35 15.98 12 16c-1.98 0-3.74-1.66-4.71-4.14-.6-.25-1.18-1-1.44-1.97-.34-1.27-.28-2.4.65-2.76C6.6 2.71 8.34 1 12 1s5.4 1.71 5.5 6.13c.92.36 1 1.49.65 2.76-.26.97-.83 1.72-1.44 1.97l-.12.3a6.01 6.01 0 0 0-4.24 3.82ZM12.08 17H12c-3.85 0-7.2 1.2-8.87 2.95-.85.9.03 2.05 1.27 2.05h9.13a5.98 5.98 0 0 1-1.45-5Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'user_setting');
export default IconComponent;
