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
                d="M6.17 12h-2.5a8.33 8.33 0 1 0 16.66 0h-2.5"
                stroke="#AAB2BF"
                strokeWidth={2}
                strokeLinejoin="round"
            />
            <path d="M12 20.33V7.83" stroke="#818A9B" strokeWidth={2} strokeLinejoin="round" />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 9.84a3.09 3.09 0 1 0 0-6.17 3.09 3.09 0 0 0 0 6.17Z"
                fill="#324350"
                stroke="#324350"
                strokeWidth={1.25}
                strokeLinejoin="round"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'anchor');
export default IconComponent;
