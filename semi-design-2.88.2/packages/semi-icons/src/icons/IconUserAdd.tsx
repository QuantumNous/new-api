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
            <g clipPath="url(#clip_user_add)">
                <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M19.08 19.84c-1.38-2.24-4.32-4.34-8.62-4.34-4.3 0-7.24 2.1-8.62 4.34C1.2 20.88 2.1 22 3.34 22h14.24c1.23 0 2.14-1.12 1.5-2.16Z"
                    fill="currentColor"
                />
                <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M14.05 10.42c.52-.21 1.02-.86 1.25-1.7.3-1.11.23-2.1-.57-2.4C14.65 2.48 13.13 1 9.96 1 6.78 1 5.27 2.48 5.19 6.32c-.8.3-.86 1.29-.57 2.4.23.84.73 1.49 1.25 1.7.84 2.15 2.37 3.6 4.09 3.6 1.72 0 3.25-1.45 4.09-3.6Z"
                    fill="currentColor"
                />
                <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M20 1a1 1 0 0 0-1 1v2h-2a1 1 0 0 0 0 2h2v2a1 1 0 0 0 2 0V6h2a1 1 0 1 0 0-2h-2V2a1 1 0 0 0-1-1Z"
                    fill="currentColor"
                />
            </g>
            <defs>
                <clipPath id="clip_user_add">
                    <rect width={24} height={24} fill="currentColor" />
                </clipPath>
            </defs>
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'user_add');
export default IconComponent;
