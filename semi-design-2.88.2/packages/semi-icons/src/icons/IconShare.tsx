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
                d="M17.5 2A3.5 3.5 0 1 1 15 7.95l-5.13 3.11a3.5 3.5 0 0 1 .03 1.78l5.22 3.1A3.49 3.49 0 0 1 21 18.5a3.5 3.5 0 1 1-6.9-.85l-5.22-3.08A3.49 3.49 0 0 1 3 12a3.5 3.5 0 0 1 5.8-2.63l5.27-3.19A3.5 3.5 0 0 1 17.5 2Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'share');
export default IconComponent;
