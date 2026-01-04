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
                d="M12 23a11 11 0 1 0 0-22 11 11 0 0 0 0 22Zm3.35-11.3c-.7 1.77-1.94 2.95-3.35 2.95-1.4 0-2.66-1.18-3.35-2.94-.42-.18-.83-.7-1.02-1.4-.24-.9-.19-1.7.47-1.96C8.16 5.21 9.4 4 12 4c2.6 0 3.84 1.21 3.9 4.35.66.25.7 1.06.47 1.96-.19.7-.6 1.22-1.02 1.4Zm2.74 5.69c.52.29.56.98.11 1.36A9.52 9.52 0 0 1 12 21a9.52 9.52 0 0 1-6.2-2.25.82.82 0 0 1 .1-1.36A12.89 12.89 0 0 1 12 16c2.07 0 4.38.42 6.1 1.39Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'user_circle');
export default IconComponent;
