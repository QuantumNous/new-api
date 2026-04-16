import{d as pt,f as gt,g as at,b as mt}from"./chunk-D6G4REZN-DrQYzguR.js";import{_ as s,F as A,T as xt,U as kt,B as _t,C as bt,E as vt,D as wt,$ as Tt,O as W,Q as St}from"./index-DSssgkDe.js";import{d as tt}from"./arc-Ch4BrY91.js";import"./semi-ui-BzboE4fo.js";import"./react-core-D-iPSUlg.js";import"./i18n-2p4l59BO.js";import"./tools-VBDCZ6mn.js";import"./react-components-BnylIsR_.js";var H=function(){var t=s(function(g,r,a,l){for(a=a||{},l=g.length;l--;a[g[l]]=r);return a},"o"),e=[6,8,10,11,12,14,16,17,18],i=[1,9],c=[1,10],n=[1,11],u=[1,12],h=[1,13],f=[1,14],d={trace:s(function(){},"trace"),yy:{},symbols_:{error:2,start:3,journey:4,document:5,EOF:6,line:7,SPACE:8,statement:9,NEWLINE:10,title:11,acc_title:12,acc_title_value:13,acc_descr:14,acc_descr_value:15,acc_descr_multiline_value:16,section:17,taskName:18,taskData:19,$accept:0,$end:1},terminals_:{2:"error",4:"journey",6:"EOF",8:"SPACE",10:"NEWLINE",11:"title",12:"acc_title",13:"acc_title_value",14:"acc_descr",15:"acc_descr_value",16:"acc_descr_multiline_value",17:"section",18:"taskName",19:"taskData"},productions_:[0,[3,3],[5,0],[5,2],[7,2],[7,1],[7,1],[7,1],[9,1],[9,2],[9,2],[9,1],[9,1],[9,2]],performAction:s(function(r,a,l,y,p,o,S){var _=o.length-1;switch(p){case 1:return o[_-1];case 2:this.$=[];break;case 3:o[_-1].push(o[_]),this.$=o[_-1];break;case 4:case 5:this.$=o[_];break;case 6:case 7:this.$=[];break;case 8:y.setDiagramTitle(o[_].substr(6)),this.$=o[_].substr(6);break;case 9:this.$=o[_].trim(),y.setAccTitle(this.$);break;case 10:case 11:this.$=o[_].trim(),y.setAccDescription(this.$);break;case 12:y.addSection(o[_].substr(8)),this.$=o[_].substr(8);break;case 13:y.addTask(o[_-1],o[_]),this.$="task";break}},"anonymous"),table:[{3:1,4:[1,2]},{1:[3]},t(e,[2,2],{5:3}),{6:[1,4],7:5,8:[1,6],9:7,10:[1,8],11:i,12:c,14:n,16:u,17:h,18:f},t(e,[2,7],{1:[2,1]}),t(e,[2,3]),{9:15,11:i,12:c,14:n,16:u,17:h,18:f},t(e,[2,5]),t(e,[2,6]),t(e,[2,8]),{13:[1,16]},{15:[1,17]},t(e,[2,11]),t(e,[2,12]),{19:[1,18]},t(e,[2,4]),t(e,[2,9]),t(e,[2,10]),t(e,[2,13])],defaultActions:{},parseError:s(function(r,a){if(a.recoverable)this.trace(r);else{var l=new Error(r);throw l.hash=a,l}},"parseError"),parse:s(function(r){var a=this,l=[0],y=[],p=[null],o=[],S=this.table,_="",B=0,Z=0,ut=2,J=1,yt=o.slice.call(arguments,1),k=Object.create(this.lexer),E={yy:{}};for(var O in this.yy)Object.prototype.hasOwnProperty.call(this.yy,O)&&(E.yy[O]=this.yy[O]);k.setInput(r,E.yy),E.yy.lexer=k,E.yy.parser=this,typeof k.yylloc>"u"&&(k.yylloc={});var Y=k.yylloc;o.push(Y);var dt=k.options&&k.options.ranges;typeof E.yy.parseError=="function"?this.parseError=E.yy.parseError:this.parseError=Object.getPrototypeOf(this).parseError;function ft(v){l.length=l.length-2*v,p.length=p.length-v,o.length=o.length-v}s(ft,"popStack");function K(){var v;return v=y.pop()||k.lex()||J,typeof v!="number"&&(v instanceof Array&&(y=v,v=y.pop()),v=a.symbols_[v]||v),v}s(K,"lex");for(var b,P,w,q,C={},N,$,D,j;;){if(P=l[l.length-1],this.defaultActions[P]?w=this.defaultActions[P]:((b===null||typeof b>"u")&&(b=K()),w=S[P]&&S[P][b]),typeof w>"u"||!w.length||!w[0]){var G="";j=[];for(N in S[P])this.terminals_[N]&&N>ut&&j.push("'"+this.terminals_[N]+"'");k.showPosition?G="Parse error on line "+(B+1)+`:
`+k.showPosition()+`
Expecting `+j.join(", ")+", got '"+(this.terminals_[b]||b)+"'":G="Parse error on line "+(B+1)+": Unexpected "+(b==J?"end of input":"'"+(this.terminals_[b]||b)+"'"),this.parseError(G,{text:k.match,token:this.terminals_[b]||b,line:k.yylineno,loc:Y,expected:j})}if(w[0]instanceof Array&&w.length>1)throw new Error("Parse Error: multiple actions possible at state: "+P+", token: "+b);switch(w[0]){case 1:l.push(b),p.push(k.yytext),o.push(k.yylloc),l.push(w[1]),b=null,Z=k.yyleng,_=k.yytext,B=k.yylineno,Y=k.yylloc;break;case 2:if($=this.productions_[w[1]][1],C.$=p[p.length-$],C._$={first_line:o[o.length-($||1)].first_line,last_line:o[o.length-1].last_line,first_column:o[o.length-($||1)].first_column,last_column:o[o.length-1].last_column},dt&&(C._$.range=[o[o.length-($||1)].range[0],o[o.length-1].range[1]]),q=this.performAction.apply(C,[_,Z,B,E.yy,w[1],p,o].concat(yt)),typeof q<"u")return q;$&&(l=l.slice(0,-1*$*2),p=p.slice(0,-1*$),o=o.slice(0,-1*$)),l.push(this.productions_[w[1]][0]),p.push(C.$),o.push(C._$),D=S[l[l.length-2]][l[l.length-1]],l.push(D);break;case 3:return!0}}return!0},"parse")},x=function(){var g={EOF:1,parseError:s(function(a,l){if(this.yy.parser)this.yy.parser.parseError(a,l);else throw new Error(a)},"parseError"),setInput:s(function(r,a){return this.yy=a||this.yy||{},this._input=r,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},"setInput"),input:s(function(){var r=this._input[0];this.yytext+=r,this.yyleng++,this.offset++,this.match+=r,this.matched+=r;var a=r.match(/(?:\r\n?|\n).*/g);return a?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),r},"input"),unput:s(function(r){var a=r.length,l=r.split(/(?:\r\n?|\n)/g);this._input=r+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-a),this.offset-=a;var y=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),l.length-1&&(this.yylineno-=l.length-1);var p=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:l?(l.length===y.length?this.yylloc.first_column:0)+y[y.length-l.length].length-l[0].length:this.yylloc.first_column-a},this.options.ranges&&(this.yylloc.range=[p[0],p[0]+this.yyleng-a]),this.yyleng=this.yytext.length,this},"unput"),more:s(function(){return this._more=!0,this},"more"),reject:s(function(){if(this.options.backtrack_lexer)this._backtrack=!0;else return this.parseError("Lexical error on line "+(this.yylineno+1)+`. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
`+this.showPosition(),{text:"",token:null,line:this.yylineno});return this},"reject"),less:s(function(r){this.unput(this.match.slice(r))},"less"),pastInput:s(function(){var r=this.matched.substr(0,this.matched.length-this.match.length);return(r.length>20?"...":"")+r.substr(-20).replace(/\n/g,"")},"pastInput"),upcomingInput:s(function(){var r=this.match;return r.length<20&&(r+=this._input.substr(0,20-r.length)),(r.substr(0,20)+(r.length>20?"...":"")).replace(/\n/g,"")},"upcomingInput"),showPosition:s(function(){var r=this.pastInput(),a=new Array(r.length+1).join("-");return r+this.upcomingInput()+`
`+a+"^"},"showPosition"),test_match:s(function(r,a){var l,y,p;if(this.options.backtrack_lexer&&(p={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges&&(p.yylloc.range=this.yylloc.range.slice(0))),y=r[0].match(/(?:\r\n?|\n).*/g),y&&(this.yylineno+=y.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:y?y[y.length-1].length-y[y.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+r[0].length},this.yytext+=r[0],this.match+=r[0],this.matches=r,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._backtrack=!1,this._input=this._input.slice(r[0].length),this.matched+=r[0],l=this.performAction.call(this,this.yy,this,a,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1),l)return l;if(this._backtrack){for(var o in p)this[o]=p[o];return!1}return!1},"test_match"),next:s(function(){if(this.done)return this.EOF;this._input||(this.done=!0);var r,a,l,y;this._more||(this.yytext="",this.match="");for(var p=this._currentRules(),o=0;o<p.length;o++)if(l=this._input.match(this.rules[p[o]]),l&&(!a||l[0].length>a[0].length)){if(a=l,y=o,this.options.backtrack_lexer){if(r=this.test_match(l,p[o]),r!==!1)return r;if(this._backtrack){a=!1;continue}else return!1}else if(!this.options.flex)break}return a?(r=this.test_match(a,p[y]),r!==!1?r:!1):this._input===""?this.EOF:this.parseError("Lexical error on line "+(this.yylineno+1)+`. Unrecognized text.
`+this.showPosition(),{text:"",token:null,line:this.yylineno})},"next"),lex:s(function(){var a=this.next();return a||this.lex()},"lex"),begin:s(function(a){this.conditionStack.push(a)},"begin"),popState:s(function(){var a=this.conditionStack.length-1;return a>0?this.conditionStack.pop():this.conditionStack[0]},"popState"),_currentRules:s(function(){return this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1]?this.conditions[this.conditionStack[this.conditionStack.length-1]].rules:this.conditions.INITIAL.rules},"_currentRules"),topState:s(function(a){return a=this.conditionStack.length-1-Math.abs(a||0),a>=0?this.conditionStack[a]:"INITIAL"},"topState"),pushState:s(function(a){this.begin(a)},"pushState"),stateStackSize:s(function(){return this.conditionStack.length},"stateStackSize"),options:{"case-insensitive":!0},performAction:s(function(a,l,y,p){switch(y){case 0:break;case 1:break;case 2:return 10;case 3:break;case 4:break;case 5:return 4;case 6:return 11;case 7:return this.begin("acc_title"),12;case 8:return this.popState(),"acc_title_value";case 9:return this.begin("acc_descr"),14;case 10:return this.popState(),"acc_descr_value";case 11:this.begin("acc_descr_multiline");break;case 12:this.popState();break;case 13:return"acc_descr_multiline_value";case 14:return 17;case 15:return 18;case 16:return 19;case 17:return":";case 18:return 6;case 19:return"INVALID"}},"anonymous"),rules:[/^(?:%(?!\{)[^\n]*)/i,/^(?:[^\}]%%[^\n]*)/i,/^(?:[\n]+)/i,/^(?:\s+)/i,/^(?:#[^\n]*)/i,/^(?:journey\b)/i,/^(?:title\s[^#\n;]+)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:section\s[^#:\n;]+)/i,/^(?:[^#:\n;]+)/i,/^(?::[^#\n;]+)/i,/^(?::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{acc_descr_multiline:{rules:[12,13],inclusive:!1},acc_descr:{rules:[10],inclusive:!1},acc_title:{rules:[8],inclusive:!1},INITIAL:{rules:[0,1,2,3,4,5,6,7,9,11,14,15,16,17,18,19],inclusive:!0}}};return g}();d.lexer=x;function m(){this.yy={}}return s(m,"Parser"),m.prototype=d,d.Parser=m,new m}();H.parser=H;var $t=H,V="",U=[],F=[],R=[],Mt=s(function(){U.length=0,F.length=0,V="",R.length=0,Tt()},"clear"),Et=s(function(t){V=t,U.push(t)},"addSection"),Pt=s(function(){return U},"getSections"),It=s(function(){let t=et();const e=100;let i=0;for(;!t&&i<e;)t=et(),i++;return F.push(...R),F},"getTasks"),At=s(function(){const t=[];return F.forEach(i=>{i.people&&t.push(...i.people)}),[...new Set(t)].sort()},"updateActors"),Ct=s(function(t,e){const i=e.substr(1).split(":");let c=0,n=[];i.length===1?(c=Number(i[0]),n=[]):(c=Number(i[0]),n=i[1].split(","));const u=n.map(f=>f.trim()),h={section:V,type:V,people:u,task:t,score:c};R.push(h)},"addTask"),Vt=s(function(t){const e={section:V,type:V,description:t,task:t,classes:[]};F.push(e)},"addTaskOrg"),et=s(function(){const t=s(function(i){return R[i].processed},"compileTask");let e=!0;for(const[i,c]of R.entries())t(i),e=e&&c.processed;return e},"compileTasks"),Ft=s(function(){return At()},"getActors"),rt={getConfig:s(()=>A().journey,"getConfig"),clear:Mt,setDiagramTitle:xt,getDiagramTitle:kt,setAccTitle:_t,getAccTitle:bt,setAccDescription:vt,getAccDescription:wt,addSection:Et,getSections:Pt,getTasks:It,addTask:Ct,addTaskOrg:Vt,getActors:Ft},Rt=s(t=>`.label {
    font-family: ${t.fontFamily};
    color: ${t.textColor};
  }
  .mouth {
    stroke: #666;
  }

  line {
    stroke: ${t.textColor}
  }

  .legend {
    fill: ${t.textColor};
    font-family: ${t.fontFamily};
  }

  .label text {
    fill: #333;
  }
  .label {
    color: ${t.textColor}
  }

  .face {
    ${t.faceColor?`fill: ${t.faceColor}`:"fill: #FFF8DC"};
    stroke: #999;
  }

  .node rect,
  .node circle,
  .node ellipse,
  .node polygon,
  .node path {
    fill: ${t.mainBkg};
    stroke: ${t.nodeBorder};
    stroke-width: 1px;
  }

  .node .label {
    text-align: center;
  }
  .node.clickable {
    cursor: pointer;
  }

  .arrowheadPath {
    fill: ${t.arrowheadColor};
  }

  .edgePath .path {
    stroke: ${t.lineColor};
    stroke-width: 1.5px;
  }

  .flowchart-link {
    stroke: ${t.lineColor};
    fill: none;
  }

  .edgeLabel {
    background-color: ${t.edgeLabelBackground};
    rect {
      opacity: 0.5;
    }
    text-align: center;
  }

  .cluster rect {
  }

  .cluster text {
    fill: ${t.titleColor};
  }

  div.mermaidTooltip {
    position: absolute;
    text-align: center;
    max-width: 200px;
    padding: 2px;
    font-family: ${t.fontFamily};
    font-size: 12px;
    background: ${t.tertiaryColor};
    border: 1px solid ${t.border2};
    border-radius: 2px;
    pointer-events: none;
    z-index: 100;
  }

  .task-type-0, .section-type-0  {
    ${t.fillType0?`fill: ${t.fillType0}`:""};
  }
  .task-type-1, .section-type-1  {
    ${t.fillType0?`fill: ${t.fillType1}`:""};
  }
  .task-type-2, .section-type-2  {
    ${t.fillType0?`fill: ${t.fillType2}`:""};
  }
  .task-type-3, .section-type-3  {
    ${t.fillType0?`fill: ${t.fillType3}`:""};
  }
  .task-type-4, .section-type-4  {
    ${t.fillType0?`fill: ${t.fillType4}`:""};
  }
  .task-type-5, .section-type-5  {
    ${t.fillType0?`fill: ${t.fillType5}`:""};
  }
  .task-type-6, .section-type-6  {
    ${t.fillType0?`fill: ${t.fillType6}`:""};
  }
  .task-type-7, .section-type-7  {
    ${t.fillType0?`fill: ${t.fillType7}`:""};
  }

  .actor-0 {
    ${t.actor0?`fill: ${t.actor0}`:""};
  }
  .actor-1 {
    ${t.actor1?`fill: ${t.actor1}`:""};
  }
  .actor-2 {
    ${t.actor2?`fill: ${t.actor2}`:""};
  }
  .actor-3 {
    ${t.actor3?`fill: ${t.actor3}`:""};
  }
  .actor-4 {
    ${t.actor4?`fill: ${t.actor4}`:""};
  }
  .actor-5 {
    ${t.actor5?`fill: ${t.actor5}`:""};
  }
`,"getStyles"),Lt=Rt,Q=s(function(t,e){return pt(t,e)},"drawRect"),Bt=s(function(t,e){const c=t.append("circle").attr("cx",e.cx).attr("cy",e.cy).attr("class","face").attr("r",15).attr("stroke-width",2).attr("overflow","visible"),n=t.append("g");n.append("circle").attr("cx",e.cx-15/3).attr("cy",e.cy-15/3).attr("r",1.5).attr("stroke-width",2).attr("fill","#666").attr("stroke","#666"),n.append("circle").attr("cx",e.cx+15/3).attr("cy",e.cy-15/3).attr("r",1.5).attr("stroke-width",2).attr("fill","#666").attr("stroke","#666");function u(d){const x=tt().startAngle(Math.PI/2).endAngle(3*(Math.PI/2)).innerRadius(7.5).outerRadius(6.8181818181818175);d.append("path").attr("class","mouth").attr("d",x).attr("transform","translate("+e.cx+","+(e.cy+2)+")")}s(u,"smile");function h(d){const x=tt().startAngle(3*Math.PI/2).endAngle(5*(Math.PI/2)).innerRadius(7.5).outerRadius(6.8181818181818175);d.append("path").attr("class","mouth").attr("d",x).attr("transform","translate("+e.cx+","+(e.cy+7)+")")}s(h,"sad");function f(d){d.append("line").attr("class","mouth").attr("stroke",2).attr("x1",e.cx-5).attr("y1",e.cy+7).attr("x2",e.cx+5).attr("y2",e.cy+7).attr("class","mouth").attr("stroke-width","1px").attr("stroke","#666")}return s(f,"ambivalent"),e.score>3?u(n):e.score<3?h(n):f(n),c},"drawFace"),lt=s(function(t,e){const i=t.append("circle");return i.attr("cx",e.cx),i.attr("cy",e.cy),i.attr("class","actor-"+e.pos),i.attr("fill",e.fill),i.attr("stroke",e.stroke),i.attr("r",e.r),i.class!==void 0&&i.attr("class",i.class),e.title!==void 0&&i.append("title").text(e.title),i},"drawCircle"),ot=s(function(t,e){return gt(t,e)},"drawText"),Nt=s(function(t,e){function i(n,u,h,f,d){return n+","+u+" "+(n+h)+","+u+" "+(n+h)+","+(u+f-d)+" "+(n+h-d*1.2)+","+(u+f)+" "+n+","+(u+f)}s(i,"genPoints");const c=t.append("polygon");c.attr("points",i(e.x,e.y,50,20,7)),c.attr("class","labelBox"),e.y=e.y+e.labelMargin,e.x=e.x+.5*e.labelMargin,ot(t,e)},"drawLabel"),jt=s(function(t,e,i){const c=t.append("g"),n=at();n.x=e.x,n.y=e.y,n.fill=e.fill,n.width=i.width*e.taskCount+i.diagramMarginX*(e.taskCount-1),n.height=i.height,n.class="journey-section section-type-"+e.num,n.rx=3,n.ry=3,Q(c,n),ct(i)(e.text,c,n.x,n.y,n.width,n.height,{class:"journey-section section-type-"+e.num},i,e.colour)},"drawSection"),nt=-1,zt=s(function(t,e,i){const c=e.x+i.width/2,n=t.append("g");nt++;const u=300+5*30;n.append("line").attr("id","task"+nt).attr("x1",c).attr("y1",e.y).attr("x2",c).attr("y2",u).attr("class","task-line").attr("stroke-width","1px").attr("stroke-dasharray","4 2").attr("stroke","#666"),Bt(n,{cx:c,cy:300+(5-e.score)*30,score:e.score});const h=at();h.x=e.x,h.y=e.y,h.fill=e.fill,h.width=i.width,h.height=i.height,h.class="task task-type-"+e.num,h.rx=3,h.ry=3,Q(n,h);let f=e.x+14;e.people.forEach(d=>{const x=e.actors[d].color,m={cx:f,cy:e.y,r:7,fill:x,stroke:"#000",title:d,pos:e.actors[d].position};lt(n,m),f+=10}),ct(i)(e.task,n,h.x,h.y,h.width,h.height,{class:"task"},i,e.colour)},"drawTask"),Ot=s(function(t,e){mt(t,e)},"drawBackgroundRect"),ct=function(){function t(n,u,h,f,d,x,m,g){const r=u.append("text").attr("x",h+d/2).attr("y",f+x/2+5).style("font-color",g).style("text-anchor","middle").text(n);c(r,m)}s(t,"byText");function e(n,u,h,f,d,x,m,g,r){const{taskFontSize:a,taskFontFamily:l}=g,y=n.split(/<br\s*\/?>/gi);for(let p=0;p<y.length;p++){const o=p*a-a*(y.length-1)/2,S=u.append("text").attr("x",h+d/2).attr("y",f).attr("fill",r).style("text-anchor","middle").style("font-size",a).style("font-family",l);S.append("tspan").attr("x",h+d/2).attr("dy",o).text(y[p]),S.attr("y",f+x/2).attr("dominant-baseline","central").attr("alignment-baseline","central"),c(S,m)}}s(e,"byTspan");function i(n,u,h,f,d,x,m,g){const r=u.append("switch"),l=r.append("foreignObject").attr("x",h).attr("y",f).attr("width",d).attr("height",x).attr("position","fixed").append("xhtml:div").style("display","table").style("height","100%").style("width","100%");l.append("div").attr("class","label").style("display","table-cell").style("text-align","center").style("vertical-align","middle").text(n),e(n,r,h,f,d,x,m,g),c(l,m)}s(i,"byFo");function c(n,u){for(const h in u)h in u&&n.attr(h,u[h])}return s(c,"_setTextAttrs"),function(n){return n.textPlacement==="fo"?i:n.textPlacement==="old"?t:e}}(),Yt=s(function(t){t.append("defs").append("marker").attr("id","arrowhead").attr("refX",5).attr("refY",2).attr("markerWidth",6).attr("markerHeight",4).attr("orient","auto").append("path").attr("d","M 0,0 V 4 L6,2 Z")},"initGraphics"),L={drawRect:Q,drawCircle:lt,drawSection:jt,drawText:ot,drawLabel:Nt,drawTask:zt,drawBackgroundRect:Ot,initGraphics:Yt},qt=s(function(t){Object.keys(t).forEach(function(i){z[i]=t[i]})},"setConf"),M={};function ht(t){const e=A().journey;let i=60;Object.keys(M).forEach(c=>{const n=M[c].color,u={cx:20,cy:i,r:7,fill:n,stroke:"#000",pos:M[c].position};L.drawCircle(t,u);const h={x:40,y:i+7,fill:"#666",text:c,textMargin:e.boxTextMargin|5};L.drawText(t,h),i+=20})}s(ht,"drawActorLegend");var z=A().journey,I=z.leftMargin,Gt=s(function(t,e,i,c){const n=A().journey,u=A().securityLevel;let h;u==="sandbox"&&(h=W("#i"+e));const f=u==="sandbox"?W(h.nodes()[0].contentDocument.body):W("body");T.init();const d=f.select("#"+e);L.initGraphics(d);const x=c.db.getTasks(),m=c.db.getDiagramTitle(),g=c.db.getActors();for(const o in M)delete M[o];let r=0;g.forEach(o=>{M[o]={color:n.actorColours[r%n.actorColours.length],position:r},r++}),ht(d),T.insert(0,0,I,Object.keys(M).length*50),Wt(d,x,0);const a=T.getBounds();m&&d.append("text").text(m).attr("x",I).attr("font-size","4ex").attr("font-weight","bold").attr("y",25);const l=a.stopy-a.starty+2*n.diagramMarginY,y=I+a.stopx+2*n.diagramMarginX;St(d,l,y,n.useMaxWidth),d.append("line").attr("x1",I).attr("y1",n.height*4).attr("x2",y-I-4).attr("y2",n.height*4).attr("stroke-width",4).attr("stroke","black").attr("marker-end","url(#arrowhead)");const p=m?70:0;d.attr("viewBox",`${a.startx} -25 ${y} ${l+p}`),d.attr("preserveAspectRatio","xMinYMin meet"),d.attr("height",l+p+25)},"draw"),T={data:{startx:void 0,stopx:void 0,starty:void 0,stopy:void 0},verticalPos:0,sequenceItems:[],init:s(function(){this.sequenceItems=[],this.data={startx:void 0,stopx:void 0,starty:void 0,stopy:void 0},this.verticalPos=0},"init"),updateVal:s(function(t,e,i,c){t[e]===void 0?t[e]=i:t[e]=c(i,t[e])},"updateVal"),updateBounds:s(function(t,e,i,c){const n=A().journey,u=this;let h=0;function f(d){return s(function(m){h++;const g=u.sequenceItems.length-h+1;u.updateVal(m,"starty",e-g*n.boxMargin,Math.min),u.updateVal(m,"stopy",c+g*n.boxMargin,Math.max),u.updateVal(T.data,"startx",t-g*n.boxMargin,Math.min),u.updateVal(T.data,"stopx",i+g*n.boxMargin,Math.max),d!=="activation"&&(u.updateVal(m,"startx",t-g*n.boxMargin,Math.min),u.updateVal(m,"stopx",i+g*n.boxMargin,Math.max),u.updateVal(T.data,"starty",e-g*n.boxMargin,Math.min),u.updateVal(T.data,"stopy",c+g*n.boxMargin,Math.max))},"updateItemBounds")}s(f,"updateFn"),this.sequenceItems.forEach(f())},"updateBounds"),insert:s(function(t,e,i,c){const n=Math.min(t,i),u=Math.max(t,i),h=Math.min(e,c),f=Math.max(e,c);this.updateVal(T.data,"startx",n,Math.min),this.updateVal(T.data,"starty",h,Math.min),this.updateVal(T.data,"stopx",u,Math.max),this.updateVal(T.data,"stopy",f,Math.max),this.updateBounds(n,h,u,f)},"insert"),bumpVerticalPos:s(function(t){this.verticalPos=this.verticalPos+t,this.data.stopy=this.verticalPos},"bumpVerticalPos"),getVerticalPos:s(function(){return this.verticalPos},"getVerticalPos"),getBounds:s(function(){return this.data},"getBounds")},X=z.sectionFills,st=z.sectionColours,Wt=s(function(t,e,i){const c=A().journey;let n="";const u=c.height*2+c.diagramMarginY,h=i+u;let f=0,d="#CCC",x="black",m=0;for(const[g,r]of e.entries()){if(n!==r.section){d=X[f%X.length],m=f%X.length,x=st[f%st.length];let l=0;const y=r.section;for(let o=g;o<e.length&&e[o].section==y;o++)l=l+1;const p={x:g*c.taskMargin+g*c.width+I,y:50,text:r.section,fill:d,num:m,colour:x,taskCount:l};L.drawSection(t,p,c),n=r.section,f++}const a=r.people.reduce((l,y)=>(M[y]&&(l[y]=M[y]),l),{});r.x=g*c.taskMargin+g*c.width+I,r.y=h,r.width=c.diagramMarginX,r.height=c.diagramMarginY,r.colour=x,r.fill=d,r.num=m,r.actors=a,L.drawTask(t,r,c),T.insert(r.x,r.y,r.x+r.width+c.taskMargin,300+5*30)}},"drawTasks"),it={setConf:qt,draw:Gt},te={parser:$t,db:rt,renderer:it,styles:Lt,init:s(t=>{it.setConf(t.journey),rt.clear()},"init")};export{te as diagram};
