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
                    d="M2 19.5c0-.83.67-1.5 1.5-1.5h6a1.5 1.5 0 0 1 0 3h-6A1.5 1.5 0 0 1 2 19.5Z"
                    fill="currentColor"
                />
                <path d="M2 12c0-.83.67-1.5 1.5-1.5h11a1.5 1.5 0 0 1 0 3h-11A1.5 1.5 0 0 1 2 12Z" fill="currentColor" />
                <path
                    d="M2 4.5C2 3.67 2.67 3 3.5 3h17a1.5 1.5 0 0 1 0 3h-17A1.5 1.5 0 0 1 2 4.5Z"
                    fill="currentColor"
                />
            </g>
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'descend');
export default IconComponent;
