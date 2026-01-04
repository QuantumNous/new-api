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
                d="M11.94 2c.83 0 1.5.67 1.5 1.5v9.38l2.38-2.38a1.5 1.5 0 0 1 2.12 2.12L13 17.56a1.5 1.5 0 0 1-2.12 0L5.82 12.5a1.5 1.5 0 1 1 2.12-2.12l2.5 2.5V3.5c0-.83.67-1.5 1.5-1.5Z"
                fill="currentColor"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M4.44 22a1.5 1.5 0 0 1 0-3h15a1.5 1.5 0 1 1 0 3h-15Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'align_bottom');
export default IconComponent;
