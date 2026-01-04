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
                d="M12.94 2.94a5.74 5.74 0 1 1 8.12 8.12l-3.55 3.55-2.12-2.12 3.55-3.55a2.74 2.74 0 1 0-3.88-3.88l-3.55 3.55L9.39 6.5l3.55-3.55Zm-10 10 3.05-3.05L8.11 12l-3.05 3.05a2.74 2.74 0 0 0 3.88 3.88l3.05-3.05L14.11 18l-3.05 3.05a5.74 5.74 0 1 1-8.12-8.12Z"
                fill="currentColor"
            />
            <rect x={5.379} y={7.5} width={2} height={3.85} transform="rotate(-45 5.37866 7.5)" fill="currentColor" />
            <rect
                x={13.779}
                y={15.9}
                width={2}
                height={3.84773}
                transform="rotate(-45 13.7793 15.9005)"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'unlink');
export default IconComponent;
