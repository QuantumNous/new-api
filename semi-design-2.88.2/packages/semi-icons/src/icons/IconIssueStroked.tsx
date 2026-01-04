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
            <g clipPath="url(#clip0_1477_35)">
                <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M4.13 4.13a11.1 11.1 0 0 1 15.74 0 11.1 11.1 0 0 1 0 15.74 11.1 11.1 0 0 1-15.74 0 11.1 11.1 0 0 1 0-15.74Zm1.6 1.6a8.84 8.84 0 0 1 12.55 0 8.84 8.84 0 0 1 0 12.55 8.84 8.84 0 0 1-12.56 0 8.84 8.84 0 0 1 0-12.56Z"
                    fill="currentColor"
                />
                <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 18.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z"
                    fill="currentColor"
                />
                <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 4.88c.62 0 1.13.5 1.13 1.12v8a1.13 1.13 0 0 1-2.26 0V6c0-.62.5-1.13 1.13-1.13Z"
                    fill="currentColor"
                />
            </g>
            <defs>
                <clipPath id="clip0_1477_35">
                    <rect width={24} height={24} fill="currentColor" />
                </clipPath>
            </defs>
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'issue_stroked');
export default IconComponent;
