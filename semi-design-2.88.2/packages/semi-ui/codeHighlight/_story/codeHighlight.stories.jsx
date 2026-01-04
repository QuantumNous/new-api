import * as React from 'react'
import CodeHighlight from '../index';
export default {
    title: 'CodeHighlightBasic',
}

export const CodeHighlightBasic = () => {

    return <CodeHighlight language={"javascript"} code={
        `import * as React from 'react"
const Test = ()=>{
return <div>test</div>
}
        `
    }/>
}
