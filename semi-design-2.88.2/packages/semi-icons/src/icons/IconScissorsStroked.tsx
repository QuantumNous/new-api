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
                d="M20 18.5a1.5 1.5 0 1 0-2.84.67l.03.05.01.03a1.5 1.5 0 0 0 2.8-.75Zm-16 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0Zm18 0a3.5 3.5 0 0 1-6.61 1.6l-1-1.79-2.36-4.08-2.41 4.18-1.04 1.75a3.5 3.5 0 1 1-.19-3.63l2.48-4.3L5.88 3.6a1 1 0 0 1 1.73-1l4.42 7.64 4.35-7.54a1 1 0 0 1 1.74 1l-4.94 8.54 2.46 4.25A3.5 3.5 0 0 1 22 18.5Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'scissors_stroked');
export default IconComponent;
