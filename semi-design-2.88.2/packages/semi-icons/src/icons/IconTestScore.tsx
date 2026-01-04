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
                d="M19 1a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3c0-1.1.9-2 2-2h14ZM7 17.5a1 1 0 1 0 0 2h10a1 1 0 1 0 0-2H7Zm0-4a1 1 0 1 0 0 2h10a1 1 0 1 0 0-2H7ZM9.25 5a.75.75 0 0 0-.67.42l-2.5 5a.75.75 0 0 0 1.34.67l.42-.84h2.82l.42.84a.75.75 0 0 0 1.34-.68l-2.5-5A.75.75 0 0 0 9.25 5Zm.66 3.75H8.6l.66-1.32.66 1.32Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'test_score');
export default IconComponent;
