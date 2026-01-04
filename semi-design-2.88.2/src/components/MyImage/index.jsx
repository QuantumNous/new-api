import React from "react";

export default ({ width, height, src }) => {
    return ( 
        <img
            src={src}
            data-src={src}
            width={Number(width)}
            height={Number(height)}
        />
    );
};