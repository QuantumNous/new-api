import React from "react";
import Typography from '../../';

const { Paragraph, Title, Text } = Typography;
export const HugeData = () => {
    return <div>

        {
            new Array(100).map((_, i)=>{
                return <div key={i}>
                    <Title heading={5} ellipsis={{ showTooltip: true }} style={{ width: 250 }}>
                        是一个很长很长很长很长5号标题
                    </Title>
                </div>;
            })
        }


    </div>;
};
