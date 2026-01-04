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
            <g opacity={0.99}>
                <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M8 4.5a1.5 1.5 0 1 0-3 0v11.38l-1.44-1.44a1.5 1.5 0 0 0-2.12 2.12l4 4a1.5 1.5 0 0 0 2.12 0l4-4a1.5 1.5 0 0 0-2.12-2.12L8 15.88V4.5ZM13.5 3a1.5 1.5 0 0 0 0 3h8a1.5 1.5 0 0 0 0-3h-8ZM12 12c0-.83.67-1.5 1.5-1.5h8a1.5 1.5 0 0 1 0 3h-8A1.5 1.5 0 0 1 12 12Zm0 7.5c0-.83.67-1.5 1.5-1.5h8a1.5 1.5 0 0 1 0 3h-8a1.5 1.5 0 0 1-1.5-1.5Z"
                    fill="currentColor"
                />
            </g>
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'descend2');
export default IconComponent;
