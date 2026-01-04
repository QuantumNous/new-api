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
                d="M1.22 20.77a4.24 4.24 0 0 1 .02-5.98l9.33-9.28-.94-.95a1.41 1.41 0 0 1 0-1.99 1.39 1.39 0 0 1 1.97 0l.95.97L14.9 1.2a4.16 4.16 0 0 1 5.89.02 4.24 4.24 0 0 1-.02 5.98l-2.3 2.28 1.02 1.02c.54.55.54 1.44 0 1.99-.55.55-1.43.55-1.97 0l-1.03-1.03-9.37 9.32a4.16 4.16 0 0 1-5.89-.02ZM12.54 7.49l1.97 1.99-9.35 9.3c-.55.55-1.42.55-1.97 0a1.41 1.41 0 0 1 .01-2l9.34-9.29Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'eyedropper');
export default IconComponent;
