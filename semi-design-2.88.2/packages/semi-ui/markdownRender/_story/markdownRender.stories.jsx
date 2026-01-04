import MarkdownRender from '../index';
import * as semiComponents from "../components/index"
export default {
    title: 'MarkdownRender'
}


export const Basic = ()=>{
    return <MarkdownRender raw={"# Two 🍰 is: {Math.PI * 2}"} components={semiComponents}/>
}

export const A = ()=>{
    return  <MarkdownRender raw={"[Semi Design](https://semi.design)"} components={semiComponents}/>
}

export const Image = ()=>{
    return <MarkdownRender raw={"![Semi Design](https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/colorful.jpg)"} components={semiComponents}/>
}

export const li = ()=>{
    return <MarkdownRender raw={`
- 列表1
- 列表2
- 列表3
    `} components={semiComponents}/>
}
export const Table = ()=>{
    return <MarkdownRender raw={`
| a | b  |  c |  d  |
| - | :- | -: | :-: |
| 1 | 2 | 3 | 4 |
| 21 | 22 | 23 | 24 |
| 31 | 32 | 33 | 34 |
| 41 | 42 | 43 | 44 |
    `} components={semiComponents}/>
}

export const TableWithBoldHeader = ()=>{
    return <MarkdownRender raw={`
| a | **b**  |  c |  **d**  |
| - | :- | -: | :-: |
| 1 | 2 | 3 | 4 |
| 11 | 22 | 33 | 44 |
| 111 | 222 | 333 | 444 |
| 1111 | 2222 | 3333 | 4444 |
    `} components={semiComponents}/>
}

export const TableWithComponentHeader = ()=>{
    return <MarkdownRender raw={`
| a | <h1>b</h1>  |  c |  **d**  |
| - | :- | -: | :-: |
| 1 | 2 | 3 | 4 |
| 11 | 22 | 33 | 44 |
| 111 | 222 | 333 | 444 |
| 1111 | 2222 | 3333 | 4444 |
    `} components={semiComponents} format="mdx"/>
}

export const TableWithComponent = ()=>{
    return <MarkdownRender raw={`
| a | <h1>b</h1>  |  c |  **d**  |
| - | :- | -: | :-: |
| 1 | 2 | 3 | 4 |
| 11 | <h4>22</h4> | <h3>33</h3> | <h2>44</h2> |
| <h3>111</h3> | ![Semi Design](https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/colorful.jpg) | 333 | <h2>444</h2> |
| 1111 | 2222 | 3333 | 4444 |
    `} components={semiComponents} format="mdx"/>
}

export const WithSymbol = ()=>{
    return <MarkdownRender raw={`
test \\\\{ cxode } test
    `} components={semiComponents} format={"md"}/>
}

