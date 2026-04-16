import{p as k}from"./chunk-4BMEZGHF-CUeGRVOA.js";import{a6 as R,_ as l,B as E,C as I,T as _,U as D,D as F,E as P,P as G,a7 as y,a8 as C,$ as z,ab as B,ad as V}from"./index-DSssgkDe.js";import{p as W}from"./radar-MK3ICKWK-C7v-GRj5.js";import"./semi-ui-BzboE4fo.js";import"./react-core-D-iPSUlg.js";import"./i18n-2p4l59BO.js";import"./tools-VBDCZ6mn.js";import"./react-components-BnylIsR_.js";import"./_baseUniq-DwvQqV7M.js";import"./_basePickBy-eHwYWVrG.js";import"./clone-oQToDf-C.js";var h={showLegend:!0,ticks:5,max:null,min:0,graticule:"circle"},w={axes:[],curves:[],options:h},g=structuredClone(w),H=R.radar,j=l(()=>y({...H,...C().radar}),"getConfig"),b=l(()=>g.axes,"getAxes"),U=l(()=>g.curves,"getCurves"),N=l(()=>g.options,"getOptions"),X=l(a=>{g.axes=a.map(t=>({name:t.name,label:t.label??t.name}))},"setAxes"),Y=l(a=>{g.curves=a.map(t=>({name:t.name,label:t.label??t.name,entries:Z(t.entries)}))},"setCurves"),Z=l(a=>{if(a[0].axis==null)return a.map(e=>e.value);const t=b();if(t.length===0)throw new Error("Axes must be populated before curves for reference entries");return t.map(e=>{const r=a.find(s=>{var o;return((o=s.axis)==null?void 0:o.$refText)===e.name});if(r===void 0)throw new Error("Missing entry for axis "+e.label);return r.value})},"computeCurveEntries"),q=l(a=>{var e,r,s,o,i;const t=a.reduce((n,c)=>(n[c.name]=c,n),{});g.options={showLegend:((e=t.showLegend)==null?void 0:e.value)??h.showLegend,ticks:((r=t.ticks)==null?void 0:r.value)??h.ticks,max:((s=t.max)==null?void 0:s.value)??h.max,min:((o=t.min)==null?void 0:o.value)??h.min,graticule:((i=t.graticule)==null?void 0:i.value)??h.graticule}},"setOptions"),J=l(()=>{z(),g=structuredClone(w)},"clear"),$={getAxes:b,getCurves:U,getOptions:N,setAxes:X,setCurves:Y,setOptions:q,getConfig:j,clear:J,setAccTitle:E,getAccTitle:I,setDiagramTitle:_,getDiagramTitle:D,getAccDescription:F,setAccDescription:P},K=l(a=>{k(a,$);const{axes:t,curves:e,options:r}=a;$.setAxes(t),$.setCurves(e),$.setOptions(r)},"populate"),Q={parse:l(async a=>{const t=await W("radar",a);G.debug(t),K(t)},"parse")},tt=l((a,t,e,r)=>{const s=r.db,o=s.getAxes(),i=s.getCurves(),n=s.getOptions(),c=s.getConfig(),d=s.getDiagramTitle(),u=B(t),p=et(u,c),m=n.max??Math.max(...i.map(f=>Math.max(...f.entries))),x=n.min,v=Math.min(c.width,c.height)/2;at(p,o,v,n.ticks,n.graticule),rt(p,o,v,c),M(p,o,i,x,m,n.graticule,c),T(p,i,n.showLegend,c),p.append("text").attr("class","radarTitle").text(d).attr("x",0).attr("y",-c.height/2-c.marginTop)},"draw"),et=l((a,t)=>{const e=t.width+t.marginLeft+t.marginRight,r=t.height+t.marginTop+t.marginBottom,s={x:t.marginLeft+t.width/2,y:t.marginTop+t.height/2};return a.attr("viewbox",`0 0 ${e} ${r}`).attr("width",e).attr("height",r),a.append("g").attr("transform",`translate(${s.x}, ${s.y})`)},"drawFrame"),at=l((a,t,e,r,s)=>{if(s==="circle")for(let o=0;o<r;o++){const i=e*(o+1)/r;a.append("circle").attr("r",i).attr("class","radarGraticule")}else if(s==="polygon"){const o=t.length;for(let i=0;i<r;i++){const n=e*(i+1)/r,c=t.map((d,u)=>{const p=2*u*Math.PI/o-Math.PI/2,m=n*Math.cos(p),x=n*Math.sin(p);return`${m},${x}`}).join(" ");a.append("polygon").attr("points",c).attr("class","radarGraticule")}}},"drawGraticule"),rt=l((a,t,e,r)=>{const s=t.length;for(let o=0;o<s;o++){const i=t[o].label,n=2*o*Math.PI/s-Math.PI/2;a.append("line").attr("x1",0).attr("y1",0).attr("x2",e*r.axisScaleFactor*Math.cos(n)).attr("y2",e*r.axisScaleFactor*Math.sin(n)).attr("class","radarAxisLine"),a.append("text").text(i).attr("x",e*r.axisLabelFactor*Math.cos(n)).attr("y",e*r.axisLabelFactor*Math.sin(n)).attr("class","radarAxisLabel")}},"drawAxes");function M(a,t,e,r,s,o,i){const n=t.length,c=Math.min(i.width,i.height)/2;e.forEach((d,u)=>{if(d.entries.length!==n)return;const p=d.entries.map((m,x)=>{const v=2*Math.PI*x/n-Math.PI/2,f=A(m,r,s,c),O=f*Math.cos(v),S=f*Math.sin(v);return{x:O,y:S}});o==="circle"?a.append("path").attr("d",L(p,i.curveTension)).attr("class",`radarCurve-${u}`):o==="polygon"&&a.append("polygon").attr("points",p.map(m=>`${m.x},${m.y}`).join(" ")).attr("class",`radarCurve-${u}`)})}l(M,"drawCurves");function A(a,t,e,r){const s=Math.min(Math.max(a,t),e);return r*(s-t)/(e-t)}l(A,"relativeRadius");function L(a,t){const e=a.length;let r=`M${a[0].x},${a[0].y}`;for(let s=0;s<e;s++){const o=a[(s-1+e)%e],i=a[s],n=a[(s+1)%e],c=a[(s+2)%e],d={x:i.x+(n.x-o.x)*t,y:i.y+(n.y-o.y)*t},u={x:n.x-(c.x-i.x)*t,y:n.y-(c.y-i.y)*t};r+=` C${d.x},${d.y} ${u.x},${u.y} ${n.x},${n.y}`}return`${r} Z`}l(L,"closedRoundCurve");function T(a,t,e,r){if(!e)return;const s=(r.width/2+r.marginRight)*3/4,o=-(r.height/2+r.marginTop)*3/4,i=20;t.forEach((n,c)=>{const d=a.append("g").attr("transform",`translate(${s}, ${o+c*i})`);d.append("rect").attr("width",12).attr("height",12).attr("class",`radarLegendBox-${c}`),d.append("text").attr("x",16).attr("y",0).attr("class","radarLegendText").text(n.label)})}l(T,"drawLegend");var st={draw:tt},nt=l((a,t)=>{let e="";for(let r=0;r<a.THEME_COLOR_LIMIT;r++){const s=a[`cScale${r}`];e+=`
		.radarCurve-${r} {
			color: ${s};
			fill: ${s};
			fill-opacity: ${t.curveOpacity};
			stroke: ${s};
			stroke-width: ${t.curveStrokeWidth};
		}
		.radarLegendBox-${r} {
			fill: ${s};
			fill-opacity: ${t.curveOpacity};
			stroke: ${s};
		}
		`}return e},"genIndexStyles"),ot=l(a=>{const t=V(),e=C(),r=y(t,e.themeVariables),s=y(r.radar,a);return{themeVariables:r,radarOptions:s}},"buildRadarStyleOptions"),it=l(({radar:a}={})=>{const{themeVariables:t,radarOptions:e}=ot(a);return`
	.radarTitle {
		font-size: ${t.fontSize};
		color: ${t.titleColor};
		dominant-baseline: hanging;
		text-anchor: middle;
	}
	.radarAxisLine {
		stroke: ${e.axisColor};
		stroke-width: ${e.axisStrokeWidth};
	}
	.radarAxisLabel {
		dominant-baseline: middle;
		text-anchor: middle;
		font-size: ${e.axisLabelFontSize}px;
		color: ${e.axisColor};
	}
	.radarGraticule {
		fill: ${e.graticuleColor};
		fill-opacity: ${e.graticuleOpacity};
		stroke: ${e.graticuleColor};
		stroke-width: ${e.graticuleStrokeWidth};
	}
	.radarLegendText {
		text-anchor: start;
		font-size: ${e.legendFontSize}px;
		dominant-baseline: hanging;
	}
	${nt(t,e)}
	`},"styles"),ft={parser:Q,db:$,renderer:st,styles:it};export{ft as diagram};
