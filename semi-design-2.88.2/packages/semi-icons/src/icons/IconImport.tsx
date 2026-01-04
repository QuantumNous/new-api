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
            <path d="M10.5 7V2.5a1.5 1.5 0 0 1 3 0V7h-.09a1.5 1.5 0 0 0-2.82 0h-.09Z" fill="currentColor" />
            <path
                d="M10.5 7H5a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V10a3 3 0 0 0-3-3h-5.5v6.38l1.44-1.44a1.5 1.5 0 0 1 2.12 2.12l-4 4a1.5 1.5 0 0 1-2.12 0l-4-4a1.5 1.5 0 0 1 2.12-2.12l1.44 1.44V7Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'import');
export default IconComponent;
