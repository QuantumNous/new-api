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
                d="M12 23a11 11 0 1 0 0-22 11 11 0 0 0 0 22Zm5.88-13.18-6.2 7.6a1.5 1.5 0 0 1-2.37 0l-3.5-4a1.5 1.5 0 1 1 2.37-1.84l2.3 2.46L15.5 8a1.5 1.5 0 1 1 2.38 1.82Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'tick_circle');
export default IconComponent;
