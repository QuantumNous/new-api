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
                d="M4 21.59V3c0-1.1.9-2 2-2h12a2 2 0 0 1 2 2v18.59a1 1 0 0 1-1.7.7L12 16l-6.3 6.3a1 1 0 0 1-1.7-.71Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'bookmark');
export default IconComponent;
