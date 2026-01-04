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
            <path d="M14.5 5.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z" fill="currentColor" />
            <path d="M2 12c0-.83.67-1.5 1.5-1.5h17a1.5 1.5 0 0 1 0 3h-17A1.5 1.5 0 0 1 2 12Z" fill="currentColor" />
            <path d="M12 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" fill="currentColor" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'divide');
export default IconComponent;
