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
                d="M19.63 8c.02.17.02.35.02.52 0 5.33-4.06 11.46-11.46 11.46-2.29 0-4.4-.66-6.19-1.8a8.07 8.07 0 0 0 5.97-1.67 4.04 4.04 0 0 1-3.76-2.8 4.29 4.29 0 0 0 1.82-.08A4.03 4.03 0 0 1 2.8 9.68v-.05c.54.3 1.16.49 1.82.51a4.02 4.02 0 0 1-1.25-5.38 11.46 11.46 0 0 0 8.3 4.21 4.03 4.03 0 0 1 6.87-3.68 7.96 7.96 0 0 0 2.56-.97c-.3.93-.93 1.72-1.77 2.22.81-.09 1.6-.31 2.32-.63-.55.8-1.23 1.51-2.02 2.09Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'twitter');
export default IconComponent;
