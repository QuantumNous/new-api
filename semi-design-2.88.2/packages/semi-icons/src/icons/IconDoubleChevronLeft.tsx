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
                d="M12.62 4.4c.5.53.5 1.38 0 1.91L7.14 12l5.48 5.69c.5.53.5 1.38 0 1.91-.51.53-1.33.53-1.84 0l-6.4-6.64a1.4 1.4 0 0 1 0-1.92l6.4-6.64c.5-.53 1.33-.53 1.84 0Z"
                fill="currentColor"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M19.62 4.4c.5.53.5 1.38 0 1.91L14.14 12l5.48 5.69c.5.53.5 1.38 0 1.91-.51.53-1.34.53-1.84 0l-6.4-6.64a1.4 1.4 0 0 1 0-1.92l6.4-6.64c.5-.53 1.33-.53 1.84 0Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'double_chevron_left');
export default IconComponent;
