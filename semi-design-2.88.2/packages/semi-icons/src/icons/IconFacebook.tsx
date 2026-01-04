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
                d="M20.89 2H3.1C2.5 2 2 2.5 2 3.11V20.9C2 21.5 2.5 22 3.11 22h9.57v-7.73h-2.6v-3.03h2.6V9.02c0-2.59 1.58-4 3.9-4 .77 0 1.55.04 2.32.12v2.7h-1.6c-1.25 0-1.5.6-1.5 1.47v1.92h3l-.38 3.03H15.8V22h5.08c.61 0 1.11-.5 1.11-1.11V3.1C22 2.5 21.5 2 20.89 2Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'facebook');
export default IconComponent;
