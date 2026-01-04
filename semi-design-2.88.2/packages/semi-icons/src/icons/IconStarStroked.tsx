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
                d="M12 5.03 9.57 9.1c-.17.3-.46.5-.8.55l-4.3.79 3 3.46c.22.26.32.6.28.93l-.62 4.46 4.41-1.9c.3-.12.63-.12.92 0l4.4 1.9-.6-4.46c-.05-.34.05-.67.27-.93l3-3.46-4.3-.79a1.17 1.17 0 0 1-.8-.55L12 5.03Zm-1-2.46a1.16 1.16 0 0 1 2 0l3.03 5.07 5.51 1c.89.17 1.26 1.24.68 1.92l-3.8 4.4.77 5.71c.13.9-.78 1.6-1.61 1.23L12 19.5l-5.58 2.4a1.17 1.17 0 0 1-1.61-1.23l.78-5.7-3.8-4.4a1.17 1.17 0 0 1 .67-1.92l5.51-1L11 2.56Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'star_stroked');
export default IconComponent;
