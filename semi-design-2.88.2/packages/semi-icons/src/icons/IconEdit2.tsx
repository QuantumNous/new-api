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
                d="m16.43 4.1 3.54 3.54 1.48-1.48c.55-.55.55-1.45 0-2L19.9 2.62a1.42 1.42 0 0 0-2 0L16.43 4.1Z"
                fill="currentColor"
            />
            <path
                d="m7.76 15.88 1.19-4.17a.7.7 0 0 1 .18-.3l6.24-6.25 3.54 3.54-6.24 6.24a.7.7 0 0 1-.3.18l-4.17 1.2a.35.35 0 0 1-.44-.44Z"
                fill="currentColor"
            />
            <path
                d="M7.97 9.78c-.28.29-.5.63-.64 1l-.05.17-1.19 4.17A2.35 2.35 0 0 0 9 18.02l4.17-1.18c.44-.13.84-.37 1.17-.7l4.8-4.8a.5.5 0 0 1 .86.36V21a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9.54a.5.5 0 0 1 .36.85L7.97 9.78Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'edit_2');
export default IconComponent;
