import{p as w}from"./chunk-4BMEZGHF-CUeGRVOA.js";import{a6 as B,B as S,C as F,T as P,U as z,D as T,E as W,_ as l,P as x,a7 as v,a8 as D,$ as E,ab as _,Q as A}from"./index-DSssgkDe.js";import{p as N}from"./radar-MK3ICKWK-C7v-GRj5.js";import"./semi-ui-BzboE4fo.js";import"./react-core-D-iPSUlg.js";import"./i18n-2p4l59BO.js";import"./tools-VBDCZ6mn.js";import"./react-components-BnylIsR_.js";import"./_baseUniq-DwvQqV7M.js";import"./_basePickBy-eHwYWVrG.js";import"./clone-oQToDf-C.js";var C={packet:[]},h=structuredClone(C),L=B.packet,Y=l(()=>{const t=v({...L,...D().packet});return t.showBits&&(t.paddingY+=10),t},"getConfig"),I=l(()=>h.packet,"getPacket"),M=l(t=>{t.length>0&&h.packet.push(t)},"pushWord"),O=l(()=>{E(),h=structuredClone(C)},"clear"),m={pushWord:M,getPacket:I,getConfig:Y,clear:O,setAccTitle:S,getAccTitle:F,setDiagramTitle:P,getDiagramTitle:z,getAccDescription:T,setAccDescription:W},U=1e4,G=l(t=>{w(t,m);let e=-1,o=[],s=1;const{bitsPerRow:i}=m.getConfig();for(let{start:a,end:r,label:p}of t.blocks){if(r&&r<a)throw new Error(`Packet block ${a} - ${r} is invalid. End must be greater than start.`);if(a!==e+1)throw new Error(`Packet block ${a} - ${r??a} is not contiguous. It should start from ${e+1}.`);for(e=r??a,x.debug(`Packet block ${a} - ${e} with label ${p}`);o.length<=i+1&&m.getPacket().length<U;){const[b,c]=H({start:a,end:r,label:p},s,i);if(o.push(b),b.end+1===s*i&&(m.pushWord(o),o=[],s++),!c)break;({start:a,end:r,label:p}=c)}}m.pushWord(o)},"populate"),H=l((t,e,o)=>{if(t.end===void 0&&(t.end=t.start),t.start>t.end)throw new Error(`Block start ${t.start} is greater than block end ${t.end}.`);return t.end+1<=e*o?[t,void 0]:[{start:t.start,end:e*o-1,label:t.label},{start:e*o,end:t.end,label:t.label}]},"getNextFittingBlock"),K={parse:l(async t=>{const e=await N("packet",t);x.debug(e),G(e)},"parse")},Q=l((t,e,o,s)=>{const i=s.db,a=i.getConfig(),{rowHeight:r,paddingY:p,bitWidth:b,bitsPerRow:c}=a,u=i.getPacket(),n=i.getDiagramTitle(),g=r+p,d=g*(u.length+1)-(n?0:r),k=b*c+2,f=_(e);f.attr("viewbox",`0 0 ${k} ${d}`),A(f,d,k,a.useMaxWidth);for(const[$,y]of u.entries())R(f,y,$,a);f.append("text").text(n).attr("x",k/2).attr("y",d-g/2).attr("dominant-baseline","middle").attr("text-anchor","middle").attr("class","packetTitle")},"draw"),R=l((t,e,o,{rowHeight:s,paddingX:i,paddingY:a,bitWidth:r,bitsPerRow:p,showBits:b})=>{const c=t.append("g"),u=o*(s+a)+a;for(const n of e){const g=n.start%p*r+1,d=(n.end-n.start+1)*r-i;if(c.append("rect").attr("x",g).attr("y",u).attr("width",d).attr("height",s).attr("class","packetBlock"),c.append("text").attr("x",g+d/2).attr("y",u+s/2).attr("class","packetLabel").attr("dominant-baseline","middle").attr("text-anchor","middle").text(n.label),!b)continue;const k=n.end===n.start,f=u-2;c.append("text").attr("x",g+(k?d/2:0)).attr("y",f).attr("class","packetByte start").attr("dominant-baseline","auto").attr("text-anchor",k?"middle":"start").text(n.start),k||c.append("text").attr("x",g+d).attr("y",f).attr("class","packetByte end").attr("dominant-baseline","auto").attr("text-anchor","end").text(n.end)}},"drawWord"),X={draw:Q},j={byteFontSize:"10px",startByteColor:"black",endByteColor:"black",labelColor:"black",labelFontSize:"12px",titleColor:"black",titleFontSize:"14px",blockStrokeColor:"black",blockStrokeWidth:"1",blockFillColor:"#efefef"},q=l(({packet:t}={})=>{const e=v(j,t);return`
	.packetByte {
		font-size: ${e.byteFontSize};
	}
	.packetByte.start {
		fill: ${e.startByteColor};
	}
	.packetByte.end {
		fill: ${e.endByteColor};
	}
	.packetLabel {
		fill: ${e.labelColor};
		font-size: ${e.labelFontSize};
	}
	.packetTitle {
		fill: ${e.titleColor};
		font-size: ${e.titleFontSize};
	}
	.packetBlock {
		stroke: ${e.blockStrokeColor};
		stroke-width: ${e.blockStrokeWidth};
		fill: ${e.blockFillColor};
	}
	`},"styles"),it={parser:K,db:m,renderer:X,styles:q};export{it as diagram};
