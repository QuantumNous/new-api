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
                d="M12 23a1.5 1.5 0 0 1-1.5-1.5V6.12l-6.44 6.44a1.5 1.5 0 0 1-2.12-2.12l9-9a1.5 1.5 0 0 1 2.12 0l9 9a1.5 1.5 0 0 1-2.12 2.12L13.5 6.12V21.5c0 .83-.67 1.5-1.5 1.5Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'arrow_up');
export default IconComponent;
