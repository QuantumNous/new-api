import * as React from 'react';
import { convertIcon } from '../components/Icon';
function SvgComponent(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 22 22"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            focusable={false}
            aria-hidden={true}
            {...props}
        >
            <path
                d="m3.6 15.57.84-2.64h4.13l.85 2.64H12L8.07 4H4.95L1 15.57h2.6Zm1.45-4.55 1.41-4.38h.1l1.4 4.38h-2.9Z"
                fill="currentColor"
            />
            <path
                d="M16.8 19c2.46 0 4.2-1.13 4.2-3.35V6.9h-2.36v1.46h-.1a2.54 2.54 0 0 0-2.44-1.57c-1.89 0-3.48 1.48-3.48 4.43 0 2.89 1.55 4.23 3.48 4.23 1.37 0 2.14-.7 2.45-1.41h.1v1.59c0 1.19-.76 1.65-1.79 1.65-1.05 0-1.58-.46-1.77-.99l-2.2.3c.28 1.37 1.6 2.42 3.92 2.42Zm.06-5.37c-1.17 0-1.8-.93-1.8-2.43 0-1.47.62-2.5 1.8-2.5 1.15 0 1.8.98 1.8 2.5 0 1.53-.66 2.43-1.8 2.43Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'typograph');
export default IconComponent;
