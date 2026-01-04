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
            <g clipPath="url(#clip0_2342_331)">
                <path
                    d="M12 20c.83 0 1.5.67 1.5 1.5v1a1.5 1.5 0 0 1-3 0v-1c0-.83.67-1.5 1.5-1.5Zm-7.78-2.34a1.5 1.5 0 1 1 2.12 2.12l-.7.7a1.5 1.5 0 0 1-2.13-2.12l.71-.7Zm13.44 0a1.5 1.5 0 0 1 2.12 0l.7.7a1.5 1.5 0 0 1-2.12 2.13l-.7-.71a1.5 1.5 0 0 1 0-2.12ZM12 5a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm-9.5 3.5a1.5 1.5 0 0 1 0 3h-1a1.5 1.5 0 0 1 0-3h1Zm20 0a1.5 1.5 0 0 1 0 3h-1a1.5 1.5 0 0 1 0-3h1ZM3.51 3.51a1.5 1.5 0 0 1 2.13 0l.7.71a1.5 1.5 0 1 1-2.12 2.12l-.7-.7a1.5 1.5 0 0 1 0-2.13Zm14.85 0a1.5 1.5 0 0 1 2.13 2.13l-.71.7a1.5 1.5 0 1 1-2.12-2.12l.7-.7ZM12 0c.83 0 1.5.67 1.5 1.5v1a1.5 1.5 0 0 1-3 0v-1c0-.83.67-1.5 1.5-1.5Z"
                    fill="currentColor"
                />
            </g>
            <defs>
                <clipPath id="clip0_2342_331">
                    <rect width={24} height={24} fill="currentColor" />
                </clipPath>
            </defs>
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'sun_stroked');
export default IconComponent;
