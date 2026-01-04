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
                d="M12 4.16a5.45 5.45 0 0 0-3.82-2.08 6.41 6.41 0 0 0-5.13 1.87A6.96 6.96 0 0 0 1 9.03a10.3 10.3 0 0 0 2.04 5.62c2.01 2.9 6.22 6.38 7.73 7.6.72.58 1.74.58 2.46 0 1.51-1.22 5.72-4.7 7.73-7.6A10.3 10.3 0 0 0 23 9.03a6.96 6.96 0 0 0-2.05-5.08 6.41 6.41 0 0 0-5.13-1.87c-1.44.14-2.83.8-3.82 2.08Zm-4.02-.09a4.41 4.41 0 0 0-3.5 1.27A4.96 4.96 0 0 0 3 9a8.32 8.32 0 0 0 1.68 4.52c1.81 2.6 5.75 5.9 7.32 7.16 1.57-1.26 5.5-4.55 7.32-7.16A8.32 8.32 0 0 0 21 8.99a4.96 4.96 0 0 0-1.48-3.65 4.41 4.41 0 0 0-3.5-1.27c-1.23.12-2.38.8-3 2.28-.38.9-1.66.9-2.04 0a3.51 3.51 0 0 0-3-2.28Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'heart_stroked');
export default IconComponent;
