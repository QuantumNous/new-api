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
                d="M2.44 2.44a1.5 1.5 0 0 0 0 2.12L6.88 9H4a1.5 1.5 0 0 0 0 3h6.5a1.5 1.5 0 0 0 1.5-1.5V4a1.5 1.5 0 0 0-3 0v2.88L4.56 2.44a1.5 1.5 0 0 0-2.12 0Z"
                fill="currentColor"
            />
            <path
                d="M20 12a1.5 1.5 0 0 1 0 3h-2.88l4.44 4.44a1.5 1.5 0 1 1-2.12 2.12L15 17.12V20a1.5 1.5 0 1 1-3 0v-6.5a1.5 1.5 0 0 1 1.5-1.5H20Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'shrink');
export default IconComponent;
