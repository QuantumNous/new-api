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
                d="m3.48 6 2.5-2.5A1.77 1.77 0 1 0 3.48 1L.98 3.5A1.77 1.77 0 0 0 3.48 6Z"
                fill="currentColor"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 23a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm1.5-15v4.07L17 14a1.5 1.5 0 1 1-1.34 2.68l-4.33-2.34A1.5 1.5 0 0 1 10.5 13V8a1.5 1.5 0 0 1 3 0Z"
                fill="currentColor"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M18 3.5 20.5 6A1.77 1.77 0 0 0 23 3.5L20.5 1A1.77 1.77 0 1 0 18 3.5Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'alarm');
export default IconComponent;
