var re=Object.defineProperty;var ae=(e,t,s)=>t in e?re(e,t,{enumerable:!0,configurable:!0,writable:!0,value:s}):e[t]=s;var b=(e,t,s)=>ae(e,typeof t!="symbol"?t+"":t,s);import{g as ne,s as le}from"./chunk-RZ5BOZE2-Co1HcXoe.js";import{_ as p,P as v,am as oe,F as A,H as j,$ as ce,C as he,B as ue,D as de,E as fe,T as pe,U as Se,a3 as ye,Z as ge}from"./index-DSssgkDe.js";var bt=function(){var e=p(function(P,l,h,a){for(h=h||{},a=P.length;a--;h[P[a]]=l);return h},"o"),t=[1,2],s=[1,3],n=[1,4],o=[2,4],c=[1,9],r=[1,11],d=[1,16],f=[1,17],g=[1,18],E=[1,19],m=[1,32],I=[1,20],G=[1,21],R=[1,22],S=[1,23],L=[1,24],O=[1,26],F=[1,27],Y=[1,28],w=[1,29],$=[1,30],et=[1,31],st=[1,34],it=[1,35],rt=[1,36],at=[1,37],X=[1,33],y=[1,4,5,16,17,19,21,22,24,25,26,27,28,29,33,35,37,38,42,45,48,49,50,51,54],nt=[1,4,5,14,15,16,17,19,21,22,24,25,26,27,28,29,33,35,37,38,42,45,48,49,50,51,54],At=[4,5,16,17,19,21,22,24,25,26,27,28,29,33,35,37,38,42,45,48,49,50,51,54],St={trace:p(function(){},"trace"),yy:{},symbols_:{error:2,start:3,SPACE:4,NL:5,SD:6,document:7,line:8,statement:9,classDefStatement:10,styleStatement:11,cssClassStatement:12,idStatement:13,DESCR:14,"-->":15,HIDE_EMPTY:16,scale:17,WIDTH:18,COMPOSIT_STATE:19,STRUCT_START:20,STRUCT_STOP:21,STATE_DESCR:22,AS:23,ID:24,FORK:25,JOIN:26,CHOICE:27,CONCURRENT:28,note:29,notePosition:30,NOTE_TEXT:31,direction:32,acc_title:33,acc_title_value:34,acc_descr:35,acc_descr_value:36,acc_descr_multiline_value:37,classDef:38,CLASSDEF_ID:39,CLASSDEF_STYLEOPTS:40,DEFAULT:41,style:42,STYLE_IDS:43,STYLEDEF_STYLEOPTS:44,class:45,CLASSENTITY_IDS:46,STYLECLASS:47,direction_tb:48,direction_bt:49,direction_rl:50,direction_lr:51,eol:52,";":53,EDGE_STATE:54,STYLE_SEPARATOR:55,left_of:56,right_of:57,$accept:0,$end:1},terminals_:{2:"error",4:"SPACE",5:"NL",6:"SD",14:"DESCR",15:"-->",16:"HIDE_EMPTY",17:"scale",18:"WIDTH",19:"COMPOSIT_STATE",20:"STRUCT_START",21:"STRUCT_STOP",22:"STATE_DESCR",23:"AS",24:"ID",25:"FORK",26:"JOIN",27:"CHOICE",28:"CONCURRENT",29:"note",31:"NOTE_TEXT",33:"acc_title",34:"acc_title_value",35:"acc_descr",36:"acc_descr_value",37:"acc_descr_multiline_value",38:"classDef",39:"CLASSDEF_ID",40:"CLASSDEF_STYLEOPTS",41:"DEFAULT",42:"style",43:"STYLE_IDS",44:"STYLEDEF_STYLEOPTS",45:"class",46:"CLASSENTITY_IDS",47:"STYLECLASS",48:"direction_tb",49:"direction_bt",50:"direction_rl",51:"direction_lr",53:";",54:"EDGE_STATE",55:"STYLE_SEPARATOR",56:"left_of",57:"right_of"},productions_:[0,[3,2],[3,2],[3,2],[7,0],[7,2],[8,2],[8,1],[8,1],[9,1],[9,1],[9,1],[9,1],[9,2],[9,3],[9,4],[9,1],[9,2],[9,1],[9,4],[9,3],[9,6],[9,1],[9,1],[9,1],[9,1],[9,4],[9,4],[9,1],[9,2],[9,2],[9,1],[10,3],[10,3],[11,3],[12,3],[32,1],[32,1],[32,1],[32,1],[52,1],[52,1],[13,1],[13,1],[13,3],[13,3],[30,1],[30,1]],performAction:p(function(l,h,a,T,_,i,K){var u=i.length-1;switch(_){case 3:return T.setRootDoc(i[u]),i[u];case 4:this.$=[];break;case 5:i[u]!="nl"&&(i[u-1].push(i[u]),this.$=i[u-1]);break;case 6:case 7:this.$=i[u];break;case 8:this.$="nl";break;case 12:this.$=i[u];break;case 13:const J=i[u-1];J.description=T.trimColon(i[u]),this.$=J;break;case 14:this.$={stmt:"relation",state1:i[u-2],state2:i[u]};break;case 15:const yt=T.trimColon(i[u]);this.$={stmt:"relation",state1:i[u-3],state2:i[u-1],description:yt};break;case 19:this.$={stmt:"state",id:i[u-3],type:"default",description:"",doc:i[u-1]};break;case 20:var V=i[u],z=i[u-2].trim();if(i[u].match(":")){var ot=i[u].split(":");V=ot[0],z=[z,ot[1]]}this.$={stmt:"state",id:V,type:"default",description:z};break;case 21:this.$={stmt:"state",id:i[u-3],type:"default",description:i[u-5],doc:i[u-1]};break;case 22:this.$={stmt:"state",id:i[u],type:"fork"};break;case 23:this.$={stmt:"state",id:i[u],type:"join"};break;case 24:this.$={stmt:"state",id:i[u],type:"choice"};break;case 25:this.$={stmt:"state",id:T.getDividerId(),type:"divider"};break;case 26:this.$={stmt:"state",id:i[u-1].trim(),note:{position:i[u-2].trim(),text:i[u].trim()}};break;case 29:this.$=i[u].trim(),T.setAccTitle(this.$);break;case 30:case 31:this.$=i[u].trim(),T.setAccDescription(this.$);break;case 32:case 33:this.$={stmt:"classDef",id:i[u-1].trim(),classes:i[u].trim()};break;case 34:this.$={stmt:"style",id:i[u-1].trim(),styleClass:i[u].trim()};break;case 35:this.$={stmt:"applyClass",id:i[u-1].trim(),styleClass:i[u].trim()};break;case 36:T.setDirection("TB"),this.$={stmt:"dir",value:"TB"};break;case 37:T.setDirection("BT"),this.$={stmt:"dir",value:"BT"};break;case 38:T.setDirection("RL"),this.$={stmt:"dir",value:"RL"};break;case 39:T.setDirection("LR"),this.$={stmt:"dir",value:"LR"};break;case 42:case 43:this.$={stmt:"state",id:i[u].trim(),type:"default",description:""};break;case 44:this.$={stmt:"state",id:i[u-2].trim(),classes:[i[u].trim()],type:"default",description:""};break;case 45:this.$={stmt:"state",id:i[u-2].trim(),classes:[i[u].trim()],type:"default",description:""};break}},"anonymous"),table:[{3:1,4:t,5:s,6:n},{1:[3]},{3:5,4:t,5:s,6:n},{3:6,4:t,5:s,6:n},e([1,4,5,16,17,19,22,24,25,26,27,28,29,33,35,37,38,42,45,48,49,50,51,54],o,{7:7}),{1:[2,1]},{1:[2,2]},{1:[2,3],4:c,5:r,8:8,9:10,10:12,11:13,12:14,13:15,16:d,17:f,19:g,22:E,24:m,25:I,26:G,27:R,28:S,29:L,32:25,33:O,35:F,37:Y,38:w,42:$,45:et,48:st,49:it,50:rt,51:at,54:X},e(y,[2,5]),{9:38,10:12,11:13,12:14,13:15,16:d,17:f,19:g,22:E,24:m,25:I,26:G,27:R,28:S,29:L,32:25,33:O,35:F,37:Y,38:w,42:$,45:et,48:st,49:it,50:rt,51:at,54:X},e(y,[2,7]),e(y,[2,8]),e(y,[2,9]),e(y,[2,10]),e(y,[2,11]),e(y,[2,12],{14:[1,39],15:[1,40]}),e(y,[2,16]),{18:[1,41]},e(y,[2,18],{20:[1,42]}),{23:[1,43]},e(y,[2,22]),e(y,[2,23]),e(y,[2,24]),e(y,[2,25]),{30:44,31:[1,45],56:[1,46],57:[1,47]},e(y,[2,28]),{34:[1,48]},{36:[1,49]},e(y,[2,31]),{39:[1,50],41:[1,51]},{43:[1,52]},{46:[1,53]},e(nt,[2,42],{55:[1,54]}),e(nt,[2,43],{55:[1,55]}),e(y,[2,36]),e(y,[2,37]),e(y,[2,38]),e(y,[2,39]),e(y,[2,6]),e(y,[2,13]),{13:56,24:m,54:X},e(y,[2,17]),e(At,o,{7:57}),{24:[1,58]},{24:[1,59]},{23:[1,60]},{24:[2,46]},{24:[2,47]},e(y,[2,29]),e(y,[2,30]),{40:[1,61]},{40:[1,62]},{44:[1,63]},{47:[1,64]},{24:[1,65]},{24:[1,66]},e(y,[2,14],{14:[1,67]}),{4:c,5:r,8:8,9:10,10:12,11:13,12:14,13:15,16:d,17:f,19:g,21:[1,68],22:E,24:m,25:I,26:G,27:R,28:S,29:L,32:25,33:O,35:F,37:Y,38:w,42:$,45:et,48:st,49:it,50:rt,51:at,54:X},e(y,[2,20],{20:[1,69]}),{31:[1,70]},{24:[1,71]},e(y,[2,32]),e(y,[2,33]),e(y,[2,34]),e(y,[2,35]),e(nt,[2,44]),e(nt,[2,45]),e(y,[2,15]),e(y,[2,19]),e(At,o,{7:72}),e(y,[2,26]),e(y,[2,27]),{4:c,5:r,8:8,9:10,10:12,11:13,12:14,13:15,16:d,17:f,19:g,21:[1,73],22:E,24:m,25:I,26:G,27:R,28:S,29:L,32:25,33:O,35:F,37:Y,38:w,42:$,45:et,48:st,49:it,50:rt,51:at,54:X},e(y,[2,21])],defaultActions:{5:[2,1],6:[2,2],46:[2,46],47:[2,47]},parseError:p(function(l,h){if(h.recoverable)this.trace(l);else{var a=new Error(l);throw a.hash=h,a}},"parseError"),parse:p(function(l){var h=this,a=[0],T=[],_=[null],i=[],K=this.table,u="",V=0,z=0,ot=2,J=1,yt=i.slice.call(arguments,1),D=Object.create(this.lexer),M={yy:{}};for(var gt in this.yy)Object.prototype.hasOwnProperty.call(this.yy,gt)&&(M.yy[gt]=this.yy[gt]);D.setInput(l,M.yy),M.yy.lexer=D,M.yy.parser=this,typeof D.yylloc>"u"&&(D.yylloc={});var Tt=D.yylloc;i.push(Tt);var se=D.options&&D.options.ranges;typeof M.yy.parseError=="function"?this.parseError=M.yy.parseError:this.parseError=Object.getPrototypeOf(this).parseError;function ie(C){a.length=a.length-2*C,_.length=_.length-C,i.length=i.length-C}p(ie,"popStack");function Lt(){var C;return C=T.pop()||D.lex()||J,typeof C!="number"&&(C instanceof Array&&(T=C,C=T.pop()),C=h.symbols_[C]||C),C}p(Lt,"lex");for(var k,U,x,_t,W={},ct,N,It,ht;;){if(U=a[a.length-1],this.defaultActions[U]?x=this.defaultActions[U]:((k===null||typeof k>"u")&&(k=Lt()),x=K[U]&&K[U][k]),typeof x>"u"||!x.length||!x[0]){var Et="";ht=[];for(ct in K[U])this.terminals_[ct]&&ct>ot&&ht.push("'"+this.terminals_[ct]+"'");D.showPosition?Et="Parse error on line "+(V+1)+`:
`+D.showPosition()+`
Expecting `+ht.join(", ")+", got '"+(this.terminals_[k]||k)+"'":Et="Parse error on line "+(V+1)+": Unexpected "+(k==J?"end of input":"'"+(this.terminals_[k]||k)+"'"),this.parseError(Et,{text:D.match,token:this.terminals_[k]||k,line:D.yylineno,loc:Tt,expected:ht})}if(x[0]instanceof Array&&x.length>1)throw new Error("Parse Error: multiple actions possible at state: "+U+", token: "+k);switch(x[0]){case 1:a.push(k),_.push(D.yytext),i.push(D.yylloc),a.push(x[1]),k=null,z=D.yyleng,u=D.yytext,V=D.yylineno,Tt=D.yylloc;break;case 2:if(N=this.productions_[x[1]][1],W.$=_[_.length-N],W._$={first_line:i[i.length-(N||1)].first_line,last_line:i[i.length-1].last_line,first_column:i[i.length-(N||1)].first_column,last_column:i[i.length-1].last_column},se&&(W._$.range=[i[i.length-(N||1)].range[0],i[i.length-1].range[1]]),_t=this.performAction.apply(W,[u,z,V,M.yy,x[1],_,i].concat(yt)),typeof _t<"u")return _t;N&&(a=a.slice(0,-1*N*2),_=_.slice(0,-1*N),i=i.slice(0,-1*N)),a.push(this.productions_[x[1]][0]),_.push(W.$),i.push(W._$),It=K[a[a.length-2]][a[a.length-1]],a.push(It);break;case 3:return!0}}return!0},"parse")},ee=function(){var P={EOF:1,parseError:p(function(h,a){if(this.yy.parser)this.yy.parser.parseError(h,a);else throw new Error(h)},"parseError"),setInput:p(function(l,h){return this.yy=h||this.yy||{},this._input=l,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},"setInput"),input:p(function(){var l=this._input[0];this.yytext+=l,this.yyleng++,this.offset++,this.match+=l,this.matched+=l;var h=l.match(/(?:\r\n?|\n).*/g);return h?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),l},"input"),unput:p(function(l){var h=l.length,a=l.split(/(?:\r\n?|\n)/g);this._input=l+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-h),this.offset-=h;var T=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),a.length-1&&(this.yylineno-=a.length-1);var _=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:a?(a.length===T.length?this.yylloc.first_column:0)+T[T.length-a.length].length-a[0].length:this.yylloc.first_column-h},this.options.ranges&&(this.yylloc.range=[_[0],_[0]+this.yyleng-h]),this.yyleng=this.yytext.length,this},"unput"),more:p(function(){return this._more=!0,this},"more"),reject:p(function(){if(this.options.backtrack_lexer)this._backtrack=!0;else return this.parseError("Lexical error on line "+(this.yylineno+1)+`. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
`+this.showPosition(),{text:"",token:null,line:this.yylineno});return this},"reject"),less:p(function(l){this.unput(this.match.slice(l))},"less"),pastInput:p(function(){var l=this.matched.substr(0,this.matched.length-this.match.length);return(l.length>20?"...":"")+l.substr(-20).replace(/\n/g,"")},"pastInput"),upcomingInput:p(function(){var l=this.match;return l.length<20&&(l+=this._input.substr(0,20-l.length)),(l.substr(0,20)+(l.length>20?"...":"")).replace(/\n/g,"")},"upcomingInput"),showPosition:p(function(){var l=this.pastInput(),h=new Array(l.length+1).join("-");return l+this.upcomingInput()+`
`+h+"^"},"showPosition"),test_match:p(function(l,h){var a,T,_;if(this.options.backtrack_lexer&&(_={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges&&(_.yylloc.range=this.yylloc.range.slice(0))),T=l[0].match(/(?:\r\n?|\n).*/g),T&&(this.yylineno+=T.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:T?T[T.length-1].length-T[T.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+l[0].length},this.yytext+=l[0],this.match+=l[0],this.matches=l,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._backtrack=!1,this._input=this._input.slice(l[0].length),this.matched+=l[0],a=this.performAction.call(this,this.yy,this,h,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1),a)return a;if(this._backtrack){for(var i in _)this[i]=_[i];return!1}return!1},"test_match"),next:p(function(){if(this.done)return this.EOF;this._input||(this.done=!0);var l,h,a,T;this._more||(this.yytext="",this.match="");for(var _=this._currentRules(),i=0;i<_.length;i++)if(a=this._input.match(this.rules[_[i]]),a&&(!h||a[0].length>h[0].length)){if(h=a,T=i,this.options.backtrack_lexer){if(l=this.test_match(a,_[i]),l!==!1)return l;if(this._backtrack){h=!1;continue}else return!1}else if(!this.options.flex)break}return h?(l=this.test_match(h,_[T]),l!==!1?l:!1):this._input===""?this.EOF:this.parseError("Lexical error on line "+(this.yylineno+1)+`. Unrecognized text.
`+this.showPosition(),{text:"",token:null,line:this.yylineno})},"next"),lex:p(function(){var h=this.next();return h||this.lex()},"lex"),begin:p(function(h){this.conditionStack.push(h)},"begin"),popState:p(function(){var h=this.conditionStack.length-1;return h>0?this.conditionStack.pop():this.conditionStack[0]},"popState"),_currentRules:p(function(){return this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1]?this.conditions[this.conditionStack[this.conditionStack.length-1]].rules:this.conditions.INITIAL.rules},"_currentRules"),topState:p(function(h){return h=this.conditionStack.length-1-Math.abs(h||0),h>=0?this.conditionStack[h]:"INITIAL"},"topState"),pushState:p(function(h){this.begin(h)},"pushState"),stateStackSize:p(function(){return this.conditionStack.length},"stateStackSize"),options:{"case-insensitive":!0},performAction:p(function(h,a,T,_){switch(T){case 0:return 41;case 1:return 48;case 2:return 49;case 3:return 50;case 4:return 51;case 5:break;case 6:break;case 7:return 5;case 8:break;case 9:break;case 10:break;case 11:break;case 12:return this.pushState("SCALE"),17;case 13:return 18;case 14:this.popState();break;case 15:return this.begin("acc_title"),33;case 16:return this.popState(),"acc_title_value";case 17:return this.begin("acc_descr"),35;case 18:return this.popState(),"acc_descr_value";case 19:this.begin("acc_descr_multiline");break;case 20:this.popState();break;case 21:return"acc_descr_multiline_value";case 22:return this.pushState("CLASSDEF"),38;case 23:return this.popState(),this.pushState("CLASSDEFID"),"DEFAULT_CLASSDEF_ID";case 24:return this.popState(),this.pushState("CLASSDEFID"),39;case 25:return this.popState(),40;case 26:return this.pushState("CLASS"),45;case 27:return this.popState(),this.pushState("CLASS_STYLE"),46;case 28:return this.popState(),47;case 29:return this.pushState("STYLE"),42;case 30:return this.popState(),this.pushState("STYLEDEF_STYLES"),43;case 31:return this.popState(),44;case 32:return this.pushState("SCALE"),17;case 33:return 18;case 34:this.popState();break;case 35:this.pushState("STATE");break;case 36:return this.popState(),a.yytext=a.yytext.slice(0,-8).trim(),25;case 37:return this.popState(),a.yytext=a.yytext.slice(0,-8).trim(),26;case 38:return this.popState(),a.yytext=a.yytext.slice(0,-10).trim(),27;case 39:return this.popState(),a.yytext=a.yytext.slice(0,-8).trim(),25;case 40:return this.popState(),a.yytext=a.yytext.slice(0,-8).trim(),26;case 41:return this.popState(),a.yytext=a.yytext.slice(0,-10).trim(),27;case 42:return 48;case 43:return 49;case 44:return 50;case 45:return 51;case 46:this.pushState("STATE_STRING");break;case 47:return this.pushState("STATE_ID"),"AS";case 48:return this.popState(),"ID";case 49:this.popState();break;case 50:return"STATE_DESCR";case 51:return 19;case 52:this.popState();break;case 53:return this.popState(),this.pushState("struct"),20;case 54:break;case 55:return this.popState(),21;case 56:break;case 57:return this.begin("NOTE"),29;case 58:return this.popState(),this.pushState("NOTE_ID"),56;case 59:return this.popState(),this.pushState("NOTE_ID"),57;case 60:this.popState(),this.pushState("FLOATING_NOTE");break;case 61:return this.popState(),this.pushState("FLOATING_NOTE_ID"),"AS";case 62:break;case 63:return"NOTE_TEXT";case 64:return this.popState(),"ID";case 65:return this.popState(),this.pushState("NOTE_TEXT"),24;case 66:return this.popState(),a.yytext=a.yytext.substr(2).trim(),31;case 67:return this.popState(),a.yytext=a.yytext.slice(0,-8).trim(),31;case 68:return 6;case 69:return 6;case 70:return 16;case 71:return 54;case 72:return 24;case 73:return a.yytext=a.yytext.trim(),14;case 74:return 15;case 75:return 28;case 76:return 55;case 77:return 5;case 78:return"INVALID"}},"anonymous"),rules:[/^(?:default\b)/i,/^(?:.*direction\s+TB[^\n]*)/i,/^(?:.*direction\s+BT[^\n]*)/i,/^(?:.*direction\s+RL[^\n]*)/i,/^(?:.*direction\s+LR[^\n]*)/i,/^(?:%%(?!\{)[^\n]*)/i,/^(?:[^\}]%%[^\n]*)/i,/^(?:[\n]+)/i,/^(?:[\s]+)/i,/^(?:((?!\n)\s)+)/i,/^(?:#[^\n]*)/i,/^(?:%[^\n]*)/i,/^(?:scale\s+)/i,/^(?:\d+)/i,/^(?:\s+width\b)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:classDef\s+)/i,/^(?:DEFAULT\s+)/i,/^(?:\w+\s+)/i,/^(?:[^\n]*)/i,/^(?:class\s+)/i,/^(?:(\w+)+((,\s*\w+)*))/i,/^(?:[^\n]*)/i,/^(?:style\s+)/i,/^(?:[\w,]+\s+)/i,/^(?:[^\n]*)/i,/^(?:scale\s+)/i,/^(?:\d+)/i,/^(?:\s+width\b)/i,/^(?:state\s+)/i,/^(?:.*<<fork>>)/i,/^(?:.*<<join>>)/i,/^(?:.*<<choice>>)/i,/^(?:.*\[\[fork\]\])/i,/^(?:.*\[\[join\]\])/i,/^(?:.*\[\[choice\]\])/i,/^(?:.*direction\s+TB[^\n]*)/i,/^(?:.*direction\s+BT[^\n]*)/i,/^(?:.*direction\s+RL[^\n]*)/i,/^(?:.*direction\s+LR[^\n]*)/i,/^(?:["])/i,/^(?:\s*as\s+)/i,/^(?:[^\n\{]*)/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:[^\n\s\{]+)/i,/^(?:\n)/i,/^(?:\{)/i,/^(?:%%(?!\{)[^\n]*)/i,/^(?:\})/i,/^(?:[\n])/i,/^(?:note\s+)/i,/^(?:left of\b)/i,/^(?:right of\b)/i,/^(?:")/i,/^(?:\s*as\s*)/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:[^\n]*)/i,/^(?:\s*[^:\n\s\-]+)/i,/^(?:\s*:[^:\n;]+)/i,/^(?:[\s\S]*?end note\b)/i,/^(?:stateDiagram\s+)/i,/^(?:stateDiagram-v2\s+)/i,/^(?:hide empty description\b)/i,/^(?:\[\*\])/i,/^(?:[^:\n\s\-\{]+)/i,/^(?:\s*:[^:\n;]+)/i,/^(?:-->)/i,/^(?:--)/i,/^(?::::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{LINE:{rules:[9,10],inclusive:!1},struct:{rules:[9,10,22,26,29,35,42,43,44,45,54,55,56,57,71,72,73,74,75],inclusive:!1},FLOATING_NOTE_ID:{rules:[64],inclusive:!1},FLOATING_NOTE:{rules:[61,62,63],inclusive:!1},NOTE_TEXT:{rules:[66,67],inclusive:!1},NOTE_ID:{rules:[65],inclusive:!1},NOTE:{rules:[58,59,60],inclusive:!1},STYLEDEF_STYLEOPTS:{rules:[],inclusive:!1},STYLEDEF_STYLES:{rules:[31],inclusive:!1},STYLE_IDS:{rules:[],inclusive:!1},STYLE:{rules:[30],inclusive:!1},CLASS_STYLE:{rules:[28],inclusive:!1},CLASS:{rules:[27],inclusive:!1},CLASSDEFID:{rules:[25],inclusive:!1},CLASSDEF:{rules:[23,24],inclusive:!1},acc_descr_multiline:{rules:[20,21],inclusive:!1},acc_descr:{rules:[18],inclusive:!1},acc_title:{rules:[16],inclusive:!1},SCALE:{rules:[13,14,33,34],inclusive:!1},ALIAS:{rules:[],inclusive:!1},STATE_ID:{rules:[48],inclusive:!1},STATE_STRING:{rules:[49,50],inclusive:!1},FORK_STATE:{rules:[],inclusive:!1},STATE:{rules:[9,10,36,37,38,39,40,41,46,47,51,52,53],inclusive:!1},ID:{rules:[9,10],inclusive:!1},INITIAL:{rules:[0,1,2,3,4,5,6,7,8,10,11,12,15,17,19,22,26,29,32,35,53,57,68,69,70,71,72,73,74,76,77,78],inclusive:!0}}};return P}();St.lexer=ee;function lt(){this.yy={}}return p(lt,"Parser"),lt.prototype=St,St.Parser=lt,new lt}();bt.parser=bt;var Xe=bt,Te="TB",Mt="TB",Rt="dir",dt="state",vt="relation",_e="classDef",Ee="style",me="applyClass",Q="default",Ut="divider",jt="fill:none",Ht="fill: #333",zt="c",Wt="text",Xt="normal",mt="rect",Dt="rectWithTitle",De="stateStart",be="stateEnd",Ot="divider",Nt="roundedWithTitle",ve="note",ke="noteGroup",tt="statediagram",Ce="state",xe=`${tt}-${Ce}`,Kt="transition",Ae="note",Le="note-edge",Ie=`${Kt} ${Le}`,Re=`${tt}-${Ae}`,Oe="cluster",Ne=`${tt}-${Oe}`,we="cluster-alt",$e=`${tt}-${we}`,Jt="parent",qt="note",Pe="state",xt="----",Be=`${xt}${qt}`,wt=`${xt}${Jt}`,Zt=p((e,t=Mt)=>{if(!e.doc)return t;let s=t;for(const n of e.doc)n.stmt==="dir"&&(s=n.value);return s},"getDir"),Ge=p(function(e,t){return t.db.getClasses()},"getClasses"),Fe=p(async function(e,t,s,n){v.info("REF0:"),v.info("Drawing state diagram (v2)",t);const{securityLevel:o,state:c,layout:r}=A();n.db.extract(n.db.getRootDocV2());const d=n.db.getData(),f=ne(t,o);d.type=n.type,d.layoutAlgorithm=r,d.nodeSpacing=(c==null?void 0:c.nodeSpacing)||50,d.rankSpacing=(c==null?void 0:c.rankSpacing)||50,d.markers=["barb"],d.diagramId=t,await ye(d,f);const g=8;ge.insertTitle(f,"statediagramTitleText",(c==null?void 0:c.titleTopMargin)??25,n.db.getDiagramTitle()),le(f,g,tt,(c==null?void 0:c.useMaxWidth)??!0)},"draw"),Ke={getClasses:Ge,draw:Fe,getDir:Zt},ft=new Map,B=0;function pt(e="",t=0,s="",n=xt){const o=s!==null&&s.length>0?`${n}${s}`:"";return`${Pe}-${e}${o}-${t}`}p(pt,"stateDomId");var Ye=p((e,t,s,n,o,c,r,d)=>{v.trace("items",t),t.forEach(f=>{switch(f.stmt){case dt:Z(e,f,s,n,o,c,r,d);break;case Q:Z(e,f,s,n,o,c,r,d);break;case vt:{Z(e,f.state1,s,n,o,c,r,d),Z(e,f.state2,s,n,o,c,r,d);const g={id:"edge"+B,start:f.state1.id,end:f.state2.id,arrowhead:"normal",arrowTypeEnd:"arrow_barb",style:jt,labelStyle:"",label:j.sanitizeText(f.description,A()),arrowheadStyle:Ht,labelpos:zt,labelType:Wt,thickness:Xt,classes:Kt,look:r};o.push(g),B++}break}})},"setupDoc"),$t=p((e,t=Mt)=>{let s=t;if(e.doc)for(const n of e.doc)n.stmt==="dir"&&(s=n.value);return s},"getDir");function q(e,t,s){if(!t.id||t.id==="</join></fork>"||t.id==="</choice>")return;t.cssClasses&&(Array.isArray(t.cssCompiledStyles)||(t.cssCompiledStyles=[]),t.cssClasses.split(" ").forEach(o=>{if(s.get(o)){const c=s.get(o);t.cssCompiledStyles=[...t.cssCompiledStyles,...c.styles]}}));const n=e.find(o=>o.id===t.id);n?Object.assign(n,t):e.push(t)}p(q,"insertOrUpdateNode");function Qt(e){var t;return((t=e==null?void 0:e.classes)==null?void 0:t.join(" "))??""}p(Qt,"getClassesFromDbInfo");function te(e){return(e==null?void 0:e.styles)??[]}p(te,"getStylesFromDbInfo");var Z=p((e,t,s,n,o,c,r,d)=>{var I,G;const f=t.id,g=s.get(f),E=Qt(g),m=te(g);if(v.info("dataFetcher parsedItem",t,g,m),f!=="root"){let R=mt;t.start===!0?R=De:t.start===!1&&(R=be),t.type!==Q&&(R=t.type),ft.get(f)||ft.set(f,{id:f,shape:R,description:j.sanitizeText(f,A()),cssClasses:`${E} ${xe}`,cssStyles:m});const S=ft.get(f);t.description&&(Array.isArray(S.description)?(S.shape=Dt,S.description.push(t.description)):((I=S.description)==null?void 0:I.length)>0?(S.shape=Dt,S.description===f?S.description=[t.description]:S.description=[S.description,t.description]):(S.shape=mt,S.description=t.description),S.description=j.sanitizeTextOrArray(S.description,A())),((G=S.description)==null?void 0:G.length)===1&&S.shape===Dt&&(S.type==="group"?S.shape=Nt:S.shape=mt),!S.type&&t.doc&&(v.info("Setting cluster for XCX",f,$t(t)),S.type="group",S.isGroup=!0,S.dir=$t(t),S.shape=t.type===Ut?Ot:Nt,S.cssClasses=`${S.cssClasses} ${Ne} ${c?$e:""}`);const L={labelStyle:"",shape:S.shape,label:S.description,cssClasses:S.cssClasses,cssCompiledStyles:[],cssStyles:S.cssStyles,id:f,dir:S.dir,domId:pt(f,B),type:S.type,isGroup:S.type==="group",padding:8,rx:10,ry:10,look:r};if(L.shape===Ot&&(L.label=""),e&&e.id!=="root"&&(v.trace("Setting node ",f," to be child of its parent ",e.id),L.parentId=e.id),L.centerLabel=!0,t.note){const O={labelStyle:"",shape:ve,label:t.note.text,cssClasses:Re,cssStyles:[],cssCompilesStyles:[],id:f+Be+"-"+B,domId:pt(f,B,qt),type:S.type,isGroup:S.type==="group",padding:A().flowchart.padding,look:r,position:t.note.position},F=f+wt,Y={labelStyle:"",shape:ke,label:t.note.text,cssClasses:S.cssClasses,cssStyles:[],id:f+wt,domId:pt(f,B,Jt),type:"group",isGroup:!0,padding:16,look:r,position:t.note.position};B++,Y.id=F,O.parentId=F,q(n,Y,d),q(n,O,d),q(n,L,d);let w=f,$=O.id;t.note.position==="left of"&&(w=O.id,$=f),o.push({id:w+"-"+$,start:w,end:$,arrowhead:"none",arrowTypeEnd:"",style:jt,labelStyle:"",classes:Ie,arrowheadStyle:Ht,labelpos:zt,labelType:Wt,thickness:Xt,look:r})}else q(n,L,d)}t.doc&&(v.trace("Adding nodes children "),Ye(t,t.doc,s,n,o,!c,r,d))},"dataFetcher"),Ve=p(()=>{ft.clear(),B=0},"reset"),kt="[*]",Pt="start",Bt=kt,Gt="end",Ft="color",Yt="fill",Me="bgFill",Ue=",";function Ct(){return new Map}p(Ct,"newClassesList");var Vt=p(()=>({relations:[],states:new Map,documents:{}}),"newDoc"),ut=p(e=>JSON.parse(JSON.stringify(e)),"clone"),H,Je=(H=class{constructor(t){b(this,"version");b(this,"nodes",[]);b(this,"edges",[]);b(this,"rootDoc",[]);b(this,"classes",Ct());b(this,"documents",{root:Vt()});b(this,"currentDocument",this.documents.root);b(this,"startEndCount",0);b(this,"dividerCnt",0);b(this,"getAccTitle",he);b(this,"setAccTitle",ue);b(this,"getAccDescription",de);b(this,"setAccDescription",fe);b(this,"setDiagramTitle",pe);b(this,"getDiagramTitle",Se);this.clear(),this.version=t,this.setRootDoc=this.setRootDoc.bind(this),this.getDividerId=this.getDividerId.bind(this),this.setDirection=this.setDirection.bind(this),this.trimColon=this.trimColon.bind(this)}setRootDoc(t){v.info("Setting root doc",t),this.rootDoc=t,this.version===1?this.extract(t):this.extract(this.getRootDocV2())}getRootDoc(){return this.rootDoc}docTranslator(t,s,n){if(s.stmt===vt)this.docTranslator(t,s.state1,!0),this.docTranslator(t,s.state2,!1);else if(s.stmt===dt&&(s.id==="[*]"?(s.id=n?t.id+"_start":t.id+"_end",s.start=n):s.id=s.id.trim()),s.doc){const o=[];let c=[],r;for(r=0;r<s.doc.length;r++)if(s.doc[r].type===Ut){const d=ut(s.doc[r]);d.doc=ut(c),o.push(d),c=[]}else c.push(s.doc[r]);if(o.length>0&&c.length>0){const d={stmt:dt,id:oe(),type:"divider",doc:ut(c)};o.push(ut(d)),s.doc=o}s.doc.forEach(d=>this.docTranslator(s,d,!0))}}getRootDocV2(){return this.docTranslator({id:"root"},{id:"root",doc:this.rootDoc},!0),{id:"root",doc:this.rootDoc}}extract(t){let s;t.doc?s=t.doc:s=t,v.info(s),this.clear(!0),v.info("Extract initial document:",s),s.forEach(r=>{switch(v.warn("Statement",r.stmt),r.stmt){case dt:this.addState(r.id.trim(),r.type,r.doc,r.description,r.note,r.classes,r.styles,r.textStyles);break;case vt:this.addRelation(r.state1,r.state2,r.description);break;case _e:this.addStyleClass(r.id.trim(),r.classes);break;case Ee:{const d=r.id.trim().split(","),f=r.styleClass.split(",");d.forEach(g=>{let E=this.getState(g);if(E===void 0){const m=g.trim();this.addState(m),E=this.getState(m)}E.styles=f.map(m=>{var I;return(I=m.replace(/;/g,""))==null?void 0:I.trim()})})}break;case me:this.setCssClass(r.id.trim(),r.styleClass);break}});const n=this.getStates(),c=A().look;Ve(),Z(void 0,this.getRootDocV2(),n,this.nodes,this.edges,!0,c,this.classes),this.nodes.forEach(r=>{if(Array.isArray(r.label)){if(r.description=r.label.slice(1),r.isGroup&&r.description.length>0)throw new Error("Group nodes can only have label. Remove the additional description for node ["+r.id+"]");r.label=r.label[0]}})}addState(t,s=Q,n=null,o=null,c=null,r=null,d=null,f=null){const g=t==null?void 0:t.trim();if(this.currentDocument.states.has(g)?(this.currentDocument.states.get(g).doc||(this.currentDocument.states.get(g).doc=n),this.currentDocument.states.get(g).type||(this.currentDocument.states.get(g).type=s)):(v.info("Adding state ",g,o),this.currentDocument.states.set(g,{id:g,descriptions:[],type:s,doc:n,note:c,classes:[],styles:[],textStyles:[]})),o&&(v.info("Setting state description",g,o),typeof o=="string"&&this.addDescription(g,o.trim()),typeof o=="object"&&o.forEach(E=>this.addDescription(g,E.trim()))),c){const E=this.currentDocument.states.get(g);E.note=c,E.note.text=j.sanitizeText(E.note.text,A())}r&&(v.info("Setting state classes",g,r),(typeof r=="string"?[r]:r).forEach(m=>this.setCssClass(g,m.trim()))),d&&(v.info("Setting state styles",g,d),(typeof d=="string"?[d]:d).forEach(m=>this.setStyle(g,m.trim()))),f&&(v.info("Setting state styles",g,d),(typeof f=="string"?[f]:f).forEach(m=>this.setTextStyle(g,m.trim())))}clear(t){this.nodes=[],this.edges=[],this.documents={root:Vt()},this.currentDocument=this.documents.root,this.startEndCount=0,this.classes=Ct(),t||ce()}getState(t){return this.currentDocument.states.get(t)}getStates(){return this.currentDocument.states}logDocuments(){v.info("Documents = ",this.documents)}getRelations(){return this.currentDocument.relations}startIdIfNeeded(t=""){let s=t;return t===kt&&(this.startEndCount++,s=`${Pt}${this.startEndCount}`),s}startTypeIfNeeded(t="",s=Q){return t===kt?Pt:s}endIdIfNeeded(t=""){let s=t;return t===Bt&&(this.startEndCount++,s=`${Gt}${this.startEndCount}`),s}endTypeIfNeeded(t="",s=Q){return t===Bt?Gt:s}addRelationObjs(t,s,n){let o=this.startIdIfNeeded(t.id.trim()),c=this.startTypeIfNeeded(t.id.trim(),t.type),r=this.startIdIfNeeded(s.id.trim()),d=this.startTypeIfNeeded(s.id.trim(),s.type);this.addState(o,c,t.doc,t.description,t.note,t.classes,t.styles,t.textStyles),this.addState(r,d,s.doc,s.description,s.note,s.classes,s.styles,s.textStyles),this.currentDocument.relations.push({id1:o,id2:r,relationTitle:j.sanitizeText(n,A())})}addRelation(t,s,n){if(typeof t=="object")this.addRelationObjs(t,s,n);else{const o=this.startIdIfNeeded(t.trim()),c=this.startTypeIfNeeded(t),r=this.endIdIfNeeded(s.trim()),d=this.endTypeIfNeeded(s);this.addState(o,c),this.addState(r,d),this.currentDocument.relations.push({id1:o,id2:r,title:j.sanitizeText(n,A())})}}addDescription(t,s){const n=this.currentDocument.states.get(t),o=s.startsWith(":")?s.replace(":","").trim():s;n.descriptions.push(j.sanitizeText(o,A()))}cleanupLabel(t){return t.substring(0,1)===":"?t.substr(2).trim():t.trim()}getDividerId(){return this.dividerCnt++,"divider-id-"+this.dividerCnt}addStyleClass(t,s=""){this.classes.has(t)||this.classes.set(t,{id:t,styles:[],textStyles:[]});const n=this.classes.get(t);s!=null&&s.split(Ue).forEach(o=>{const c=o.replace(/([^;]*);/,"$1").trim();if(RegExp(Ft).exec(o)){const d=c.replace(Yt,Me).replace(Ft,Yt);n.textStyles.push(d)}n.styles.push(c)})}getClasses(){return this.classes}setCssClass(t,s){t.split(",").forEach(n=>{let o=this.getState(n);if(o===void 0){const c=n.trim();this.addState(c),o=this.getState(c)}o.classes.push(s)})}setStyle(t,s){const n=this.getState(t);n!==void 0&&n.styles.push(s)}setTextStyle(t,s){const n=this.getState(t);n!==void 0&&n.textStyles.push(s)}getDirectionStatement(){return this.rootDoc.find(t=>t.stmt===Rt)}getDirection(){var t;return((t=this.getDirectionStatement())==null?void 0:t.value)??Te}setDirection(t){const s=this.getDirectionStatement();s?s.value=t:this.rootDoc.unshift({stmt:Rt,value:t})}trimColon(t){return t&&t[0]===":"?t.substr(1).trim():t.trim()}getData(){const t=A();return{nodes:this.nodes,edges:this.edges,other:{},config:t,direction:Zt(this.getRootDocV2())}}getConfig(){return A().state}},p(H,"StateDB"),b(H,"relationType",{AGGREGATION:0,EXTENSION:1,COMPOSITION:2,DEPENDENCY:3}),H),je=p(e=>`
defs #statediagram-barbEnd {
    fill: ${e.transitionColor};
    stroke: ${e.transitionColor};
  }
g.stateGroup text {
  fill: ${e.nodeBorder};
  stroke: none;
  font-size: 10px;
}
g.stateGroup text {
  fill: ${e.textColor};
  stroke: none;
  font-size: 10px;

}
g.stateGroup .state-title {
  font-weight: bolder;
  fill: ${e.stateLabelColor};
}

g.stateGroup rect {
  fill: ${e.mainBkg};
  stroke: ${e.nodeBorder};
}

g.stateGroup line {
  stroke: ${e.lineColor};
  stroke-width: 1;
}

.transition {
  stroke: ${e.transitionColor};
  stroke-width: 1;
  fill: none;
}

.stateGroup .composit {
  fill: ${e.background};
  border-bottom: 1px
}

.stateGroup .alt-composit {
  fill: #e0e0e0;
  border-bottom: 1px
}

.state-note {
  stroke: ${e.noteBorderColor};
  fill: ${e.noteBkgColor};

  text {
    fill: ${e.noteTextColor};
    stroke: none;
    font-size: 10px;
  }
}

.stateLabel .box {
  stroke: none;
  stroke-width: 0;
  fill: ${e.mainBkg};
  opacity: 0.5;
}

.edgeLabel .label rect {
  fill: ${e.labelBackgroundColor};
  opacity: 0.5;
}
.edgeLabel {
  background-color: ${e.edgeLabelBackground};
  p {
    background-color: ${e.edgeLabelBackground};
  }
  rect {
    opacity: 0.5;
    background-color: ${e.edgeLabelBackground};
    fill: ${e.edgeLabelBackground};
  }
  text-align: center;
}
.edgeLabel .label text {
  fill: ${e.transitionLabelColor||e.tertiaryTextColor};
}
.label div .edgeLabel {
  color: ${e.transitionLabelColor||e.tertiaryTextColor};
}

.stateLabel text {
  fill: ${e.stateLabelColor};
  font-size: 10px;
  font-weight: bold;
}

.node circle.state-start {
  fill: ${e.specialStateColor};
  stroke: ${e.specialStateColor};
}

.node .fork-join {
  fill: ${e.specialStateColor};
  stroke: ${e.specialStateColor};
}

.node circle.state-end {
  fill: ${e.innerEndBackground};
  stroke: ${e.background};
  stroke-width: 1.5
}
.end-state-inner {
  fill: ${e.compositeBackground||e.background};
  // stroke: ${e.background};
  stroke-width: 1.5
}

.node rect {
  fill: ${e.stateBkg||e.mainBkg};
  stroke: ${e.stateBorder||e.nodeBorder};
  stroke-width: 1px;
}
.node polygon {
  fill: ${e.mainBkg};
  stroke: ${e.stateBorder||e.nodeBorder};;
  stroke-width: 1px;
}
#statediagram-barbEnd {
  fill: ${e.lineColor};
}

.statediagram-cluster rect {
  fill: ${e.compositeTitleBackground};
  stroke: ${e.stateBorder||e.nodeBorder};
  stroke-width: 1px;
}

.cluster-label, .nodeLabel {
  color: ${e.stateLabelColor};
  // line-height: 1;
}

.statediagram-cluster rect.outer {
  rx: 5px;
  ry: 5px;
}
.statediagram-state .divider {
  stroke: ${e.stateBorder||e.nodeBorder};
}

.statediagram-state .title-state {
  rx: 5px;
  ry: 5px;
}
.statediagram-cluster.statediagram-cluster .inner {
  fill: ${e.compositeBackground||e.background};
}
.statediagram-cluster.statediagram-cluster-alt .inner {
  fill: ${e.altBackground?e.altBackground:"#efefef"};
}

.statediagram-cluster .inner {
  rx:0;
  ry:0;
}

.statediagram-state rect.basic {
  rx: 5px;
  ry: 5px;
}
.statediagram-state rect.divider {
  stroke-dasharray: 10,10;
  fill: ${e.altBackground?e.altBackground:"#efefef"};
}

.note-edge {
  stroke-dasharray: 5;
}

.statediagram-note rect {
  fill: ${e.noteBkgColor};
  stroke: ${e.noteBorderColor};
  stroke-width: 1px;
  rx: 0;
  ry: 0;
}
.statediagram-note rect {
  fill: ${e.noteBkgColor};
  stroke: ${e.noteBorderColor};
  stroke-width: 1px;
  rx: 0;
  ry: 0;
}

.statediagram-note text {
  fill: ${e.noteTextColor};
}

.statediagram-note .nodeLabel {
  color: ${e.noteTextColor};
}
.statediagram .edgeLabel {
  color: red; // ${e.noteTextColor};
}

#dependencyStart, #dependencyEnd {
  fill: ${e.lineColor};
  stroke: ${e.lineColor};
  stroke-width: 1;
}

.statediagramTitleText {
  text-anchor: middle;
  font-size: 18px;
  fill: ${e.textColor};
}
`,"getStyles"),qe=je;export{Je as S,qe as a,Ke as b,Xe as s};
