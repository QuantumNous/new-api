import{p as V}from"./chunk-4BMEZGHF-CUeGRVOA.js";import{aE as y,aw as z,b7 as j,a6 as Q,T as Z,U as q,B as H,C as J,E as K,D as X,_ as p,P as F,$ as Y,F as tt,a7 as et,ab as at,ah as rt,Q as nt}from"./index-DSssgkDe.js";import{p as it}from"./radar-MK3ICKWK-C7v-GRj5.js";import{d as O}from"./arc-Ch4BrY91.js";import{o as st}from"./ordinal-Cboi1Yqb.js";import"./semi-ui-BzboE4fo.js";import"./react-core-D-iPSUlg.js";import"./i18n-2p4l59BO.js";import"./tools-VBDCZ6mn.js";import"./react-components-BnylIsR_.js";import"./_baseUniq-DwvQqV7M.js";import"./_basePickBy-eHwYWVrG.js";import"./clone-oQToDf-C.js";import"./init-Gi6I4Gst.js";function ot(t,a){return a<t?-1:a>t?1:a>=t?0:NaN}function lt(t){return t}function ct(){var t=lt,a=ot,m=null,o=y(0),u=y(z),x=y(0);function i(e){var r,l=(e=j(e)).length,g,w,h=0,c=new Array(l),n=new Array(l),v=+o.apply(this,arguments),A=Math.min(z,Math.max(-z,u.apply(this,arguments)-v)),f,T=Math.min(Math.abs(A)/l,x.apply(this,arguments)),$=T*(A<0?-1:1),d;for(r=0;r<l;++r)(d=n[c[r]=r]=+t(e[r],r,e))>0&&(h+=d);for(a!=null?c.sort(function(S,C){return a(n[S],n[C])}):m!=null&&c.sort(function(S,C){return m(e[S],e[C])}),r=0,w=h?(A-l*$)/h:0;r<l;++r,v=f)g=c[r],d=n[g],f=v+(d>0?d*w:0)+$,n[g]={data:e[g],index:r,value:d,startAngle:v,endAngle:f,padAngle:T};return n}return i.value=function(e){return arguments.length?(t=typeof e=="function"?e:y(+e),i):t},i.sortValues=function(e){return arguments.length?(a=e,m=null,i):a},i.sort=function(e){return arguments.length?(m=e,a=null,i):m},i.startAngle=function(e){return arguments.length?(o=typeof e=="function"?e:y(+e),i):o},i.endAngle=function(e){return arguments.length?(u=typeof e=="function"?e:y(+e),i):u},i.padAngle=function(e){return arguments.length?(x=typeof e=="function"?e:y(+e),i):x},i}var R=Q.pie,G={sections:new Map,showData:!1,config:R},k=G.sections,P=G.showData,pt=structuredClone(R),ut=p(()=>structuredClone(pt),"getConfig"),gt=p(()=>{k=new Map,P=G.showData,Y()},"clear"),dt=p(({label:t,value:a})=>{k.has(t)||(k.set(t,a),F.debug(`added new section: ${t}, with value: ${a}`))},"addSection"),ft=p(()=>k,"getSections"),mt=p(t=>{P=t},"setShowData"),ht=p(()=>P,"getShowData"),I={getConfig:ut,clear:gt,setDiagramTitle:Z,getDiagramTitle:q,setAccTitle:H,getAccTitle:J,setAccDescription:K,getAccDescription:X,addSection:dt,getSections:ft,setShowData:mt,getShowData:ht},vt=p((t,a)=>{V(t,a),a.setShowData(t.showData),t.sections.map(a.addSection)},"populateDb"),St={parse:p(async t=>{const a=await it("pie",t);F.debug(a),vt(a,I)},"parse")},yt=p(t=>`
  .pieCircle{
    stroke: ${t.pieStrokeColor};
    stroke-width : ${t.pieStrokeWidth};
    opacity : ${t.pieOpacity};
  }
  .pieOuterCircle{
    stroke: ${t.pieOuterStrokeColor};
    stroke-width: ${t.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${t.pieTitleTextSize};
    fill: ${t.pieTitleTextColor};
    font-family: ${t.fontFamily};
  }
  .slice {
    font-family: ${t.fontFamily};
    fill: ${t.pieSectionTextColor};
    font-size:${t.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${t.pieLegendTextColor};
    font-family: ${t.fontFamily};
    font-size: ${t.pieLegendTextSize};
  }
`,"getStyles"),xt=yt,wt=p(t=>{const a=[...t.entries()].map(o=>({label:o[0],value:o[1]})).sort((o,u)=>u.value-o.value);return ct().value(o=>o.value)(a)},"createPieArcs"),At=p((t,a,m,o)=>{F.debug(`rendering pie chart
`+t);const u=o.db,x=tt(),i=et(u.getConfig(),x.pie),e=40,r=18,l=4,g=450,w=g,h=at(a),c=h.append("g");c.attr("transform","translate("+w/2+","+g/2+")");const{themeVariables:n}=x;let[v]=rt(n.pieOuterStrokeWidth);v??(v=2);const A=i.textPosition,f=Math.min(w,g)/2-e,T=O().innerRadius(0).outerRadius(f),$=O().innerRadius(f*A).outerRadius(f*A);c.append("circle").attr("cx",0).attr("cy",0).attr("r",f+v/2).attr("class","pieOuterCircle");const d=u.getSections(),S=wt(d),C=[n.pie1,n.pie2,n.pie3,n.pie4,n.pie5,n.pie6,n.pie7,n.pie8,n.pie9,n.pie10,n.pie11,n.pie12],D=st(C);c.selectAll("mySlices").data(S).enter().append("path").attr("d",T).attr("fill",s=>D(s.data.label)).attr("class","pieCircle");let W=0;d.forEach(s=>{W+=s}),c.selectAll("mySlices").data(S).enter().append("text").text(s=>(s.data.value/W*100).toFixed(0)+"%").attr("transform",s=>"translate("+$.centroid(s)+")").style("text-anchor","middle").attr("class","slice"),c.append("text").text(u.getDiagramTitle()).attr("x",0).attr("y",-400/2).attr("class","pieTitleText");const M=c.selectAll(".legend").data(D.domain()).enter().append("g").attr("class","legend").attr("transform",(s,E)=>{const b=r+l,_=b*D.domain().length/2,B=12*r,U=E*b-_;return"translate("+B+","+U+")"});M.append("rect").attr("width",r).attr("height",r).style("fill",D).style("stroke",D),M.data(S).append("text").attr("x",r+l).attr("y",r-l).text(s=>{const{label:E,value:b}=s.data;return u.getShowData()?`${E} [${b}]`:E});const L=Math.max(...M.selectAll("text").nodes().map(s=>(s==null?void 0:s.getBoundingClientRect().width)??0)),N=w+e+r+l+L;h.attr("viewBox",`0 0 ${N} ${g}`),nt(h,g,N,i.useMaxWidth)},"draw"),Ct={draw:At},Rt={parser:St,db:I,renderer:Ct,styles:xt};export{Rt as diagram};
