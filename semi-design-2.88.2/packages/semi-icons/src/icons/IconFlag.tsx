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
                d="M22 3.62v10.76c0 .38-.21.73-.56.87-.74.3-2.09.75-3.44.75-2 0-3.5-.5-5-1-.31-.1-.58-.2-.84-.3-.98-.39-1.79-.7-4.16-.7-1.27 0-2.27.18-3 .38v6.12a1.5 1.5 0 0 1-3 0V3.58c0-.36.2-.69.51-.85C3.57 2.18 6.08 1 8 1c2.5 0 3.2.3 4.15.68L13 2c1.5.5 3 1 5 1 .89 0 1.78-.2 2.5-.42.7-.22 1.5.3 1.5 1.04Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'flag');
export default IconComponent;
