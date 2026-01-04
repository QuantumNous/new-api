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
                d="M8 4c1.46 0 2.82.39 4 1.07a8 8 0 1 1 0 13.86A8 8 0 1 1 8 4Zm8 14a6 6 0 1 0-3.97-10.5h2.59c.31.47.58.97.8 1.5H10.8c-.18.32-.34.65-.46 1h5.4c.13.48.21.99.24 1.5h-5.96a6.08 6.08 0 0 0 0 1h5.96a7.98 7.98 0 0 1-.23 1.5h-5.4c.11.35.27.68.45 1h4.62a7.97 7.97 0 0 1-.8 1.5h-2.59A5.98 5.98 0 0 0 16 18Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'similarity');
export default IconComponent;
