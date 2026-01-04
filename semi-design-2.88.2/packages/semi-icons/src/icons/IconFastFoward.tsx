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
                d="M1 5.96a1 1 0 0 1 1.59-.8l8.3 6.03a1 1 0 0 1 0 1.62l-8.3 6.03a1 1 0 0 1-1.59-.8V5.96Z"
                fill="currentColor"
            />
            <path
                d="M12 5.96a1 1 0 0 1 1.59-.8l8.3 6.03a1 1 0 0 1 0 1.62l-8.3 6.03a1 1 0 0 1-1.59-.8V5.96Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'fast_foward');
export default IconComponent;
