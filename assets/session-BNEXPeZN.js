(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))r(s);new MutationObserver(s=>{for(const o of s)if(o.type==="childList")for(const i of o.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&r(i)}).observe(document,{childList:!0,subtree:!0});function n(s){const o={};return s.integrity&&(o.integrity=s.integrity),s.referrerPolicy&&(o.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?o.credentials="include":s.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function r(s){if(s.ep)return;s.ep=!0;const o=n(s);fetch(s.href,o)}})();class te extends Error{context;constructor(t,n){super(t),this.name="TokenizerError",this.context=n}}class R extends Error{context;pos;constructor(t,n,r){super(t),this.name="ReaderError",this.context=n,this.pos=r}}class a extends Error{context;pos;constructor(t,n,r){super(t),this.name="EvaluationError",this.context=n,this.pos=r}}class je{value;constructor(t){this.value=t}}const g={number:"number",string:"string",boolean:"boolean",keyword:"keyword",nil:"nil",symbol:"symbol",list:"list",vector:"vector",map:"map",function:"function",nativeFunction:"native-function",macro:"macro",multiMethod:"multi-method",atom:"atom",reduced:"reduced",volatile:"volatile",regex:"regex"},k={LParen:"LParen",RParen:"RParen",LBracket:"LBracket",RBracket:"RBracket",LBrace:"LBrace",RBrace:"RBrace",String:"String",Number:"Number",Keyword:"Keyword",Quote:"Quote",Quasiquote:"Quasiquote",Unquote:"Unquote",UnquoteSplicing:"UnquoteSplicing",Comment:"Comment",Whitespace:"Whitespace",Symbol:"Symbol",AnonFnStart:"AnonFnStart",Deref:"Deref",Regex:"Regex"},Z={Quote:"quote",Quasiquote:"quasiquote",Unquote:"unquote",UnquoteSplicing:"unquote-splicing",LParen:"(",RParen:")",LBracket:"[",RBracket:"]",LBrace:"{",RBrace:"}"};function h(e){switch(e.kind){case g.number:return e.value.toString();case g.string:let t="";for(const n of e.value)switch(n){case'"':t+='\\"';break;case"\\":t+="\\\\";break;case`
`:t+="\\n";break;case"\r":t+="\\r";break;case"	":t+="\\t";break;default:t+=n}return`"${t}"`;case g.boolean:return e.value?"true":"false";case g.nil:return"nil";case g.keyword:return`${e.name}`;case g.symbol:return`${e.name}`;case g.list:return`(${e.value.map(h).join(" ")})`;case g.vector:return`[${e.value.map(h).join(" ")}]`;case g.map:return`{${e.entries.map(([n,r])=>`${h(n)} ${h(r)}`).join(" ")}}`;case g.function:{if(e.arities.length===1){const r=e.arities[0];return`(fn [${(r.restParam?[...r.params,{kind:"symbol",name:"&"},r.restParam]:r.params).map(h).join(" ")}] ${r.body.map(h).join(" ")})`}return`(fn ${e.arities.map(r=>`([${(r.restParam?[...r.params,{kind:"symbol",name:"&"},r.restParam]:r.params).map(h).join(" ")}] ${r.body.map(h).join(" ")})`).join(" ")})`}case g.nativeFunction:return`(native-fn ${e.name})`;case g.multiMethod:return`(multi-method ${e.name})`;case g.atom:return`#<Atom ${h(e.value)}>`;case g.reduced:return`#<Reduced ${h(e.value)}>`;case g.volatile:return`#<Volatile ${h(e.value)}>`;case g.regex:{const n=e.pattern.replace(/"/g,'\\"');return`#"${e.flags?`(?${e.flags})`:""}${n}"`}default:throw new a(`unhandled value type: ${e.kind}`,{value:e})}}function xe(e){return e.join(`
`)}class xt extends Error{context;constructor(t,n){super(t),this.context=n,this.name="EnvError"}}function we(e){return{bindings:new Map,outer:e??null}}function Fe(e,t){let n=t;for(;n;){if(n.bindings.has(e))return n.bindings.get(e);n=n.outer}throw new a(`Symbol ${e} not found`,{name:e})}function Ue(e,t){let n=t;for(;n;){if(n.bindings.has(e))return n.bindings.get(e);n=n.outer}}function G(e,t,n){n.bindings.set(e,t)}function ve(e,t,n){if(e.length!==t.length)throw new xt("Number of parameters and arguments must match",{params:e,args:t,outer:n});const r=we(n);for(let s=0;s<e.length;s++)G(e[s],t[s],r);return r}function ce(e){let t=e;for(;t?.outer;)t=t.outer;return t}function Ae(e){let t=e;for(;t;){if(t.namespace)return t;t=t.outer}return ce(e)}const L=e=>({kind:"number",value:e}),A=e=>({kind:"string",value:e}),y=e=>({kind:"boolean",value:e}),D=e=>({kind:"keyword",name:e}),v=()=>({kind:"nil",value:null}),N=e=>({kind:"symbol",name:e}),T=e=>({kind:"list",value:e}),M=e=>({kind:"vector",value:e}),W=e=>({kind:"map",entries:e}),Ze=(e,t)=>({kind:"function",arities:e,env:t}),c=(e,t)=>({kind:"native-function",name:e,fn:t}),O=(e,t)=>({kind:"native-function",name:e,fn:()=>{throw new a("Native function called without context",{name:e})},fnWithContext:t}),$t=(e,t)=>({kind:"macro",arities:e,env:t}),Ve=(e,t="")=>({kind:"regex",pattern:e,flags:t}),Rt=e=>({kind:"atom",value:e}),Ke=e=>({kind:"reduced",value:e}),qt=e=>({kind:"volatile",value:e}),u=(e,t,n)=>({...e,meta:W([[D(":doc"),A(t)],...n?[[D(":arglists"),M(n.map(r=>M(r.map(N))))]]:[]])}),Ne=(e,t,n,r)=>({kind:"multi-method",name:e,dispatchFn:t,methods:n,defaultMethod:r});function jt(e){if(e.kind==="nil")return[];if(S(e)||E(e))return e.value;throw new a(`Cannot destructure ${e.kind} as a sequential collection`,{value:e})}function Y(e,t){const n=e.entries.find(([r])=>P(r,t));return n?n[1]:void 0}function ke(e,t){return e.entries.some(([n])=>P(n,t))}function Ft(e,t,n,r){const s=[],o=[...e],i=o.findIndex(m=>I(m)&&m.kind==="keyword"&&m.name===":as");if(i!==-1){const m=o[i+1];if(!m||!q(m))throw new a(":as must be followed by a symbol",{pattern:e});s.push([m.name,t]),o.splice(i,2)}const l=o.findIndex(m=>q(m)&&m.name==="&");let p=null,f;if(l!==-1){if(p=o[l+1],!p)throw new a("& must be followed by a binding pattern",{pattern:e});f=l,o.splice(l)}else f=o.length;const d=jt(t);for(let m=0;m<f;m++)s.push(...ae(o[m],d[m]??v(),n,r));if(p!==null){const m=d.slice(f);let w;if(C(p)&&m.length>0){const F=[];for(let $=0;$<m.length;$+=2)F.push([m[$],m[$+1]??v()]);w={kind:"map",entries:F}}else w=m.length>0?T(m):v();s.push(...ae(p,w,n,r))}return s}function St(e,t,n,r){const s=[],o=Y(e,D(":or")),i=o&&C(o)?o:null,l=Y(e,D(":as"));if(!C(t)&&t.kind!=="nil")throw new a(`Cannot destructure ${t.kind} as a map`,{value:t,pattern:e});const p=t.kind==="nil"?{entries:[]}:t;for(const[f,d]of e.entries){if(I(f)&&f.name===":or"||I(f)&&f.name===":as")continue;if(I(f)&&f.name===":keys"){if(!E(d))throw new a(":keys must be followed by a vector of symbols",{pattern:e});for(const $ of d.value){if(!q($))throw new a(":keys vector must contain symbols",{pattern:e,sym:$});const H=$.name.indexOf("/"),b=H!==-1?$.name.slice(H+1):$.name,x=D(":"+$.name),j=ke(p,x),U=j?Y(p,x):void 0;let B;if(j)B=U;else if(i){const re=Y(i,N(b));B=re!==void 0?n.evaluate(re,r):v()}else B=v();s.push([b,B])}continue}if(I(f)&&f.name===":strs"){if(!E(d))throw new a(":strs must be followed by a vector of symbols",{pattern:e});for(const $ of d.value){if(!q($))throw new a(":strs vector must contain symbols",{pattern:e,sym:$});const H=A($.name),b=ke(p,H),x=b?Y(p,H):void 0;let j;if(b)j=x;else if(i){const U=Y(i,N($.name));j=U!==void 0?n.evaluate(U,r):v()}else j=v();s.push([$.name,j])}continue}if(I(f)&&f.name===":syms"){if(!E(d))throw new a(":syms must be followed by a vector of symbols",{pattern:e});for(const $ of d.value){if(!q($))throw new a(":syms vector must contain symbols",{pattern:e,sym:$});const H=N($.name),b=ke(p,H),x=b?Y(p,H):void 0;let j;if(b)j=x;else if(i){const U=Y(i,N($.name));j=U!==void 0?n.evaluate(U,r):v()}else j=v();s.push([$.name,j])}continue}const m=Y(p,d),w=ke(p,d);let F;if(w)F=m;else if(i&&q(f)){const $=Y(i,N(f.name));F=$!==void 0?n.evaluate($,r):v()}else F=v();s.push(...ae(f,F,n,r))}return l&&q(l)&&s.push([l.name,t]),s}function ae(e,t,n,r){if(q(e))return[[e.name,t]];if(E(e))return Ft(e.value,t,n,r);if(C(e))return St(e,t,n,r);throw new a(`Invalid destructuring pattern: expected symbol, vector, or map, got ${e.kind}`,{pattern:e})}class he{args;constructor(t){this.args=t}}function Qe(e,t){const n=e.value.findIndex(o=>q(o)&&o.name==="&");let r=[],s=null;if(n===-1)r=e.value;else{if(e.value.filter(i=>q(i)&&i.name==="&").length>1)throw new a("& can only appear once",{args:e,env:t});if(n!==e.value.length-2)throw new a("& must be second-to-last argument",{args:e,env:t});r=e.value.slice(0,n),s=e.value[n+1]}return{params:r,restParam:s}}function Be(e,t){if(e.length===0)throw new a("fn/defmacro requires at least a parameter vector",{forms:e,env:t});if(E(e[0])){const n=e[0],{params:r,restParam:s}=Qe(n,t);return[{params:r,restParam:s,body:e.slice(1)}]}if(S(e[0])){const n=[];for(const s of e){if(!S(s)||s.value.length===0)throw new a("Multi-arity clause must be a list starting with a parameter vector",{form:s,env:t});const o=s.value[0];if(!E(o))throw new a("First element of arity clause must be a parameter vector",{paramVec:o,env:t});const{params:i,restParam:l}=Qe(o,t);n.push({params:i,restParam:l,body:s.value.slice(1)})}if(n.filter(s=>s.restParam!==null).length>1)throw new a("At most one variadic arity is allowed per function",{forms:e,env:t});return n}throw new a("fn/defmacro expects a parameter vector or arity clauses",{forms:e,env:t})}function et(e,t,n,r,s,o){if(t===null){if(n.length!==e.length)throw new a(`Arguments length mismatch: fn accepts ${e.length} arguments, but ${n.length} were provided`,{params:e,args:n,outerEnv:r})}else if(n.length<e.length)throw new a(`Arguments length mismatch: fn expects at least ${e.length} arguments, but ${n.length} were provided`,{params:e,args:n,outerEnv:r});const i=[];for(let l=0;l<e.length;l++)i.push(...ae(e[l],n[l],s,o));if(t!==null){const l=n.slice(e.length);let p;if(C(t)&&l.length>0){const f=[];for(let d=0;d<l.length;d+=2)f.push([l[d],l[d+1]??v()]);p={kind:"map",entries:f}}else p=l.length>0?T(l):v();i.push(...ae(t,p,s,o))}return ve(i.map(([l])=>l),i.map(([,l])=>l),r)}function tt(e,t){const n=e.find(o=>o.restParam===null&&o.params.length===t);if(n)return n;const r=e.find(o=>o.restParam!==null&&t>=o.params.length);if(r)return r;const s=e.map(o=>o.restParam?`${o.params.length}+`:`${o.params.length}`);throw new a(`No matching arity for ${t} arguments. Available arities: ${s.join(", ")}`,{arities:e,argCount:t})}let Et=0;function nt(e="G"){return`${e}__${Et++}`}function $e(e,t,n=new Map,r){switch(e.kind){case g.vector:case g.list:{const s=S(e);if(s&&e.value.length===2&&q(e.value[0])&&e.value[0].name==="unquote")return r.evaluate(e.value[1],t);const o=[];for(const i of e.value){if(S(i)&&i.value.length===2&&q(i.value[0])&&i.value[0].name==="unquote-splicing"){const l=r.evaluate(i.value[1],t);if(!S(l)&&!E(l))throw new a("Unquote-splicing must evaluate to a list or vector",{elem:i,env:t});o.push(...l.value);continue}o.push($e(i,t,n,r))}return s?T(o):M(o)}case g.map:{const s=[];for(const[o,i]of e.entries){const l=$e(o,t,n,r),p=$e(i,t,n,r);s.push([l,p])}return W(s)}case g.number:case g.string:case g.boolean:case g.keyword:case g.nil:return e;case g.symbol:return e.name.endsWith("#")?(n.has(e.name)||n.set(e.name,nt(e.name.slice(0,-1))),{kind:"symbol",name:n.get(e.name)}):e;default:throw new a(`Unexpected form: ${e.kind}`,{form:e,env:t})}}function rt(e){Te(e,!0)}function Ct(e){return S(e)&&e.value.length>=1&&q(e.value[0])&&e.value[0].name===ee.recur}function Te(e,t){for(let n=0;n<e.length;n++)le(e[n],t&&n===e.length-1)}function le(e,t){if(!S(e))return;if(Ct(e)){if(!t)throw new a("Can only recur from tail position",{form:e});return}if(e.value.length===0)return;const n=e.value[0];if(!q(n)){for(const s of e.value)le(s,!1);return}const r=n.name;if(!(r===ee.fn||r===ee.loop||r===ee.quote||r===ee.quasiquote)){if(r===ee.if){e.value[1]&&le(e.value[1],!1),e.value[2]&&le(e.value[2],t),e.value[3]&&le(e.value[3],t);return}if(r===ee.do){Te(e.value.slice(1),t);return}if(r===ee.let){const s=e.value[1];if(E(s))for(let o=1;o<s.value.length;o+=2)le(s.value[o],!1);Te(e.value.slice(2),t);return}for(const s of e.value.slice(1))le(s,!1)}}const ee={quote:"quote",def:"def",if:"if",do:"do",let:"let",fn:"fn",defmacro:"defmacro",quasiquote:"quasiquote",ns:"ns",loop:"loop",recur:"recur",defmulti:"defmulti",defmethod:"defmethod",try:"try"};function At(e){return c(`kw:${e.name}`,(...t)=>{const n=t[0];if(!C(n))return v();const r=n.entries.find(([s])=>P(s,e));return r?r[1]:v()})}function It(e,t,n){const r=e.value.slice(1),s=[],o=[];let i=null;for(let d=0;d<r.length;d++){const m=r[d];if(S(m)&&m.value.length>0&&q(m.value[0])){const w=m.value[0].name;if(w==="catch"){if(m.value.length<3)throw new a("catch requires a discriminator and a binding symbol",{form:m,env:t});const F=m.value[1],$=m.value[2];if(!q($))throw new a("catch binding must be a symbol",{form:m,env:t});o.push({discriminator:F,binding:$.name,body:m.value.slice(3)});continue}if(w==="finally"){if(d!==r.length-1)throw new a("finally clause must be the last in try expression",{form:m,env:t});i=m.value.slice(1);continue}}s.push(m)}function l(d,m){const w=n.evaluate(d,t);if(I(w)){if(w.name===":default")return!0;if(!C(m))return!1;const F=m.entries.find(([$])=>I($)&&$.name===":type");return F?P(F[1],w):!1}if(K(w)){const F=n.applyFunction(w,[m],t);return Ce(F)}throw new a("catch discriminator must be a keyword or a predicate function",{discriminator:w,env:t})}let p=v(),f=null;try{p=n.evaluateForms(s,t)}catch(d){if(d instanceof he)throw d;let m;if(d instanceof je)m=d.value;else if(d instanceof a)m=W([[D(":type"),D(":error/runtime")],[D(":message"),A(d.message)]]);else throw d;let w=!1;for(const F of o)if(l(F.discriminator,m)){const $=ve([F.binding],[m],t);p=n.evaluateForms(F.body,$),w=!0;break}w||(f=d)}finally{i&&n.evaluateForms(i,t)}if(f!==null)throw f;return p}function Mt(e,t,n){return e.value[1]}function Pt(e,t,n){return $e(e.value[1],t,new Map,n)}function Ut(e,t,n){const r=e.value[1];if(r.kind!=="symbol")throw new a("First element of list must be a symbol",{name:r,list:e,env:t});return e.value[2]===void 0||G(r.name,n.evaluate(e.value[2],t),Ae(t)),v()}const Nt=(e,t,n)=>v();function Tt(e,t,n){const r=n.evaluate(e.value[1],t);return Ee(r)?e.value[3]?n.evaluate(e.value[3],t):v():n.evaluate(e.value[2],t)}function Lt(e,t,n){return n.evaluateForms(e.value.slice(1),t)}function Bt(e,t,n){const r=e.value[1];if(!E(r))throw new a("Bindings must be a vector",{bindings:r,env:t});if(r.value.length%2!==0)throw new a("Bindings must be a balanced pair of keys and values",{bindings:r,env:t});const s=e.value.slice(2);let o=t;for(let i=0;i<r.value.length;i+=2){const l=r.value[i],p=n.evaluate(r.value[i+1],o),f=ae(l,p,n,o);o=ve(f.map(([d])=>d),f.map(([,d])=>d),o)}return n.evaluateForms(s,o)}function Wt(e,t,n){const r=Be(e.value.slice(1),t);for(const s of r)rt(s.body);return Ze(r,t)}function zt(e,t,n){const r=e.value[1];if(!q(r))throw new a("First element of defmacro must be a symbol",{name:r,list:e,env:t});const s=Be(e.value.slice(2),t),o=$t(s,t);return G(r.name,o,ce(t)),v()}function Dt(e,t,n){const r=e.value[1];if(!E(r))throw new a("loop bindings must be a vector",{loopBindings:r,env:t});if(r.value.length%2!==0)throw new a("loop bindings must be a balanced pair of keys and values",{loopBindings:r,env:t});const s=e.value.slice(2);rt(s);const o=[],i=[];let l=t;for(let f=0;f<r.value.length;f+=2){const d=r.value[f],m=n.evaluate(r.value[f+1],l);o.push(d),i.push(m);const w=ae(d,m,n,l);l=ve(w.map(([F])=>F),w.map(([,F])=>F),l)}let p=i;for(;;){let f=t;for(let d=0;d<o.length;d++){const m=ae(o[d],p[d],n,f);f=ve(m.map(([w])=>w),m.map(([,w])=>w),f)}try{return n.evaluateForms(s,f)}catch(d){if(d instanceof he){if(d.args.length!==o.length)throw new a(`recur expects ${o.length} arguments but got ${d.args.length}`,{list:e,env:t});p=d.args;continue}throw d}}}function Ot(e,t,n){const r=e.value.slice(1).map(s=>n.evaluate(s,t));throw new he(r)}function Kt(e,t,n){const r=e.value[1];if(!q(r))throw new a("defmulti: first argument must be a symbol",{list:e,env:t});const s=e.value[2];let o;if(I(s))o=At(s);else{const l=n.evaluate(s,t);if(!K(l))throw new a("defmulti: dispatch-fn must be a function or keyword",{list:e,env:t});o=l}const i=Ne(r.name,o,[]);return G(r.name,i,Ae(t)),v()}function Qt(e,t,n){const r=e.value[1];if(!q(r))throw new a("defmethod: first argument must be a symbol",{list:e,env:t});const s=n.evaluate(e.value[2],t),o=Fe(r.name,t);if(!st(o))throw new a(`defmethod: ${r.name} is not a multimethod`,{list:e,env:t});const i=Be([e.value[3],...e.value.slice(4)],t),l=Ze(i,t),p=I(s)&&s.name===":default";let f;if(p)f=Ne(o.name,o.dispatchFn,o.methods,l);else{const d=o.methods.filter(m=>!P(m.dispatchVal,s));f=Ne(o.name,o.dispatchFn,[...d,{dispatchVal:s,fn:l}])}return G(r.name,f,Ae(t)),v()}const _t={try:It,quote:Mt,quasiquote:Pt,def:Ut,ns:Nt,if:Tt,do:Lt,let:Bt,fn:Wt,defmacro:zt,loop:Dt,recur:Ot,defmulti:Kt,defmethod:Qt};function Jt(e,t,n,r){const s=_t[e];if(s)return s(t,n,r);throw new a(`Unknown special form: ${e}`,{symbol:e,list:t,env:n})}const Se=e=>e.kind==="nil",Ee=e=>e.kind==="nil"?!0:e.kind==="boolean"?!e.value:!1,Ce=e=>!Ee(e),Gt=e=>e.kind==="symbol"&&e.name in ee,q=e=>e.kind==="symbol",E=e=>e.kind==="vector",S=e=>e.kind==="list",Ht=e=>e.kind==="function",Xt=e=>e.kind==="native-function",Le=e=>e.kind==="macro",C=e=>e.kind==="map",I=e=>e.kind==="keyword",K=e=>Ht(e)||Xt(e),Re=e=>K(e)||I(e)||C(e),st=e=>e.kind==="multi-method",be=e=>e.kind==="atom",fe=e=>e.kind==="reduced",qe=e=>e.kind==="volatile",ot=e=>e.kind==="regex",de=e=>E(e)||C(e)||S(e),_=e=>de(e)||e.kind==="string",mr=e=>typeof e=="object"&&e!==null&&"kind"in e&&e.kind in g,Yt={[g.number]:(e,t)=>e.value===t.value,[g.string]:(e,t)=>e.value===t.value,[g.boolean]:(e,t)=>e.value===t.value,[g.nil]:()=>!0,[g.symbol]:(e,t)=>e.name===t.name,[g.keyword]:(e,t)=>e.name===t.name,[g.vector]:(e,t)=>e.value.length!==t.value.length?!1:e.value.every((n,r)=>P(n,t.value[r])),[g.map]:(e,t)=>{if(e.entries.length!==t.entries.length)return!1;const n=new Set([...e.entries.map(([r])=>r),...t.entries.map(([r])=>r)]);for(const r of n){const s=e.entries.find(([i])=>P(i,r));if(!s)return!1;const o=t.entries.find(([i])=>P(i,r));if(!o||!P(s[1],o[1]))return!1}return!0},[g.list]:(e,t)=>e.value.length!==t.value.length?!1:e.value.every((n,r)=>P(n,t.value[r])),[g.atom]:(e,t)=>e===t,[g.reduced]:(e,t)=>P(e.value,t.value),[g.volatile]:(e,t)=>e===t,[g.regex]:(e,t)=>e===t},P=(e,t)=>{if(e.kind!==t.kind)return!1;const n=Yt[e.kind];return n?n(e,t):!1},Zt={"+":u(c("+",(...e)=>{if(e.length===0)return L(0);if(e.some(t=>t.kind!=="number"))throw new a("+ expects all arguments to be numbers",{args:e});return e.reduce((t,n)=>L(t.value+n.value),L(0))}),"Returns the sum of the arguments. Throws on non-number arguments.",[["&","nums"]]),"-":u(c("-",(...e)=>{if(e.length===0)throw new a("- expects at least one argument",{args:e});if(e.some(t=>t.kind!=="number"))throw new a("- expects all arguments to be numbers",{args:e});return e.slice(1).reduce((t,n)=>L(t.value-n.value),e[0])}),"Returns the difference of the arguments. Throws on non-number arguments.",[["&","nums"]]),"*":u(c("*",(...e)=>{if(e.length===0)return L(1);if(e.some(t=>t.kind!=="number"))throw new a("* expects all arguments to be numbers",{args:e});return e.slice(1).reduce((t,n)=>L(t.value*n.value),e[0])}),"Returns the product of the arguments. Throws on non-number arguments.",[["&","nums"]]),"/":u(c("/",(...e)=>{if(e.length===0)throw new a("/ expects at least one argument",{args:e});if(e.some(t=>t.kind!=="number"))throw new a("/ expects all arguments to be numbers",{args:e});return e.slice(1).reduce((t,n)=>{if(n.value===0)throw new a("division by zero",{args:e});return L(t.value/n.value)},e[0])}),"Returns the quotient of the arguments. Throws on non-number arguments or division by zero.",[["&","nums"]]),">":u(c(">",(...e)=>{if(e.length<2)throw new a("> expects at least two arguments",{args:e});if(e.some(t=>t.kind!=="number"))throw new a("> expects all arguments to be numbers",{args:e});for(let t=1;t<e.length;t++)if(e[t].value>=e[t-1].value)return y(!1);return y(!0)}),"Compares adjacent arguments left to right, returns true if all values are in ascending order, false otherwise.",[["&","nums"]]),"<":u(c("<",(...e)=>{if(e.length<2)throw new a("< expects at least two arguments",{args:e});if(e.some(t=>t.kind!=="number"))throw new a("< expects all arguments to be numbers",{args:e});for(let t=1;t<e.length;t++)if(e[t].value<=e[t-1].value)return y(!1);return y(!0)}),"Compares adjacent arguments left to right, returns true if all values are in descending order, false otherwise.",[["&","nums"]]),">=":u(c(">=",(...e)=>{if(e.length<2)throw new a(">= expects at least two arguments",{args:e});if(e.some(t=>t.kind!=="number"))throw new a(">= expects all arguments to be numbers",{args:e});for(let t=1;t<e.length;t++)if(e[t].value>e[t-1].value)return y(!1);return y(!0)}),"Compares adjacent arguments left to right, returns true if all comparisons returns true for greater than or equal to checks, false otherwise.",[["&","nums"]]),"<=":u(c("<=",(...e)=>{if(e.length<2)throw new a("<= expects at least two arguments",{args:e});if(e.some(t=>t.kind!=="number"))throw new a("<= expects all arguments to be numbers",{args:e});for(let t=1;t<e.length;t++)if(e[t].value<e[t-1].value)return y(!1);return y(!0)}),"Compares adjacent arguments left to right, returns true if all comparisons returns true for less than or equal to checks, false otherwise.",[["&","nums"]]),"=":u(c("=",(...e)=>{if(e.length<2)throw new a("= expects at least two arguments",{args:e});for(let t=1;t<e.length;t++)if(!P(e[t],e[t-1]))return y(!1);return y(!0)}),"Compares adjacent arguments left to right, returns true if all values are structurally equal, false otherwise.",[["&","vals"]]),inc:u(c("inc",e=>{if(e===void 0||e.kind!=="number")throw new a(`inc expects a number${e!==void 0?`, got ${h(e)}`:""}`,{x:e});return L(e.value+1)}),"Returns the argument incremented by 1. Throws on non-number arguments.",[["x"]]),dec:u(c("dec",e=>{if(e===void 0||e.kind!=="number")throw new a(`dec expects a number${e!==void 0?`, got ${h(e)}`:""}`,{x:e});return L(e.value-1)}),"Returns the argument decremented by 1. Throws on non-number arguments.",[["x"]]),max:u(c("max",(...e)=>{if(e.length===0)throw new a("max expects at least one argument",{args:e});if(e.some(t=>t.kind!=="number"))throw new a("max expects all arguments to be numbers",{args:e});return e.reduce((t,n)=>n.value>t.value?n:t)}),"Returns the largest of the arguments. Throws on non-number arguments.",[["&","nums"]]),min:u(c("min",(...e)=>{if(e.length===0)throw new a("min expects at least one argument",{args:e});if(e.some(t=>t.kind!=="number"))throw new a("min expects all arguments to be numbers",{args:e});return e.reduce((t,n)=>n.value<t.value?n:t)}),"Returns the smallest of the arguments. Throws on non-number arguments.",[["&","nums"]]),mod:u(c("mod",(e,t)=>{if(e===void 0||e.kind!=="number")throw new a(`mod expects a number as first argument${e!==void 0?`, got ${h(e)}`:""}`,{n:e});if(t===void 0||t.kind!=="number")throw new a(`mod expects a number as second argument${t!==void 0?`, got ${h(t)}`:""}`,{d:t});if(t.value===0)throw new a("mod: division by zero",{n:e,d:t});const n=e.value%t.value;return L(n<0?n+Math.abs(t.value):n)}),"Returns the remainder of the first argument divided by the second argument. Throws on non-number arguments or division by zero.",[["n","d"]]),"even?":u(c("even?",e=>{if(e===void 0||e.kind!=="number")throw new a(`even? expects a number${e!==void 0?`, got ${h(e)}`:""}`,{n:e});return y(e.value%2===0)}),"Returns true if the argument is an even number, false otherwise.",[["n"]]),"odd?":u(c("odd?",e=>{if(e===void 0||e.kind!=="number")throw new a(`odd? expects a number${e!==void 0?`, got ${h(e)}`:""}`,{n:e});return y(Math.abs(e.value)%2!==0)}),"Returns true if the argument is an odd number, false otherwise.",[["n"]]),"pos?":u(c("pos?",e=>{if(e===void 0||e.kind!=="number")throw new a(`pos? expects a number${e!==void 0?`, got ${h(e)}`:""}`,{n:e});return y(e.value>0)}),"Returns true if the argument is a positive number, false otherwise.",[["n"]]),"neg?":u(c("neg?",e=>{if(e===void 0||e.kind!=="number")throw new a(`neg? expects a number${e!==void 0?`, got ${h(e)}`:""}`,{n:e});return y(e.value<0)}),"Returns true if the argument is a negative number, false otherwise.",[["n"]]),"zero?":u(c("zero?",e=>{if(e===void 0||e.kind!=="number")throw new a(`zero? expects a number${e!==void 0?`, got ${h(e)}`:""}`,{n:e});return y(e.value===0)}),"Returns true if the argument is zero, false otherwise.",[["n"]])},Vt={atom:u(c("atom",e=>Rt(e)),"Returns a new atom holding the given value.",[["value"]]),deref:u(c("deref",e=>{if(be(e)||qe(e)||fe(e))return e.value;throw new a(`deref expects an atom, volatile, or reduced value, got ${e.kind}`,{value:e})}),"Returns the wrapped value from an atom, volatile, or reduced value.",[["value"]]),"swap!":u(O("swap!",(e,t,n,r,...s)=>{if(!be(n))throw new a(`swap! expects an atom as its first argument, got ${n.kind}`,{atomVal:n});if(!K(r))throw new a(`swap! expects a function as its second argument, got ${r.kind}`,{fn:r});const o=e.applyFunction(r,[n.value,...s],t);return n.value=o,o}),"Applies fn to the current value of the atom, replacing the current value with the result. Returns the new value.",[["atomVal","fn","&","extraArgs"]]),"reset!":u(c("reset!",(e,t)=>{if(!be(e))throw new a(`reset! expects an atom as its first argument, got ${e.kind}`,{atomVal:e});return e.value=t,t}),"Sets the value of the atom to newVal and returns the new value.",[["atomVal","newVal"]]),"atom?":u(c("atom?",e=>y(be(e))),"Returns true if the value is an atom, false otherwise.",[["value"]])};function z(e){switch(e.kind){case g.string:return e.value;case g.number:return e.value.toString();case g.boolean:return e.value?"true":"false";case g.keyword:return e.name;case g.symbol:return e.name;case g.list:return`(${e.value.map(z).join(" ")})`;case g.vector:return`[${e.value.map(z).join(" ")}]`;case g.map:return`{${e.entries.map(([t,n])=>`${z(t)} ${z(n)}`).join(" ")}}`;case g.function:{if(e.arities.length===1){const n=e.arities[0];return`(fn [${(n.restParam?[...n.params,{kind:"symbol",name:"&"},n.restParam]:n.params).map(z).join(" ")}] ${n.body.map(z).join(" ")})`}return`(fn ${e.arities.map(n=>`([${(n.restParam?[...n.params,{kind:"symbol",name:"&"},n.restParam]:n.params).map(z).join(" ")}] ${n.body.map(z).join(" ")})`).join(" ")})`}case g.nativeFunction:return`(native-fn ${e.name})`;case g.nil:return"nil";case g.regex:return`${e.flags?`(?${e.flags})`:""}${e.pattern}`;default:throw new a(`unhandled value type: ${e.kind}`,{value:e})}}const J=e=>{if(S(e)||E(e))return e.value;if(C(e))return e.entries.map(([t,n])=>M([t,n]));if(e.kind==="string")return[...e.value].map(A);throw new a(`toSeq expects a collection or string, got ${h(e)}`,{collection:e})},en={list:u(c("list",(...e)=>e.length===0?T([]):T(e)),"Returns a new list containing the given values.",[["&","args"]]),vector:u(c("vector",(...e)=>e.length===0?M([]):M(e)),"Returns a new vector containing the given values.",[["&","args"]]),"hash-map":u(c("hash-map",(...e)=>{if(e.length===0)return W([]);if(e.length%2!==0)throw new a(`hash-map expects an even number of arguments, got ${e.length}`,{args:e});const t=[];for(let n=0;n<e.length;n+=2){const r=e[n],s=e[n+1];t.push([r,s])}return W(t)}),"Returns a new hash-map containing the given key-value pairs.",[["&","kvals"]]),seq:u(c("seq",e=>{if(e.kind==="nil")return v();if(!_(e))throw new a(`seq expects a collection, string, or nil, got ${h(e)}`,{collection:e});const t=J(e);return t.length===0?v():T(t)}),"Returns a sequence of the given collection or string. Strings yield a sequence of single-character strings.",[["coll"]]),first:u(c("first",e=>{if(e.kind==="nil")return v();if(!_(e))throw new a("first expects a collection or string",{collection:e});const t=J(e);return t.length===0?v():t[0]}),"Returns the first element of the given collection or string.",[["coll"]]),rest:u(c("rest",e=>{if(e.kind==="nil")return T([]);if(!_(e))throw new a("rest expects a collection or string",{collection:e});if(S(e))return e.value.length===0?e:T(e.value.slice(1));if(E(e))return M(e.value.slice(1));if(C(e))return e.entries.length===0?e:W(e.entries.slice(1));if(e.kind==="string"){const t=J(e);return T(t.slice(1))}throw new a(`rest expects a collection or string, got ${h(e)}`,{collection:e})}),"Returns a sequence of the given collection or string excluding the first element.",[["coll"]]),conj:u(c("conj",(e,...t)=>{if(!e)throw new a("conj expects a collection as first argument",{collection:e});if(t.length===0)return e;if(!de(e))throw new a(`conj expects a collection, got ${h(e)}`,{collection:e});if(S(e)){const n=[];for(let r=t.length-1;r>=0;r--)n.push(t[r]);return T([...n,...e.value])}if(E(e))return M([...e.value,...t]);if(C(e)){const n=[...e.entries];for(let r=0;r<t.length;r+=1){const s=t[r];if(s.kind!=="vector")throw new a(`conj on maps expects each argument to be a vector key-pair for maps, got ${h(s)}`,{pair:s});if(s.value.length!==2)throw new a(`conj on maps expects each argument to be a vector key-pair for maps, got ${h(s)}`,{pair:s});const o=s.value[0],i=n.findIndex(l=>P(l[0],o));i===-1?n.push([o,s.value[1]]):n[i]=[o,s.value[1]]}return W([...n])}throw new a(`unhandled collection type, got ${h(e)}`,{collection:e})}),"Appends args to the given collection. Lists append in reverse order to the head, vectors append to the tail.",[["collection","&","args"]]),cons:u(c("cons",(e,t)=>{if(!de(t))throw new a(`cons expects a collection as second argument, got ${h(t)}`,{xs:t});if(C(t))throw new a("cons on maps is not supported, use vectors instead",{xs:t});const n=S(t)?T:M,r=[e,...t.value];return n(r)}),"Returns a new collection with x prepended to the head of xs.",[["x","xs"]]),assoc:u(c("assoc",(e,...t)=>{if(!e)throw new a("assoc expects a collection as first argument",{collection:e});if(Se(e)&&(e=W([])),S(e))throw new a("assoc on lists is not supported, use vectors instead",{collection:e});if(!de(e))throw new a(`assoc expects a collection, got ${h(e)}`,{collection:e});if(t.length<2)throw new a("assoc expects at least two arguments",{args:t});if(t.length%2!==0)throw new a("assoc expects an even number of binding arguments",{args:t});if(E(e)){const n=[...e.value];for(let r=0;r<t.length;r+=2){const s=t[r];if(s.kind!=="number")throw new a(`assoc on vectors expects each key argument to be a index (number), got ${h(s)}`,{index:s});if(s.value>n.length)throw new a(`assoc index ${s.value} is out of bounds for vector of length ${n.length}`,{index:s,collection:e});n[s.value]=t[r+1]}return M(n)}if(C(e)){const n=[...e.entries];for(let r=0;r<t.length;r+=2){const s=t[r],o=t[r+1],i=n.findIndex(l=>P(l[0],s));i===-1?n.push([s,o]):n[i]=[s,o]}return W(n)}throw new a(`unhandled collection type, got ${h(e)}`,{collection:e})}),"Associates the value val with the key k in collection. If collection is a map, returns a new map with the same mappings, otherwise returns a vector with the new value at index k.",[["collection","&","kvals"]]),dissoc:u(c("dissoc",(e,...t)=>{if(!e)throw new a("dissoc expects a collection as first argument",{collection:e});if(S(e))throw new a("dissoc on lists is not supported, use vectors instead",{collection:e});if(!de(e))throw new a(`dissoc expects a collection, got ${h(e)}`,{collection:e});if(E(e)){if(e.value.length===0)return e;const n=[...e.value];for(let r=0;r<t.length;r+=1){const s=t[r];if(s.kind!=="number")throw new a(`dissoc on vectors expects each key argument to be a index (number), got ${h(s)}`,{index:s});if(s.value>=n.length)throw new a(`dissoc index ${s.value} is out of bounds for vector of length ${n.length}`,{index:s,collection:e});n.splice(s.value,1)}return M(n)}if(C(e)){if(e.entries.length===0)return e;const n=[...e.entries];for(let r=0;r<t.length;r+=1){const s=t[r],o=n.findIndex(i=>P(i[0],s));if(o===-1)return e;n.splice(o,1)}return W(n)}throw new a(`unhandled collection type, got ${h(e)}`,{collection:e})}),"Dissociates the key k from collection. If collection is a map, returns a new map with the same mappings, otherwise returns a vector with the value at index k removed.",[["collection","&","keys"]]),get:u(c("get",(e,t,n)=>{const r=n??v();switch(e.kind){case g.map:{const s=e.entries;for(const[o,i]of s)if(P(o,t))return i;return r}case g.vector:{const s=e.value;if(t.kind!=="number")throw new a("get on vectors expects a 0-based index as parameter",{key:t});return t.value<0||t.value>=s.length?r:s[t.value]}default:return r}}),"Returns the value associated with key in target. If target is a map, returns the value associated with key, otherwise returns the value at index key in target. If not-found is provided, it is returned if the key is not found, otherwise nil is returned.",[["target","key"],["target","key","not-found"]]),nth:u(c("nth",(e,t,n)=>{if(e===void 0||!S(e)&&!E(e))throw new a(`nth expects a list or vector${e!==void 0?`, got ${h(e)}`:""}`,{coll:e});if(t===void 0||t.kind!=="number")throw new a(`nth expects a number index${t!==void 0?`, got ${h(t)}`:""}`,{n:t});const r=t.value,s=e.value;if(r<0||r>=s.length){if(n!==void 0)return n;throw new a(`nth index ${r} is out of bounds for collection of length ${s.length}`,{coll:e,n:t})}return s[r]}),"Returns the nth element of the given collection. If not-found is provided, it is returned if the index is out of bounds, otherwise an error is thrown.",[["coll","n","not-found"]]),concat:u(c("concat",(...e)=>{const t=[];for(const n of e){if(!_(n))throw new a(`concat expects collections or strings, got ${h(n)}`,{coll:n});t.push(...J(n))}return T(t)}),"Returns a new sequence that is the concatenation of the given sequences or strings.",[["&","colls"]]),zipmap:u(c("zipmap",(e,t)=>{if(e===void 0||!_(e))throw new a(`zipmap expects a collection or string as first argument${e!==void 0?`, got ${h(e)}`:""}`,{ks:e});if(t===void 0||!_(t))throw new a(`zipmap expects a collection or string as second argument${t!==void 0?`, got ${h(t)}`:""}`,{vs:t});const n=J(e),r=J(t),s=Math.min(n.length,r.length),o=[];for(let i=0;i<s;i++)o.push([n[i],r[i]]);return W(o)}),"Returns a new map with the keys and values of the given collections.",[["ks","vs"]]),last:u(c("last",e=>{if(e===void 0||!S(e)&&!E(e))throw new a(`last expects a list or vector${e!==void 0?`, got ${h(e)}`:""}`,{coll:e});const t=e.value;return t.length===0?v():t[t.length-1]}),"Returns the last element of the given collection.",[["coll"]]),reverse:u(c("reverse",e=>{if(e===void 0||!S(e)&&!E(e))throw new a(`reverse expects a list or vector${e!==void 0?`, got ${h(e)}`:""}`,{coll:e});return T([...e.value].reverse())}),"Returns a new sequence with the elements of the given collection in reverse order.",[["coll"]]),"empty?":u(c("empty?",e=>{if(e===void 0)throw new a("empty? expects one argument",{});if(e.kind==="nil")return y(!0);if(!_(e))throw new a(`empty? expects a collection, string, or nil, got ${h(e)}`,{coll:e});return y(J(e).length===0)}),"Returns true if coll has no items. Accepts collections, strings, and nil.",[["coll"]]),"contains?":u(c("contains?",(e,t)=>{if(e===void 0)throw new a("contains? expects a collection as first argument",{});if(t===void 0)throw new a("contains? expects a key as second argument",{});if(e.kind==="nil")return y(!1);if(C(e))return y(e.entries.some(([n])=>P(n,t)));if(E(e))return t.kind!=="number"?y(!1):y(t.value>=0&&t.value<e.value.length);throw new a(`contains? expects a map, vector, or nil, got ${h(e)}`,{coll:e})}),"Returns true if key is present in coll. For maps checks key existence (including keys with nil values). For vectors checks index bounds.",[["coll","key"]]),repeat:u(c("repeat",(e,t)=>{if(e===void 0||e.kind!=="number")throw new a(`repeat expects a number as first argument${e!==void 0?`, got ${h(e)}`:""}`,{n:e});return T(Array(e.value).fill(t))}),"Returns a sequence of n copies of x.",[["n","x"]]),range:u(c("range",(...e)=>{if(e.length===0||e.length>3)throw new a("range expects 1, 2, or 3 arguments: (range n), (range start end), or (range start end step)",{args:e});if(e.some(o=>o.kind!=="number"))throw new a("range expects number arguments",{args:e});let t,n,r;if(e.length===1?(t=0,n=e[0].value,r=1):e.length===2?(t=e[0].value,n=e[1].value,r=1):(t=e[0].value,n=e[1].value,r=e[2].value),r===0)throw new a("range step cannot be zero",{args:e});const s=[];if(r>0)for(let o=t;o<n;o+=r)s.push(L(o));else for(let o=t;o>n;o+=r)s.push(L(o));return T(s)}),"Returns a sequence of numbers from start (inclusive) to end (exclusive), incrementing by step. If step is positive, the sequence is generated from start to end, otherwise it is generated from end to start.",[["n"],["start","end"],["start","end","step"]]),keys:u(c("keys",e=>{if(e===void 0||!C(e))throw new a(`keys expects a map${e!==void 0?`, got ${h(e)}`:""}`,{m:e});return M(e.entries.map(([t])=>t))}),"Returns a vector of the keys of the given map.",[["m"]]),vals:u(c("vals",e=>{if(e===void 0||!C(e))throw new a(`vals expects a map${e!==void 0?`, got ${h(e)}`:""}`,{m:e});return M(e.entries.map(([,t])=>t))}),"Returns a vector of the values of the given map.",[["m"]]),count:u(c("count",e=>{if(![g.list,g.vector,g.map,g.string].includes(e.kind))throw new a(`count expects a countable value, got ${h(e)}`,{countable:e});switch(e.kind){case g.list:return L(e.value.length);case g.vector:return L(e.value.length);case g.map:return L(e.entries.length);case g.string:return L(e.value.length);default:throw new a(`count expects a countable value, got ${h(e)}`,{countable:e})}}),"Returns the number of elements in the given countable value.",[["countable"]])},tn={throw:u(c("throw",(...e)=>{throw e.length!==1?new a(`throw requires exactly 1 argument, got ${e.length}`,{args:e}):new je(e[0])}),"Throws a value as an exception. The value may be any CljValue; maps are idiomatic.",[["value"]]),"ex-info":u(c("ex-info",(...e)=>{if(e.length<2)throw new a(`ex-info requires at least 2 arguments, got ${e.length}`,{args:e});const[t,n,r]=e;if(t.kind!=="string")throw new a("ex-info: first argument must be a string",{msg:t});const s=[[D(":message"),t],[D(":data"),n]];return r!==void 0&&s.push([D(":cause"),r]),W(s)}),"Creates an error map with :message and :data keys. Optionally accepts a :cause.",[["msg","data"],["msg","data","cause"]]),"ex-message":u(c("ex-message",(...e)=>{const[t]=e;if(!C(t))return v();const n=t.entries.find(([r])=>I(r)&&r.name===":message");return n?n[1]:v()}),"Returns the :message of an error map, or nil.",[["e"]]),"ex-data":u(c("ex-data",(...e)=>{const[t]=e;if(!C(t))return v();const n=t.entries.find(([r])=>I(r)&&r.name===":data");return n?n[1]:v()}),"Returns the :data map of an error map, or nil.",[["e"]]),"ex-cause":u(c("ex-cause",(...e)=>{const[t]=e;if(!C(t))return v();const n=t.entries.find(([r])=>I(r)&&r.name===":cause");return n?n[1]:v()}),"Returns the :cause of an error map, or nil.",[["e"]])},nn={reduce:u(O("reduce",(e,t,n,...r)=>{if(n===void 0||!K(n))throw new a(`reduce expects a function as first argument${n!==void 0?`, got ${h(n)}`:""}`,{fn:n});if(r.length===0||r.length>2)throw new a("reduce expects 2 or 3 arguments: (reduce f coll) or (reduce f init coll)",{fn:n});const s=r.length===2,o=s?r[0]:void 0,i=s?r[1]:r[0];if(i.kind==="nil"){if(!s)throw new a("reduce called on empty collection with no initial value",{fn:n});return o}if(!_(i))throw new a(`reduce expects a collection or string, got ${h(i)}`,{collection:i});const l=J(i);if(!s){if(l.length===0)throw new a("reduce called on empty collection with no initial value",{fn:n});if(l.length===1)return l[0];let f=l[0];for(let d=1;d<l.length;d++){const m=e.applyFunction(n,[f,l[d]],t);if(fe(m))return m.value;f=m}return f}let p=o;for(const f of l){const d=e.applyFunction(n,[p,f],t);if(fe(d))return d.value;p=d}return p}),"Reduces a collection to a single value by iteratively applying f. (reduce f coll) or (reduce f init coll).",[["f","coll"],["f","val","coll"]]),apply:u(O("apply",(e,t,n,...r)=>{if(n===void 0||!Re(n))throw new a(`apply expects a callable as first argument${n!==void 0?`, got ${h(n)}`:""}`,{fn:n});if(r.length===0)throw new a("apply expects at least 2 arguments",{fn:n});const s=r[r.length-1];if(!Se(s)&&!_(s))throw new a(`apply expects a collection or string as last argument, got ${h(s)}`,{lastArg:s});const o=[...r.slice(0,-1),...Se(s)?[]:J(s)];return e.applyCallable(n,o,t)}),"Calls f with the elements of the last argument (a collection) as its arguments, optionally prepended by fixed args.",[["f","args"],["f","&","args"]]),partial:u(c("partial",(e,...t)=>{if(e===void 0||!Re(e))throw new a(`partial expects a callable as first argument${e!==void 0?`, got ${h(e)}`:""}`,{fn:e});const n=e;return O("partial",(r,s,...o)=>r.applyCallable(n,[...t,...o],s))}),"Returns a function that calls f with pre-applied args prepended to any additional arguments.",[["f","&","args"]]),comp:u(c("comp",(...e)=>{if(e.length===0)return c("identity",n=>n);if(e.some(n=>!Re(n)))throw new a("comp expects functions or other callable values (keywords, maps)",{fns:e});const t=e;return O("composed",(n,r,...s)=>{let o=n.applyCallable(t[t.length-1],s,r);for(let i=t.length-2;i>=0;i--)o=n.applyCallable(t[i],[o],r);return o})}),"Returns the composition of fns, applied right-to-left. (comp f g) is equivalent to (fn [x] (f (g x))). Accepts any callable: functions, keywords, and maps.",[[],["f"],["f","g"],["f","g","&","fns"]]),identity:u(c("identity",e=>{if(e===void 0)throw new a("identity expects one argument",{});return e}),"Returns its single argument unchanged.",[["x"]])},rn={meta:u(c("meta",e=>{if(e===void 0)throw new a("meta expects one argument",{});return e.kind==="function"||e.kind==="native-function"?e.meta??v():v()}),"Returns the metadata map of a value, or nil if the value has no metadata.",[["val"]]),"with-meta":u(c("with-meta",(e,t)=>{if(e===void 0)throw new a("with-meta expects two arguments",{});if(t===void 0)throw new a("with-meta expects two arguments",{});if(t.kind!=="map"&&t.kind!=="nil")throw new a(`with-meta expects a map as second argument, got ${h(t)}`,{m:t});if(e.kind!=="function"&&e.kind!=="native-function")throw new a(`with-meta only supports functions, got ${h(e)}`,{val:e});const n=t.kind==="nil"?void 0:t;return{...e,meta:n}}),"Returns a new value with the metadata map m applied to val.",[["val","m"]])};function at(e,t,n,r){if(e.kind==="native-function")return e.fnWithContext?e.fnWithContext(n,r,...t):e.fn(...t);if(e.kind==="function"){const s=tt(e.arities,t.length);let o=t;for(;;){const i=et(s.params,s.restParam,o,e.env,n,r);try{return n.evaluateForms(s.body,i)}catch(l){if(l instanceof he){o=l.args;continue}throw l}}}throw new a(`${e.kind} is not a callable function`,{fn:e,args:t})}function sn(e,t,n,r){if(K(e))return at(e,t,n,r);if(I(e)){const s=t[0],o=t.length>1?t[1]:v();if(C(s)){const i=s.entries.find(([l])=>P(l,e));return i?i[1]:o}return o}if(C(e)){if(t.length===0)throw new a("Map used as function requires at least one argument",{fn:e,args:t});const s=t[0],o=t.length>1?t[1]:v(),i=e.entries.find(([l])=>P(l,s));return i?i[1]:o}throw new a(`${h(e)} is not a callable value`,{fn:e,args:t})}function on(e,t,n){const r=tt(e.arities,t.length),s=et(r.params,r.restParam,t,e.env,n,e.env);return n.evaluateForms(r.body,s)}function ue(e,t,n){if(E(e)){const l=e.value.map(p=>ue(p,t,n));return l.every((p,f)=>p===e.value[f])?e:M(l)}if(C(e)){const l=e.entries.map(([p,f])=>[ue(p,t,n),ue(f,t,n)]);return l.every(([p,f],d)=>p===e.entries[d][0]&&f===e.entries[d][1])?e:W(l)}if(!S(e)||e.value.length===0)return e;const r=e.value[0];if(!q(r)){const l=e.value.map(p=>ue(p,t,n));return l.every((p,f)=>p===e.value[f])?e:T(l)}const s=r.name;if(s==="quote"||s==="quasiquote")return e;const o=Ue(s,t);if(o!==void 0&&Le(o)){const l=n.applyMacro(o,e.value.slice(1));return ue(l,t,n)}const i=e.value.map(l=>ue(l,t,n));return i.every((l,p)=>l===e.value[p])?e:T(i)}function oe(e,t){Object.defineProperty(e,"_pos",{value:t,enumerable:!1,writable:!0,configurable:!0})}function an(e){return e._pos}function ln(e,t){const n=e.split(`
`);let r=0;for(let o=0;o<n.length;o++){const i=r+n[o].length;if(t<=i)return{line:o+1,col:t-r,lineText:n[o]};r=i+1}const s=n[n.length-1];return{line:n.length,col:s.length,lineText:s}}function un(e,t){const{line:n,col:r,lineText:s}=ln(e,t.start),o=Math.max(1,t.end-t.start),i=" ".repeat(r)+"^".repeat(o);return`
  at line ${n}, col ${r+1}:
  ${s}
  ${i}`}function cn(e,t,n){return M(e.value.map(r=>n.evaluate(r,t)))}function fn(e,t,n){let r=[];for(const[s,o]of e.entries){const i=n.evaluate(s,t),l=n.evaluate(o,t);r.push([i,l])}return W(r)}function dn(e,t,n,r){const s=n.applyFunction(e.dispatchFn,t,r),o=e.methods.find(({dispatchVal:i})=>P(i,s));if(o)return n.applyFunction(o.fn,t,r);if(e.defaultMethod)return n.applyFunction(e.defaultMethod,t,r);throw new a(`No method in multimethod '${e.name}' for dispatch value ${h(s)}`,{mm:e,dispatchVal:s})}function pn(e,t,n){if(e.value.length===0)throw new a("Unexpected empty list",{list:e,env:t});const r=e.value[0];if(Gt(r))return Jt(r.name,e,t,n);const s=n.evaluate(r,t);if(st(s)){const i=e.value.slice(1).map(l=>n.evaluate(l,t));return dn(s,i,n,t)}if(!Re(s)){const i=q(r)?r.name:h(r);throw new a(`${i} is not callable`,{list:e,env:t})}const o=e.value.slice(1).map(i=>n.evaluate(i,t));return n.applyCallable(s,o,t)}function hn(e,t,n){try{switch(e.kind){case g.number:case g.string:case g.keyword:case g.nil:case g.function:case g.multiMethod:case g.boolean:case g.regex:return e;case g.symbol:{const r=e.name.indexOf("/");if(r>0&&r<e.name.length-1){const s=e.name.slice(0,r),o=e.name.slice(r+1),l=Ae(t).aliases?.get(s)??ce(t).resolveNs?.(s)??null;if(!l)throw new a(`No such namespace or alias: ${s}`,{symbol:e.name,env:t});return Fe(o,l)}return Fe(e.name,t)}case g.vector:return cn(e,t,n);case g.map:return fn(e,t,n);case g.list:return pn(e,t,n);default:throw new a("Unexpected value",{expr:e,env:t})}}catch(r){if(r instanceof a&&!r.pos){const s=an(e);s&&(r.pos=s)}throw r}}function mn(e,t,n){let r=v();for(const s of e)r=n.evaluate(s,t);return r}function it(){const e={evaluate:(t,n)=>hn(t,n,e),evaluateForms:(t,n)=>mn(t,n,e),applyFunction:(t,n,r)=>at(t,n,e,r),applyCallable:(t,n,r)=>sn(t,n,e,r),applyMacro:(t,n)=>on(t,n,e),expandAll:(t,n)=>ue(t,n,e)};return e}function _e(e,t,n=we()){return it().applyFunction(e,t,n)}const gn={"nil?":u(c("nil?",e=>y(e.kind==="nil")),"Returns true if the value is nil, false otherwise.",[["arg"]]),"true?":u(c("true?",e=>e.kind!=="boolean"?y(!1):y(e.value===!0)),"Returns true if the value is a boolean and true, false otherwise.",[["arg"]]),"false?":u(c("false?",e=>e.kind!=="boolean"?y(!1):y(e.value===!1)),"Returns true if the value is a boolean and false, false otherwise.",[["arg"]]),"truthy?":u(c("truthy?",e=>y(Ce(e))),"Returns true if the value is not nil or false, false otherwise.",[["arg"]]),"falsy?":u(c("falsy?",e=>y(Ee(e))),"Returns true if the value is nil or false, false otherwise.",[["arg"]]),"not=":u(c("not=",(...e)=>{if(e.length<2)throw new a("not= expects at least two arguments",{args:e});for(let t=1;t<e.length;t++)if(!P(e[t],e[t-1]))return y(!0);return y(!1)}),"Returns true if any two adjacent arguments are not equal, false otherwise.",[["&","vals"]]),"number?":u(c("number?",e=>y(e!==void 0&&e.kind==="number")),"Returns true if the value is a number, false otherwise.",[["x"]]),"string?":u(c("string?",e=>y(e!==void 0&&e.kind==="string")),"Returns true if the value is a string, false otherwise.",[["x"]]),"boolean?":u(c("boolean?",e=>y(e!==void 0&&e.kind==="boolean")),"Returns true if the value is a boolean, false otherwise.",[["x"]]),"vector?":u(c("vector?",e=>y(e!==void 0&&E(e))),"Returns true if the value is a vector, false otherwise.",[["x"]]),"list?":u(c("list?",e=>y(e!==void 0&&S(e))),"Returns true if the value is a list, false otherwise.",[["x"]]),"map?":u(c("map?",e=>y(e!==void 0&&C(e))),"Returns true if the value is a map, false otherwise.",[["x"]]),"keyword?":u(c("keyword?",e=>y(e!==void 0&&I(e))),"Returns true if the value is a keyword, false otherwise.",[["x"]]),"qualified-keyword?":u(c("qualified-keyword?",e=>y(e!==void 0&&I(e)&&e.name.includes("/"))),"Returns true if the value is a qualified keyword, false otherwise.",[["x"]]),"symbol?":u(c("symbol?",e=>y(e!==void 0&&q(e))),"Returns true if the value is a symbol, false otherwise.",[["x"]]),"qualified-symbol?":u(c("qualified-symbol?",e=>y(e!==void 0&&q(e)&&e.name.includes("/"))),"Returns true if the value is a qualified symbol, false otherwise.",[["x"]]),"fn?":u(c("fn?",e=>y(e!==void 0&&K(e))),"Returns true if the value is a function, false otherwise.",[["x"]]),"coll?":u(c("coll?",e=>y(e!==void 0&&de(e))),"Returns true if the value is a collection, false otherwise.",[["x"]]),some:u(c("some",(e,t)=>{if(e===void 0||!K(e))throw new a(`some expects a function as first argument${e!==void 0?`, got ${h(e)}`:""}`,{pred:e});if(t===void 0)return v();if(!_(t))throw new a(`some expects a collection or string as second argument, got ${h(t)}`,{coll:t});for(const n of J(t)){const r=_e(e,[n]);if(Ce(r))return r}return v()}),"Returns the first truthy result of applying pred to each item in coll, or nil if no item satisfies pred.",[["pred","coll"]]),"every?":u(c("every?",(e,t)=>{if(e===void 0||!K(e))throw new a(`every? expects a function as first argument${e!==void 0?`, got ${h(e)}`:""}`,{pred:e});if(t===void 0||!_(t))throw new a(`every? expects a collection or string as second argument${t!==void 0?`, got ${h(t)}`:""}`,{coll:t});for(const n of J(t))if(Ee(_e(e,[n])))return y(!1);return y(!0)}),"Returns true if all items in coll satisfy pred, false otherwise.",[["pred","coll"]])};function wn(e){let t=e,n="";const r=/^\(\?([imsx]+)\)/;let s;for(;(s=r.exec(t))!==null;){for(const o of s[1]){if(o==="x")throw new a("Regex flag (?x) (verbose mode) has no JavaScript equivalent and is not supported",{});n.includes(o)||(n+=o)}t=t.slice(s[0].length)}return{pattern:t,flags:n}}function Ie(e,t){if(!ot(e))throw new a(`${t} expects a regex as first argument, got ${h(e)}`,{val:e});return e}function Me(e,t){if(e.kind!=="string")throw new a(`${t} expects a string as second argument, got ${h(e)}`,{val:e});return e.value}function Pe(e){return e.length===1?A(e[0]):M(e.map(t=>t==null?v():A(t)))}const vn={"regexp?":u(c("regexp?",e=>y(e!==void 0&&ot(e))),"Returns true if x is a regular expression pattern.",[["x"]]),"re-pattern":u(c("re-pattern",e=>{if(e===void 0||e.kind!=="string")throw new a(`re-pattern expects a string argument${e!==void 0?`, got ${h(e)}`:""}`,{s:e});const{pattern:t,flags:n}=wn(e.value);return Ve(t,n)}),`Returns an instance of java.util.regex.Pattern, for use, e.g. in re-matcher.
  (re-pattern "\\\\d+") produces the same pattern as #"\\d+".`,[["s"]]),"re-find":u(c("re-find",(e,t)=>{const n=Ie(e,"re-find"),r=Me(t,"re-find"),o=new RegExp(n.pattern,n.flags).exec(r);return o?Pe(o):v()}),`Returns the next regex match, if any, of string to pattern, using
  java.util.regex.Matcher.find(). Returns the match or nil. When there
  are groups, returns a vector of the whole match and groups (nil for
  unmatched optional groups).`,[["re","s"]]),"re-matches":u(c("re-matches",(e,t)=>{const n=Ie(e,"re-matches"),r=Me(t,"re-matches"),o=new RegExp(n.pattern,n.flags).exec(r);return!o||o.index!==0||o[0].length!==r.length?v():Pe(o)}),`Returns the match, if any, of string to pattern, using
  java.util.regex.Matcher.matches(). The entire string must match.
  Returns the match or nil. When there are groups, returns a vector
  of the whole match and groups (nil for unmatched optional groups).`,[["re","s"]]),"re-seq":u(c("re-seq",(e,t)=>{const n=Ie(e,"re-seq"),r=Me(t,"re-seq"),s=new RegExp(n.pattern,n.flags+"g"),o=[];let i;for(;(i=s.exec(r))!==null;){if(i[0].length===0){s.lastIndex++;continue}o.push(Pe(i))}return o.length===0?v():{kind:"list",value:o}}),`Returns a lazy sequence of successive matches of pattern in string,
  using java.util.regex.Matcher.find(), each such match processed with
  re-groups.`,[["re","s"]]),"str-split*":u(c("str-split*",(e,t,n)=>{if(e===void 0||e.kind!=="string")throw new a(`str-split* expects a string as first argument${e!==void 0?`, got ${h(e)}`:""}`,{sVal:e});const r=e.value,o=n!==void 0&&n.kind!=="nil"&&n.kind==="number"?n.value:void 0;let i,l;if(t.kind!=="regex")throw new a(`str-split* expects a regex pattern as second argument, got ${h(t)}`,{sepVal:t});if(t.pattern===""){const d=[...r];if(o===void 0||o>=d.length)return M(d.map(A));const m=[...d.slice(0,o-1),d.slice(o-1).join("")];return M(m.map(A))}i=t.pattern,l=t.flags;const p=new RegExp(i,l+"g"),f=yn(r,p,o);return M(f.map(d=>A(d)))}),`Internal helper for clojure.string/split. Splits string s by a regex or
  string separator. Optional limit keeps all parts when provided.`,[["s","sep"],["s","sep","limit"]])};function yn(e,t,n){const r=[];let s=0,o,i=0;for(;(o=t.exec(e))!==null;){if(o[0].length===0){t.lastIndex++;continue}if(n!==void 0&&i>=n-1)break;r.push(e.slice(s,o.index)),s=o.index+o[0].length,i++}if(r.push(e.slice(s)),n===void 0)for(;r.length>0&&r[r.length-1]==="";)r.pop();return r}function Q(e,t){if(e===void 0||e.kind!=="string")throw new a(`${t} expects a string as first argument${e!==void 0?`, got ${h(e)}`:""}`,{val:e});return e.value}function me(e,t,n){if(e===void 0||e.kind!=="string")throw new a(`${n} expects a string as ${t} argument${e!==void 0?`, got ${h(e)}`:""}`,{val:e});return e.value}function kn(e){return e.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}function bn(e){return e.replace(/\$/g,"$$$$")}function xn(e,t){let n=-1;for(let s=t.length-1;s>=0;s--)if(typeof t[s]=="number"){n=s;break}const r=n>0?t.slice(0,n):[];return r.length===0?A(e):M([A(e),...r.map(s=>s==null?v():A(String(s)))])}function Je(e,t,n,r,s,o,i){const l=Q(r,n);if(s===void 0||o===void 0)throw new a(`${n} expects 3 arguments`,{});if(s.kind==="string"){if(o.kind!=="string")throw new a(`${n}: when match is a string, replacement must also be a string, got ${h(o)}`,{replVal:o});const p=new RegExp(kn(s.value),i?"g":"");return A(l.replace(p,bn(o.value)))}if(s.kind==="regex"){const p=s,f=i?p.flags+"g":p.flags,d=new RegExp(p.pattern,f);if(o.kind==="string")return A(l.replace(d,o.value));if(K(o)){const m=o,w=l.replace(d,(F,...$)=>{const H=xn(F,$),b=e.applyFunction(m,[H],t);return z(b)});return A(w)}throw new a(`${n}: replacement must be a string or function, got ${h(o)}`,{replVal:o})}throw new a(`${n}: match must be a string or regex, got ${h(s)}`,{matchVal:s})}const $n={"str-upper-case*":u(c("str-upper-case*",e=>A(Q(e,"str-upper-case*").toUpperCase())),"Internal helper. Converts s to upper-case.",[["s"]]),"str-lower-case*":u(c("str-lower-case*",e=>A(Q(e,"str-lower-case*").toLowerCase())),"Internal helper. Converts s to lower-case.",[["s"]]),"str-trim*":u(c("str-trim*",e=>A(Q(e,"str-trim*").trim())),"Internal helper. Removes whitespace from both ends of s.",[["s"]]),"str-triml*":u(c("str-triml*",e=>A(Q(e,"str-triml*").trimStart())),"Internal helper. Removes whitespace from the left of s.",[["s"]]),"str-trimr*":u(c("str-trimr*",e=>A(Q(e,"str-trimr*").trimEnd())),"Internal helper. Removes whitespace from the right of s.",[["s"]]),"str-reverse*":u(c("str-reverse*",e=>A([...Q(e,"str-reverse*")].reverse().join(""))),"Internal helper. Returns s with its characters reversed (Unicode-safe).",[["s"]]),"str-starts-with*":u(c("str-starts-with*",(e,t)=>{const n=Q(e,"str-starts-with*"),r=me(t,"second","str-starts-with*");return y(n.startsWith(r))}),"Internal helper. Returns true if s starts with substr.",[["s","substr"]]),"str-ends-with*":u(c("str-ends-with*",(e,t)=>{const n=Q(e,"str-ends-with*"),r=me(t,"second","str-ends-with*");return y(n.endsWith(r))}),"Internal helper. Returns true if s ends with substr.",[["s","substr"]]),"str-includes*":u(c("str-includes*",(e,t)=>{const n=Q(e,"str-includes*"),r=me(t,"second","str-includes*");return y(n.includes(r))}),"Internal helper. Returns true if s contains substr.",[["s","substr"]]),"str-index-of*":u(c("str-index-of*",(e,t,n)=>{const r=Q(e,"str-index-of*"),s=me(t,"second","str-index-of*");let o;if(n!==void 0&&n.kind!=="nil"){if(n.kind!=="number")throw new a(`str-index-of* expects a number as third argument, got ${h(n)}`,{fromVal:n});o=r.indexOf(s,n.value)}else o=r.indexOf(s);return o===-1?v():L(o)}),"Internal helper. Returns index of value in s, or nil if not found.",[["s","value"],["s","value","from-index"]]),"str-last-index-of*":u(c("str-last-index-of*",(e,t,n)=>{const r=Q(e,"str-last-index-of*"),s=me(t,"second","str-last-index-of*");let o;if(n!==void 0&&n.kind!=="nil"){if(n.kind!=="number")throw new a(`str-last-index-of* expects a number as third argument, got ${h(n)}`,{fromVal:n});o=r.lastIndexOf(s,n.value)}else o=r.lastIndexOf(s);return o===-1?v():L(o)}),"Internal helper. Returns last index of value in s, or nil if not found.",[["s","value"],["s","value","from-index"]]),"str-replace*":u(O("str-replace*",(e,t,n,r,s)=>Je(e,t,"str-replace*",n,r,s,!0)),"Internal helper. Replaces all occurrences of match with replacement in s.",[["s","match","replacement"]]),"str-replace-first*":u(O("str-replace-first*",(e,t,n,r,s)=>Je(e,t,"str-replace-first*",n,r,s,!1)),"Internal helper. Replaces the first occurrence of match with replacement in s.",[["s","match","replacement"]])},Rn={reduced:u(c("reduced",e=>{if(e===void 0)throw new a("reduced expects one argument",{});return Ke(e)}),"Returns a reduced value, indicating termination of the reduction process.",[["value"]]),"reduced?":u(c("reduced?",e=>{if(e===void 0)throw new a("reduced? expects one argument",{});return y(fe(e))}),"Returns true if the given value is a reduced value, false otherwise.",[["value"]]),unreduced:u(c("unreduced",e=>{if(e===void 0)throw new a("unreduced expects one argument",{});return fe(e)?e.value:e}),"Returns the unreduced value of the given value. If the value is not a reduced value, it is returned unchanged.",[["value"]]),"ensure-reduced":u(c("ensure-reduced",e=>{if(e===void 0)throw new a("ensure-reduced expects one argument",{});return fe(e)?e:Ke(e)}),"Returns the given value if it is a reduced value, otherwise returns a reduced value with the given value as its value.",[["value"]]),"volatile!":u(c("volatile!",e=>{if(e===void 0)throw new a("volatile! expects one argument",{});return qt(e)}),"Returns a volatile value with the given value as its value.",[["value"]]),"volatile?":u(c("volatile?",e=>{if(e===void 0)throw new a("volatile? expects one argument",{});return y(qe(e))}),"Returns true if the given value is a volatile value, false otherwise.",[["value"]]),"vreset!":u(c("vreset!",(e,t)=>{if(!qe(e))throw new a(`vreset! expects a volatile as its first argument, got ${h(e)}`,{vol:e});if(t===void 0)throw new a("vreset! expects two arguments",{vol:e});return e.value=t,t}),"Resets the value of the given volatile to the given new value and returns the new value.",[["vol","newVal"]]),"vswap!":u(O("vswap!",(e,t,n,r,...s)=>{if(!qe(n))throw new a(`vswap! expects a volatile as its first argument, got ${h(n)}`,{vol:n});if(!K(r))throw new a(`vswap! expects a function as its second argument, got ${h(r)}`,{fn:r});const o=e.applyFunction(r,[n.value,...s],t);return n.value=o,o}),"Applies fn to the current value of the volatile, replacing the current value with the result. Returns the new value.",[["vol","fn"],["vol","fn","&","extraArgs"]]),transduce:u(O("transduce",(e,t,n,r,s,o)=>{if(!K(n))throw new a(`transduce expects a transducer (function) as first argument, got ${h(n)}`,{xf:n});if(!K(r))throw new a(`transduce expects a reducing function as second argument, got ${h(r)}`,{f:r});if(s===void 0)throw new a("transduce expects 3 or 4 arguments: (transduce xf f coll) or (transduce xf f init coll)",{});let i,l;o===void 0?(l=s,i=e.applyFunction(r,[],t)):(i=s,l=o);const p=e.applyFunction(n,[r],t);if(Se(l))return e.applyFunction(p,[i],t);if(!_(l))throw new a(`transduce expects a collection or string as ${o===void 0?"third":"fourth"} argument, got ${h(l)}`,{coll:l});const f=J(l);let d=i;for(const m of f){const w=e.applyFunction(p,[d,m],t);if(fe(w)){d=w.value;break}d=w}return e.applyFunction(p,[d],t)}),xe(["reduce with a transformation of f (xf). If init is not","supplied, (f) will be called to produce it. f should be a reducing","step function that accepts both 1 and 2 arguments, if it accepts","only 2 you can add the arity-1 with 'completing'. Returns the result","of applying (the transformed) xf to init and the first item in coll,","then applying xf to that result and the 2nd item, etc. If coll","contains no items, returns init and f is not called. Note that","certain transforms may inject or skip items."]),[["xform","f","coll"],["xform","f","init","coll"]])},qn={str:u(c("str",(...e)=>A(e.map(z).join(""))),"Returns a concatenated string representation of the given values.",[["&","args"]]),subs:u(c("subs",(e,t,n)=>{if(e===void 0||e.kind!=="string")throw new a(`subs expects a string as first argument${e!==void 0?`, got ${h(e)}`:""}`,{s:e});if(t===void 0||t.kind!=="number")throw new a(`subs expects a number as second argument${t!==void 0?`, got ${h(t)}`:""}`,{start:t});if(n!==void 0&&n.kind!=="number")throw new a(`subs expects a number as optional third argument${n!==void 0?`, got ${h(n)}`:""}`,{end:n});const r=t.value,s=n?.value;return A(s===void 0?e.value.slice(r):e.value.slice(r,s))}),"Returns the substring of s beginning at start, and optionally ending before end.",[["s","start"],["s","start","end"]]),type:u(c("type",e=>{if(e===void 0)throw new a("type expects an argument",{x:e});const n={number:":number",string:":string",boolean:":boolean",nil:":nil",keyword:":keyword",symbol:":symbol",list:":list",vector:":vector",map:":map",function:":function",regex:":regex","native-function":":function"}[e.kind];if(!n)throw new a(`type: unhandled kind ${e.kind}`,{x:e});return D(n)}),"Returns a keyword representing the type of the given value.",[["x"]]),gensym:u(c("gensym",(...e)=>{if(e.length>1)throw new a("gensym takes 0 or 1 arguments",{args:e});const t=e[0];if(t!==void 0&&t.kind!=="string")throw new a(`gensym prefix must be a string${t!==void 0?`, got ${h(t)}`:""}`,{prefix:t});const n=t?.kind==="string"?t.value:"G";return N(nt(n))}),'Returns a unique symbol with the given prefix. Defaults to "G" if no prefix is provided.',[[],["prefix"]]),eval:u(O("eval",(e,t,n)=>{if(n===void 0)throw new a("eval expects a form as argument",{form:n});const r=ce(t),s=e.expandAll(n,r);return e.evaluate(s,r)}),"Evaluates the given form in the global environment and returns the result.",[["form"]]),"macroexpand-1":u(O("macroexpand-1",(e,t,n)=>{if(!S(n)||n.value.length===0)return n;const r=n.value[0];if(!q(r))return n;const s=Ue(r.name,ce(t));return s===void 0||!Le(s)?n:e.applyMacro(s,n.value.slice(1))}),"If the head of the form is a macro, expands it and returns the resulting forms. Otherwise, returns the form unchanged.",[["form"]]),macroexpand:u(O("macroexpand",(e,t,n)=>{const r=ce(t);let s=n;for(;;){if(!S(s)||s.value.length===0)return s;const o=s.value[0];if(!q(o))return s;const i=Ue(o.name,r);if(i===void 0||!Le(i))return s;s=e.applyMacro(i,s.value.slice(1))}}),xe(["Expands all macros until the expansion is stable (head is no longer a macro)","","Note neither macroexpand-1 nor macroexpand will expand macros in sub-forms"]),[["form"]]),"macroexpand-all":u(O("macroexpand-all",(e,t,n)=>e.expandAll(n,ce(t))),xe(["Fully expands all macros in a form recursively — including in sub-forms.","","Unlike macroexpand, this descends into every sub-expression.","Expansion stops at quote/quasiquote boundaries and fn/loop bodies."]),[["form"]]),namespace:u(c("namespace",e=>{if(e===void 0)throw new a("namespace expects an argument",{x:e});let t;if(I(e))t=e.name.slice(1);else if(q(e))t=e.name;else throw new a(`namespace expects a keyword or symbol, got ${h(e)}`,{x:e});const n=t.indexOf("/");return n<=0?v():A(t.slice(0,n))}),"Returns the namespace string of a qualified keyword or symbol, or nil if the argument is not qualified.",[["x"]]),name:u(c("name",e=>{if(e===void 0)throw new a("name expects an argument",{x:e});let t;if(I(e))t=e.name.slice(1);else if(q(e))t=e.name;else{if(e.kind==="string")return e;throw new a(`name expects a keyword, symbol, or string, got ${h(e)}`,{x:e})}const n=t.indexOf("/");return A(n>=0?t.slice(n+1):t)}),"Returns the local name of a qualified keyword or symbol, or the string value if the argument is a string.",[["x"]]),keyword:u(c("keyword",(...e)=>{if(e.length===0||e.length>2)throw new a("keyword expects 1 or 2 string arguments",{args:e});if(e[0].kind!=="string")throw new a(`keyword expects a string, got ${h(e[0])}`,{args:e});if(e.length===1)return D(`:${e[0].value}`);if(e[1].kind!=="string")throw new a(`keyword second argument must be a string, got ${h(e[1])}`,{args:e});return D(`:${e[0].value}/${e[1].value}`)}),xe(["Constructs a keyword with the given name and namespace strings. Returns a keyword value.","","Note: do not use : in the keyword strings, it will be added automatically.",'e.g. (keyword "foo") => :foo']),[["name"],["ns","name"]]),boolean:u(c("boolean",e=>y(e===void 0?!1:Ce(e))),"Coerces to boolean. Everything is true except false and nil.",[["x"]])},jn={...Zt,...Vt,...en,...tn,...gn,...nn,...rn,...Rn,...vn,...$n,...qn};function Fn(e,t){for(const[r,s]of Object.entries(jn))G(r,s,e);const n=t??(r=>console.log(r));G("println",c("println",(...r)=>(n(r.map(z).join(" ")),v())),e),G("print",c("print",(...r)=>(n(r.map(z).join(" ")),v())),e)}const lt=(e,t,n)=>({line:e,col:t,offset:n}),ut=(e,t)=>({peek:(n=0)=>{const r=t.offset+n;return r>=e.length?null:e[r]},isAtEnd:()=>t.offset>=e.length,position:()=>({offset:t.offset,line:t.line,col:t.col})});function Sn(e){const t=lt(0,0,0),n={...ut(e,t),advance:()=>{if(t.offset>=e.length)return null;const r=e[t.offset];return t.offset++,r===`
`?(t.line++,t.col=0):t.col++,r},consumeWhile(r){const s=[];for(;!n.isAtEnd()&&r(n.peek());)s.push(n.advance());return s.join("")}};return n}function En(e){const t=lt(0,0,0),n={...ut(e,t),advance:()=>{if(t.offset>=e.length)return null;const r=e[t.offset];return t.offset++,t.col=r.end.col,t.line=r.end.line,r},consumeWhile(r){const s=[];for(;!n.isAtEnd()&&r(n.peek());)s.push(n.advance());return s},consumeN(r){for(let s=0;s<r;s++)n.advance()}};return n}const Cn=e=>e===`
`,ye=e=>[" ",",",`
`,"\r","	"].includes(e),We=e=>e===";",ct=e=>e==="(",ft=e=>e===")",dt=e=>e==="[",pt=e=>e==="]",ht=e=>e==="{",mt=e=>e==="}",An=e=>e==='"',gt=e=>e==="'",wt=e=>e==="`",In=e=>e==="~",ze=e=>e==="@",pe=e=>{const t=parseInt(e);return isNaN(t)?!1:t>=0&&t<=9},Mn=e=>e===".",vt=e=>e===":",Pn=e=>e==="#",De=e=>ct(e)||ft(e)||dt(e)||pt(e)||ht(e)||mt(e)||wt(e)||gt(e)||ze(e),Un=e=>{const t=e.scanner,n=t.position();return t.consumeWhile(ye),{kind:k.Whitespace,start:n,end:t.position()}},Nn=e=>{const t=e.scanner,n=t.position();t.advance();const r=t.consumeWhile(s=>!Cn(s));return!t.isAtEnd()&&t.peek()===`
`&&t.advance(),{kind:k.Comment,value:r,start:n,end:t.position()}},Tn=e=>{const t=e.scanner,n=t.position();t.advance();const r=[];let s=!1;for(;!t.isAtEnd();){const o=t.peek();if(o==="\\"){t.advance();const i=t.peek();switch(i){case'"':r.push('"');break;case"\\":r.push("\\");break;case"n":r.push(`
`);break;case"r":r.push("\r");break;case"t":r.push("	");break;default:r.push(i)}t.isAtEnd()||t.advance();continue}if(o==='"'){t.advance(),s=!0;break}r.push(t.advance())}if(!s)throw new te(`Unterminated string detected at ${n.offset}`,t.position());return{kind:k.String,value:r.join(""),start:n,end:t.position()}},Ln=e=>{const t=e.scanner,n=t.position(),r=t.consumeWhile(s=>vt(s)||!ye(s)&&!De(s)&&!We(s));return{kind:k.Keyword,value:r,start:n,end:t.position()}};function Bn(e,t){const r=t.scanner.peek(1);return pe(e)||e==="-"&&r!==null&&pe(r)}const Wn=e=>{const t=e.scanner,n=t.position();let r="";if(t.peek()==="-"&&(r+=t.advance()),r+=t.consumeWhile(pe),!t.isAtEnd()&&t.peek()==="."&&t.peek(1)!==null&&pe(t.peek(1))&&(r+=t.advance(),r+=t.consumeWhile(pe)),!t.isAtEnd()&&(t.peek()==="e"||t.peek()==="E")){r+=t.advance(),!t.isAtEnd()&&(t.peek()==="+"||t.peek()==="-")&&(r+=t.advance());const s=t.consumeWhile(pe);if(s.length===0)throw new te(`Invalid number format at line ${n.line} column ${n.col}: "${r}"`,{start:n,end:t.position()});r+=s}if(!t.isAtEnd()&&Mn(t.peek()))throw new te(`Invalid number format at line ${n.line} column ${n.col}: "${r}${t.consumeWhile(s=>!ye(s)&&!De(s))}"`,{start:n,end:t.position()});return{kind:k.Number,value:Number(r),start:n,end:t.position()}},zn=e=>{const t=e.scanner,n=t.position(),r=t.consumeWhile(s=>!ye(s)&&!De(s)&&!We(s));return{kind:k.Symbol,value:r,start:n,end:t.position()}},Dn=e=>{const t=e.scanner,n=t.position();return t.advance(),{kind:"Deref",start:n,end:t.position()}},On=(e,t)=>{const n=e.scanner;n.advance();const r=[];let s=!1;for(;!n.isAtEnd();){const o=n.peek();if(o==="\\"){n.advance();const i=n.peek();if(i===null)throw new te(`Unterminated regex literal at ${t.offset}`,n.position());i==='"'?r.push('"'):(r.push("\\"),r.push(i)),n.advance();continue}if(o==='"'){n.advance(),s=!0;break}r.push(n.advance())}if(!s)throw new te(`Unterminated regex literal at ${t.offset}`,n.position());return{kind:k.Regex,value:r.join(""),start:t,end:n.position()}};function Kn(e){const t=e.scanner,n=t.position();t.advance();const r=t.peek();if(r==="(")return t.advance(),{kind:k.AnonFnStart,start:n,end:t.position()};if(r==='"')return On(e,n);throw r==="{"?new te("Set literals are not yet supported",n):new te(`Unknown dispatch character: #${r??"EOF"}`,n)}function se(e,t){return n=>{const r=n.scanner,s=r.position();return r.advance(),{kind:e,value:t,start:s,end:r.position()}}}function Qn(e){const t=e.scanner,n=t.position();t.advance();const r=t.peek();if(!r)throw new te(`Unexpected end of input while parsing unquote at ${n.offset}`,n);return ze(r)?(t.advance(),{kind:k.UnquoteSplicing,value:Z.UnquoteSplicing,start:n,end:t.position()}):{kind:k.Unquote,value:Z.Unquote,start:n,end:t.position()}}const _n=[[ye,Un],[We,Nn],[ct,se(k.LParen,Z.LParen)],[ft,se(k.RParen,Z.RParen)],[dt,se(k.LBracket,Z.LBracket)],[pt,se(k.RBracket,Z.RBracket)],[ht,se(k.LBrace,Z.LBrace)],[mt,se(k.RBrace,Z.RBrace)],[An,Tn],[vt,Ln],[Bn,Wn],[gt,se(k.Quote,Z.Quote)],[wt,se(k.Quasiquote,Z.Quasiquote)],[In,Qn],[ze,Dn],[Pn,Kn]];function Jn(e){const n=e.scanner.peek(),r=_n.find(([s])=>s(n,e));if(r){const[,s]=r;return s(e)}return zn(e)}function Gn(e){const t=[];let n;try{for(;!e.scanner.isAtEnd();){const s=Jn(e);if(!s)break;s.kind!==k.Whitespace&&t.push(s)}}catch(s){n=s}return{tokens:t,scanner:e.scanner,error:n}}function ne(e){return"value"in e?e.value:""}function Ge(e){const t=e.length,r={scanner:Sn(e)},s=Gn(r);if(s.error)throw s.error;if(s.scanner.position().offset!==t)throw new te(`Unexpected end of input, expected ${t} characters, got ${s.scanner.position().offset}`,s.scanner.position());return s.tokens}function Hn(e){const t=e.scanner,n=t.peek();if(!n)throw new R("Unexpected end of input",t.position());switch(n.kind){case k.Symbol:return rr(t);case k.String:{t.advance();const r={kind:"string",value:n.value};return oe(r,{start:n.start.offset,end:n.end.offset}),r}case k.Number:{t.advance();const r={kind:"number",value:n.value};return oe(r,{start:n.start.offset,end:n.end.offset}),r}case k.Keyword:{t.advance();const r=n.value;let s;if(r.startsWith("::")){const o=r.slice(2);if(o.includes("/")){const i=o.indexOf("/"),l=o.slice(0,i),p=o.slice(i+1),f=e.aliases.get(l);if(!f)throw new R(`No namespace alias '${l}' found for ::${l}/${p}`,n,{start:n.start.offset,end:n.end.offset});s={kind:"keyword",name:`:${f}/${p}`}}else s={kind:"keyword",name:`:${e.namespace}/${o}`}}else s={kind:"keyword",name:r};return oe(s,{start:n.start.offset,end:n.end.offset}),s}}throw new R(`Unexpected token: ${n.kind}`,n,{start:n.start.offset,end:n.end.offset})}const Xn=e=>{const t=e.scanner,n=t.peek();if(!n)throw new R("Unexpected end of input while parsing quote",t.position());t.advance();const r=V(e);if(!r)throw new R(`Unexpected token: ${ne(n)}`,n);return{kind:g.list,value:[N("quote"),r]}},Yn=e=>{const t=e.scanner,n=t.peek();if(!n)throw new R("Unexpected end of input while parsing quasiquote",t.position());t.advance();const r=V(e);if(!r)throw new R(`Unexpected token: ${ne(n)}`,n);return{kind:g.list,value:[N("quasiquote"),r]}},Zn=e=>{const t=e.scanner,n=t.peek();if(!n)throw new R("Unexpected end of input while parsing unquote",t.position());t.advance();const r=V(e);if(!r)throw new R(`Unexpected token: ${ne(n)}`,n);return{kind:g.list,value:[N("unquote"),r]}},Vn=e=>{const t=e.scanner,n=t.peek();if(!n)throw new R("Unexpected end of input while parsing deref",t.position());t.advance();const r=V(e);if(!r)throw new R(`Unexpected token: ${ne(n)}`,n);return{kind:g.list,value:[N("deref"),r]}},er=e=>{const t=e.scanner,n=t.peek();if(!n)throw new R("Unexpected end of input while parsing unquote splicing",t.position());t.advance();const r=V(e);if(!r)throw new R(`Unexpected token: ${ne(n)}`,n);return{kind:g.list,value:[N("unquote-splicing"),r]}},Oe=e=>[k.RParen,k.RBracket,k.RBrace].includes(e.kind),yt=(e,t)=>function(n){const r=n.scanner,s=r.peek();if(!s)throw new R("Unexpected end of input while parsing collection",r.position());r.advance();const o=[];let i=!1,l;for(;!r.isAtEnd();){const f=r.peek();if(!f)break;if(Oe(f)&&f.kind!==t)throw new R(`Expected '${t}' to close ${e} started at line ${s.start.line} column ${s.start.col}, but got '${ne(f)}' at line ${f.start.line} column ${f.start.col}`,f,{start:f.start.offset,end:f.end.offset});if(f.kind===t){l=f.end.offset,r.advance(),i=!0;break}const d=V(n);o.push(d)}if(!i)throw new R(`Unmatched ${e} started at line ${s.start.line} column ${s.start.col}`,r.peek());const p={kind:e,value:o};return l!==void 0&&oe(p,{start:s.start.offset,end:l}),p},tr=yt("list",k.RParen),nr=yt("vector",k.RBracket),rr=e=>{const t=e.peek();if(!t)throw new R("Unexpected end of input",e.position());if(t.kind!==k.Symbol)throw new R(`Unexpected token: ${ne(t)}`,t,{start:t.start.offset,end:t.end.offset});e.advance();let n;switch(t.value){case"true":case"false":n=y(t.value==="true");break;case"nil":n=v();break;default:n=N(t.value)}return oe(n,{start:t.start.offset,end:t.end.offset}),n},sr=e=>{const t=e.scanner,n=t.peek();if(!n)throw new R("Unexpected end of input while parsing map",t.position());let r=!1,s;t.advance();const o=[];for(;!t.isAtEnd();){const l=t.peek();if(!l)break;if(Oe(l)&&l.kind!==k.RBrace)throw new R(`Expected '}' to close map started at line ${n.start.line} column ${n.start.col}, but got '${l.kind}' at line ${l.start.line} column ${l.start.col}`,l,{start:l.start.offset,end:l.end.offset});if(l.kind===k.RBrace){s=l.end.offset,t.advance(),r=!0;break}const p=V(e),f=t.peek();if(!f)throw new R(`Expected value in map started at line ${n.start.line} column ${n.start.col}, but got end of input`,t.position());if(f.kind===k.RBrace)throw new R(`Map started at line ${n.start.line} column ${n.start.col} has key ${p.kind} but no value`,t.position());const d=V(e);if(!d)break;o.push([p,d])}if(!r)throw new R(`Unmatched map started at line ${n.start.line} column ${n.start.col}`,t.peek());const i={kind:g.map,entries:o};return s!==void 0&&oe(i,{start:n.start.offset,end:s}),i};function or(e){let t=0,n=!1;function r(s){switch(s.kind){case"symbol":{const o=s.name;o==="%"||o==="%1"?t=Math.max(t,1):/^%[2-9]$/.test(o)?t=Math.max(t,parseInt(o[1])):o==="%&"&&(n=!0);break}case"list":case"vector":for(const o of s.value)r(o);break;case"map":for(const[o,i]of s.entries)r(o),r(i);break}}for(const s of e)r(s);return{maxIndex:t,hasRest:n}}function ge(e){switch(e.kind){case"symbol":{const t=e.name;return t==="%"||t==="%1"?N("p1"):/^%[2-9]$/.test(t)?N(`p${t[1]}`):t==="%&"?N("rest"):e}case"list":return{...e,value:e.value.map(ge)};case"vector":return{...e,value:e.value.map(ge)};case"map":return{...e,entries:e.entries.map(([t,n])=>[ge(t),ge(n)])};default:return e}}const ar=e=>{const t=e.scanner,n=t.peek();if(!n)throw new R("Unexpected end of input while parsing anonymous function",t.position());t.advance();const r=[];let s=!1,o;for(;!t.isAtEnd();){const w=t.peek();if(!w)break;if(Oe(w)&&w.kind!==k.RParen)throw new R(`Expected ')' to close anonymous function started at line ${n.start.line} column ${n.start.col}, but got '${ne(w)}' at line ${w.start.line} column ${w.start.col}`,w,{start:w.start.offset,end:w.end.offset});if(w.kind===k.RParen){o=w.end.offset,t.advance(),s=!0;break}if(w.kind===k.AnonFnStart)throw new R("Nested anonymous functions (#(...)) are not allowed",w,{start:w.start.offset,end:w.end.offset});r.push(V(e))}if(!s)throw new R(`Unmatched anonymous function started at line ${n.start.line} column ${n.start.col}`,t.peek());const i={kind:"list",value:r},{maxIndex:l,hasRest:p}=or([i]),f=[];for(let w=1;w<=l;w++)f.push(N(`p${w}`));p&&(f.push(N("&")),f.push(N("rest")));const d=ge(i),m=T([N("fn"),M(f),d]);return o!==void 0&&oe(m,{start:n.start.offset,end:o}),m};function ir(e){let t=e,n="";const r=/^\(\?([imsx]+)\)/;let s;for(;(s=r.exec(t))!==null;){for(const o of s[1]){if(o==="x")throw new R("Regex flag (?x) (verbose mode) has no JavaScript equivalent and is not supported",null);n.includes(o)||(n+=o)}t=t.slice(s[0].length)}return{pattern:t,flags:n}}const lr=e=>{const t=e.scanner,n=t.peek();if(!n||n.kind!==k.Regex)throw new R("Expected regex token",t.position());t.advance();const{pattern:r,flags:s}=ir(n.value),o=Ve(r,s);return oe(o,{start:n.start.offset,end:n.end.offset}),o};function V(e){const t=e.scanner,n=t.peek();if(!n)throw new R("Unexpected end of input",t.position());switch(n.kind){case k.String:case k.Number:case k.Keyword:case k.Symbol:return Hn(e);case k.LParen:return tr(e);case k.LBrace:return sr(e);case k.LBracket:return nr(e);case k.Quote:return Xn(e);case k.Quasiquote:return Yn(e);case k.Unquote:return Zn(e);case k.UnquoteSplicing:return er(e);case k.AnonFnStart:return ar(e);case k.Deref:return Vn(e);case k.Regex:return lr(e);default:throw new R(`Unexpected token: ${ne(n)} at line ${n.start.line} column ${n.start.col}`,n,{start:n.start.offset,end:n.end.offset})}}function He(e,t="user",n=new Map){const r=e.filter(l=>l.kind!==k.Comment),s=En(r),o={scanner:s,namespace:t,aliases:n},i=[];for(;!s.isAtEnd();)i.push(V(o));return i}const ur=`(ns clojure.core)

(defmacro defn [name & fdecl]
  (let [doc       (if (string? (first fdecl)) (first fdecl) nil)
        rest-decl (if doc (rest fdecl) fdecl)
        arglists  (if (vector? (first rest-decl))
                    (vector (first rest-decl))
                    (reduce (fn [acc arity] (conj acc (first arity))) [] rest-decl))]
    (if doc
      \`(def ~name (with-meta (fn ~@rest-decl) {:doc ~doc :arglists '~arglists}))
      \`(def ~name (with-meta (fn ~@rest-decl) {:arglists '~arglists})))))

(defn next
  "Returns a seq of the items after the first. Calls seq on its
  argument.  If there are no more items, returns nil."
  [coll]
  (seq (rest coll)))

(defn not
  "Returns true if x is logical false, false otherwise."
  [x] (if x false true))

(defn second
  "Same as (first (next x))"
  [coll]
  (first (next coll)))


(defmacro when [condition & body]
  \`(if ~condition (do ~@body) nil))

(defmacro when-not [condition & body]
  \`(if ~condition nil (do ~@body)))

(defmacro and [& forms]
  (if (nil? forms)
    true
    (if (nil? (seq (rest forms)))
      (first forms)
      \`(let [v# ~(first forms)]
         (if v# (and ~@(rest forms)) v#)))))

(defmacro or [& forms]
  (if (nil? forms)
    nil
    (if (nil? (seq (rest forms)))
      (first forms)
      \`(let [v# ~(first forms)]
         (if v# v# (or ~@(rest forms)))))))

(defmacro cond [& clauses]
  (if (nil? clauses)
    nil
    \`(if ~(first clauses)
       ~(first (next clauses))
       (cond ~@(rest (rest clauses))))))

(defmacro -> [x & forms]
  (if (nil? forms)
    x
    (let [form (first forms)
          more (rest forms)
          threaded (if (list? form)
                     \`(~(first form) ~x ~@(rest form))
                     \`(~form ~x))]
      \`(-> ~threaded ~@more))))

(defmacro ->> [x & forms]
  (if (nil? forms)
    x
    (let [form (first forms)
          more (rest forms)
          threaded (if (list? form)
                     \`(~(first form) ~@(rest form) ~x)
                     \`(~form ~x))]
      \`(->> ~threaded ~@more))))

(defmacro comment
  ; Ignores body, yields nil
  [& body])

(defn constantly
  "Returns a function that takes any number of arguments and returns x."
  [x] (fn [& _] x))

(defn some?
  "Returns true if x is not nil, false otherwise"
  [x] (not (nil? x)))

(defn any?
  "Returns true for any given argument"
  [_x] true)

(defn complement
  "Takes a fn f and returns a fn that takes the same arguments as f,
  has the same effects, if any, and returns the opposite truth value."
  [f]
  (fn
    ([] (not (f)))
    ([x] (not (f x)))
    ([x y] (not (f x y)))
    ([x y & zs] (not (apply f x y zs)))))

(defn juxt
  "Takes a set of functions and returns a fn that is the juxtaposition
  of those fns. The returned fn takes a variable number of args and
  returns a vector containing the result of applying each fn to the args."
  [& fns]
  (fn [& args]
    (reduce (fn [acc f] (conj acc (apply f args))) [] fns)))

(defn merge
  "Returns a map that consists of the rest of the maps conj-ed onto
  the first. If a key occurs in more than one map, the mapping from
  the latter (left-to-right) will be the mapping in the result."
  [& maps]
  (if (nil? maps)
    nil
    (reduce
     (fn [acc m]
       (if (nil? m)
         acc
         (if (nil? acc)
           m
           (reduce
            (fn [macc entry]
              (assoc macc (first entry) (second entry)))
            acc
            m))))
     nil
     maps)))

(defn select-keys
  "Returns a map containing only those entries in map whose key is in keys."
  [m keys]
  (if (or (nil? m) (nil? keys))
    {}
    (let [missing (gensym)]
      (reduce
       (fn [acc k]
         (let [v (get m k missing)]
           (if (= v missing)
             acc
             (assoc acc k v))))
       {}
       keys))))

(defn update
  "Updates a value in an associative structure where k is a key and f is a
  function that will take the old value and any supplied args and return the
  new value, and returns a new structure."
  [m k f & args]
  (let [target (if (nil? m) {} m)]
    (assoc target k (if (nil? args)
                      (f (get target k))
                      (apply f (get target k) args)))))

(defn get-in
  "Returns the value in a nested associative structure, where ks is a
  sequence of keys. Returns nil if the key is not present, or the not-found
  value if supplied."
  ([m ks]
   (reduce get m ks))
  ([m ks not-found]
   (loop [m m, ks (seq ks)]
     (if (nil? ks)
       m
       (if (contains? m (first ks))
         (recur (get m (first ks)) (next ks))
         not-found)))))

(defn assoc-in
  "Associates a value in a nested associative structure, where ks is a
  sequence of keys and v is the new value. Returns a new nested structure."
  [m [k & ks] v]
  (if ks
    (assoc m k (assoc-in (get m k) ks v))
    (assoc m k v)))

(defn update-in
  "Updates a value in a nested associative structure, where ks is a
  sequence of keys and f is a function that will take the old value and any
  supplied args and return the new value. Returns a new nested structure."
  [m ks f & args]
  (assoc-in m ks (apply f (get-in m ks) args)))

(defn fnil
  "Takes a function f, and returns a function that calls f, replacing
  a nil first argument with x, optionally nil second with y, nil third with z."
  ([f x]
   (fn [a & more]
     (apply f (if (nil? a) x a) more)))
  ([f x y]
   (fn [a b & more]
     (apply f (if (nil? a) x a) (if (nil? b) y b) more)))
  ([f x y z]
   (fn [a b c & more]
     (apply f (if (nil? a) x a) (if (nil? b) y b) (if (nil? c) z c) more))))

(defn frequencies
  "Returns a map from distinct items in coll to the number of times they appear."
  [coll]
  (if (nil? coll)
    {}
    (reduce
     (fn [counts item]
       (assoc counts item (inc (get counts item 0))))
     {}
     coll)))

(defn group-by
  "Returns a map of the elements of coll keyed by the result of f on each
  element. The value at each key is a vector of matching elements."
  [f coll]
  (if (nil? coll)
    {}
    (reduce
     (fn [acc item]
       (let [k (f item)]
         (assoc acc k (conj (get acc k []) item))))
     {}
     coll)))

(defn distinct
  "Returns a vector of the elements of coll with duplicates removed,
  preserving first-seen order."
  [coll]
  (if (nil? coll)
    []
    (get
     (reduce
      (fn [state item]
        (let [seen (get state 0)
              out  (get state 1)]
          (if (get seen item false)
            state
            [(assoc seen item true) (conj out item)])))
      [{} []]
      coll)
     1)))

(defn flatten-step
  "Internal helper for flatten."
  [v]
  (if (or (list? v) (vector? v))
    (reduce
     (fn [acc item]
       (into acc (flatten-step item)))
     []
     v)
    [v]))

(defn flatten
  "Takes any nested combination of sequential things (lists/vectors) and
  returns their contents as a single flat vector."
  [x]
  (if (nil? x)
    []
    (flatten-step x)))

(defn reduce-kv
  "Reduces an associative structure. f should be a function of 3
  arguments: accumulator, key/index, value."
  [f init coll]
  (cond
    (map? coll)
    (reduce
     (fn [acc entry]
       (f acc (first entry) (second entry)))
     init
     coll)

    (vector? coll)
    (loop [idx 0
           acc init]
      (if (< idx (count coll))
        (recur (inc idx) (f acc idx (nth coll idx)))
        acc))

    :else
    (throw
     (ex-info
      "reduce-kv expects a map or vector"
      {:coll coll}))))

(defn sort-compare
  "Internal helper: normalizes comparator results."
  [cmp a b]
  (let [r (cmp a b)]
    (if (number? r)
      (< r 0)
      r)))

(defn insert-sorted
  "Internal helper for insertion-sort based sort implementation."
  [cmp x sorted]
  (loop [left  []
         right sorted]
    (if (nil? (seq right))
      (conj left x)
      (let [y (first right)]
        (if (sort-compare cmp x y)
          (into (conj left x) right)
          (recur (conj left y) (rest right)))))))

(defn sort
  "Returns the items in coll in sorted order. With no comparator, sorts
  ascending using <. Comparator may return boolean or number."
  ([coll] (sort < coll))
  ([cmp coll]
   (if (nil? coll)
     []
     (reduce
      (fn [acc item]
        (insert-sorted cmp item acc))
      []
      coll))))

(defn sort-by
  "Returns a sorted sequence of items in coll, where the sort order is
  determined by comparing (keyfn item)."
  ([keyfn coll] (sort-by keyfn < coll))
  ([keyfn cmp coll]
   (sort
    (fn [a b]
      (cmp (keyfn a) (keyfn b)))
    coll)))

(def not-any? (comp not some))

(defn not-every?
  "Returns false if (pred x) is logical true for every x in
  coll, else true."
  [pred coll] (not (every? pred coll)))

;; ── Transducer protocol ──────────────────────────────────────────────────────

;; into: 2-arity uses reduce+conj; 3-arity uses transduce
(defn into
  "Returns a new coll consisting of to-coll with all of the items of
   from-coll conjoined. A transducer may be supplied."
  ([to from] (reduce conj to from))
  ([to xf from] (transduce xf conj to from)))

;; sequence: materialise a transducer over a collection into a seq (list)
(defn sequence
  "Coerces coll to a (possibly empty) sequence, if it is not already
  one. Will not force a seq. (sequence nil) yields (), When a
  transducer is supplied, returns a lazy sequence of applications of
  the transform to the items in coll"
  ([coll] (apply list (into [] coll)))
  ([xf coll] (apply list (into [] xf coll))))

(defn completing
  "Takes a reducing function f of 2 args and returns a fn suitable for
  transduce by adding an arity-1 signature that calls cf (default -
  identity) on the result argument."
  ([f] (completing f identity))
  ([f cf]
   (fn
     ([] (f))
     ([x] (cf x))
     ([x y] (f x y)))))

;; map: 1-arg returns transducer; 2-arg is eager; 3+-arg zips collections
(defn map
  "Returns a sequence consisting of the result of applying f to the set
  of first items of each coll, followed by applying f to the set of
  second items in each coll, until any one of the colls is exhausted.
  Any remaining items in other colls are ignored. Returns a transducer
  when no collection is provided."
  ([f]
   (fn [rf]
     (fn
       ([] (rf))
       ([result] (rf result))
       ([result input] (rf result (f input))))))
  ([f coll]
   (sequence (map f) coll))
  ([f c1 c2]
   (loop [s1 (seq c1)
          s2 (seq c2)
          acc []]
     (if (or (nil? s1) (nil? s2))
       acc
       (recur
        (next s1)
        (next s2)
        (conj acc (f (first s1) (first s2)))))))
  ([f c1 c2 & colls]
   (loop [seqs (map seq (cons c1 (cons c2 colls)))
          acc []]
     (if (some nil? seqs)
       acc
       (recur (map next seqs) (conj acc (apply f (map first seqs))))))))

;; filter: 1-arg returns transducer; 2-arg is eager
(defn filter
  "Returns a sequence of the items in coll for which
  (pred item) returns logical true. pred must be free of side-effects.
  Returns a transducer when no collection is provided."
  ([pred]
   (fn [rf]
     (fn
       ([] (rf))
       ([result] (rf result))
       ([result input]
        (if (pred input)
          (rf result input)
          result)))))
  ([pred coll]
   (sequence (filter pred) coll)))

(defn remove
  "Returns a lazy sequence of the items in coll for which
  (pred item) returns logical false. pred must be free of side-effects.
  Returns a transducer when no collection is provided."
  ([pred] (filter (complement pred)))
  ([pred coll]
   (filter (complement pred) coll)))



;; take: stateful transducer; signals early termination after n items
;; r > 0 → keep going; r = 0 → take last item and stop; r < 0 → already past limit, stop
(defn take
  "Returns a sequence of the first n items in coll, or all items if
  there are fewer than n.  Returns a stateful transducer when
  no collection is provided."
  ([n]
   (fn [rf]
     (let [remaining (volatile! n)]
       (fn
         ([] (rf))
         ([result] (rf result))
         ([result input]
          (let [n @remaining
                nrem (vswap! remaining dec)
                result (if (pos? n)
                         (rf result input)
                         result)]
            (if (not (pos? nrem))
              (ensure-reduced result)
              result)))))))
  ([n coll]
   (sequence (take n) coll)))

;; take-while: stateless transducer; emits reduced when pred fails
(defn take-while
  "Returns a sequence of successive items from coll while
  (pred item) returns logical true. pred must be free of side-effects.
  Returns a transducer when no collection is provided."
  ([pred]
   (fn [rf]
     (fn
       ([] (rf))
       ([result] (rf result))
       ([result input]
        (if (pred input)
          (rf result input)
          (reduced result))))))
  ([pred coll]
   (sequence (take-while pred) coll)))

;; drop: stateful transducer; skips first n items
;; r >= 0 → still skipping; r < 0 → past the drop zone, start taking
(defn drop
  "Returns a sequence of all but the first n items in coll.
   Returns a stateful transducer when no collection is provided."
  ([n]
   (fn [rf]
     (let [remaining (volatile! n)]
       (fn
         ([] (rf))
         ([result] (rf result))
         ([result input]
          (let [rem @remaining]
            (vswap! remaining dec)
            (if (pos? rem)
              result
              (rf result input))))))))
  ([n coll]
   (sequence (drop n) coll)))

(defn drop-last
  "Return a sequence of all but the last n (default 1) items in coll"
  ([coll] (drop-last 1 coll))
  ([n coll] (map (fn [x _] x) coll (drop n coll))))

(defn take-last
  "Returns a sequence of the last n items in coll.  Depending on the type
  of coll may be no better than linear time.  For vectors, see also subvec."
  [n coll]
  (loop [s (seq coll), lead (seq (drop n coll))]
    (if lead
      (recur (next s) (next lead))
      s)))

;; drop-while: stateful transducer; passes through once pred fails
(defn drop-while
  "Returns a sequence of the items in coll starting from the
  first item for which (pred item) returns logical false.  Returns a
  stateful transducer when no collection is provided."
  ([pred]
   (fn [rf]
     (let [dropping (volatile! true)]
       (fn
         ([] (rf))
         ([result] (rf result))
         ([result input]
          (if (and @dropping (pred input))
            result
            (do
              (vreset! dropping false)
              (rf result input))))))))
  ([pred coll]
   (sequence (drop-while pred) coll)))

;; map-indexed: stateful transducer; passes index and item to f
(defn map-indexed
  "Returns a sequence consisting of the result of applying f to 0
   and the first item of coll, followed by applying f to 1 and the second
   item in coll, etc, until coll is exhausted. Thus function f should
   accept 2 arguments, index and item. Returns a stateful transducer when
   no collection is provided."
  ([f]
   (fn [rf]
     (let [i (volatile! -1)]
       (fn
         ([] (rf))
         ([result] (rf result))
         ([result input]
          (rf result (f (vswap! i inc) input)))))))
  ([f coll]
   (sequence (map-indexed f) coll)))

;; dedupe: stateful transducer; removes consecutive duplicates
(defn dedupe
  "Returns a sequence removing consecutive duplicates in coll.
   Returns a transducer when no collection is provided."
  ([]
   (fn [rf]
     (let [pv (volatile! ::none)]
       (fn
         ([] (rf))
         ([result] (rf result))
         ([result input]
          (let [prior @pv]
            (vreset! pv input)
            (if (= prior input)
              result
              (rf result input))))))))
  ([coll]
   (sequence (dedupe) coll)))

;; partition-all: stateful transducer; groups items into vectors of size n
(defn partition-all
  "Returns a sequence of lists like partition, but may include
   partitions with fewer than n items at the end.  Returns a stateful
   transducer when no collection is provided."
  ([n]
   (fn [rf]
     (let [buf (volatile! [])]
       (fn
         ([] (rf))
         ([result]
          (let [b @buf]
            (vreset! buf [])
            (if (empty? b)
              (rf result)
              (rf (unreduced (rf result b))))))
         ([result input]
          (let [nb (conj @buf input)]
            (if (= (count nb) n)
              (do
                (vreset! buf [])
                (rf result nb))
              (do
                (vreset! buf nb)
                result))))))))
  ([n coll]
   (sequence (partition-all n) coll)))

;; ── Documentation ────────────────────────────────────────────────────────────

(defmacro doc [sym]
  \`(let [v#        ~sym
         m#        (meta v#)
         d#        (:doc m#)
         args#     (:arglists m#)
         args-str# (when args#
                     (reduce
                      (fn [acc# a#]
                        (if (= acc# "")
                          (str "(" a# ")")
                          (str acc# "\\n" "(" a# ")")))
                      ""
                      args#))]
     (println (str (if args-str# (str args-str# "\\n\\n") "")
                   (or d# "No documentation available.")))))

(defn err
  "Creates an error map with type, message, data and optionally cause"
  ([type message] (err type message nil nil))
  ([type message data] (err type message data nil))
  ([type message data cause] {:type type :message message :data data :cause cause}))`,cr=`(ns clojure.string)

;; Runtime-injected native helpers. Declared here so clojure-lsp can resolve
;; them; the interpreter treats bare (def name) as a no-op and leaves the
;; native binding from coreEnv intact.
(def str-split*)
(def str-upper-case*)
(def str-lower-case*)
(def str-trim*)
(def str-triml*)
(def str-trimr*)
(def str-reverse*)
(def str-starts-with*)
(def str-ends-with*)
(def str-includes*)
(def str-index-of*)
(def str-last-index-of*)
(def str-replace*)
(def str-replace-first*)

;; ---------------------------------------------------------------------------
;; Joining / splitting
;; ---------------------------------------------------------------------------

(defn join
  "Returns a string of all elements in coll, as returned by (str), separated
  by an optional separator."
  ([coll] (join "" coll))
  ([separator coll]
   (if (nil? coll)
     ""
     (reduce
      (fn [acc x]
        (if (= acc "")
          (str x)
          (str acc separator x)))
      ""
      coll))))

(defn split
  "Splits string on a regular expression. Optional limit is the maximum number
  of parts returned. Trailing empty strings are not returned by default; pass
  a limit of -1 to return all."
  ([s sep] (str-split* s sep))
  ([s sep limit] (str-split* s sep limit)))

(defn split-lines
  "Splits s on \\\\n or \\\\r\\\\n. Trailing empty lines are not returned."
  [s]
  (split s #"\\r?\\n"))

;; ---------------------------------------------------------------------------
;; Case conversion
;; ---------------------------------------------------------------------------

(defn upper-case
  "Converts string to all upper-case."
  [s]
  (str-upper-case* s))

(defn lower-case
  "Converts string to all lower-case."
  [s]
  (str-lower-case* s))

(defn capitalize
  "Converts first character of the string to upper-case, all other
  characters to lower-case."
  [s]
  (if (< (count s) 2)
    (upper-case s)
    (str (upper-case (subs s 0 1)) (lower-case (subs s 1)))))

;; ---------------------------------------------------------------------------
;; Trimming
;; ---------------------------------------------------------------------------

(defn trim
  "Removes whitespace from both ends of string."
  [s]
  (str-trim* s))

(defn triml
  "Removes whitespace from the left side of string."
  [s]
  (str-triml* s))

(defn trimr
  "Removes whitespace from the right side of string."
  [s]
  (str-trimr* s))

(defn trim-newline
  "Removes all trailing newline \\\\n or return \\\\r characters from string.
  Similar to Perl's chomp."
  [s]
  (replace s #"[\\r\\n]+$" ""))

;; ---------------------------------------------------------------------------
;; Predicates
;; ---------------------------------------------------------------------------

(defn blank?
  "True if s is nil, empty, or contains only whitespace."
  [s]
  (or (nil? s) (not (nil? (re-matches #"\\s*" s)))))

(defn starts-with?
  "True if s starts with substr."
  [s substr]
  (str-starts-with* s substr))

(defn ends-with?
  "True if s ends with substr."
  [s substr]
  (str-ends-with* s substr))

(defn includes?
  "True if s includes substr."
  [s substr]
  (str-includes* s substr))

;; ---------------------------------------------------------------------------
;; Search
;; ---------------------------------------------------------------------------

(defn index-of
  "Return index of value (string) in s, optionally searching forward from
  from-index. Return nil if value not found."
  ([s value] (str-index-of* s value))
  ([s value from-index] (str-index-of* s value from-index)))

(defn last-index-of
  "Return last index of value (string) in s, optionally searching backward
  from from-index. Return nil if value not found."
  ([s value] (str-last-index-of* s value))
  ([s value from-index] (str-last-index-of* s value from-index)))

;; ---------------------------------------------------------------------------
;; Replacement
;; ---------------------------------------------------------------------------

(defn replace
  "Replaces all instances of match with replacement in s.

  match/replacement can be:
    string / string   — literal match, literal replacement
    pattern / string  — regex match; $1, $2, etc. substituted from groups
    pattern / fn      — regex match; fn called with match (string or vector
                        of [whole g1 g2 ...]), return value used as replacement.

  See also replace-first."
  [s match replacement]
  (str-replace* s match replacement))

(defn replace-first
  "Replaces the first instance of match with replacement in s.
  Same match/replacement semantics as replace."
  [s match replacement]
  (str-replace-first* s match replacement))

(defn re-quote-replacement
  "Given a replacement string that you wish to be a literal replacement for a
  pattern match in replace or replace-first, escape any special replacement
  characters ($ signs) so they are treated literally."
  [s]
  (replace s #"\\$" "$$$$"))

;; ---------------------------------------------------------------------------
;; Miscellaneous
;; ---------------------------------------------------------------------------

(defn reverse
  "Returns s with its characters reversed."
  [s]
  (str-reverse* s))

(defn escape
  "Return a new string, using cmap to escape each character ch from s as
  follows: if (cmap ch) is nil, append ch to the new string; otherwise append
  (str (cmap ch)).

  cmap may be a map or a function. Maps are callable directly (IFn semantics).

  Note: Clojure uses char literal keys (e.g. {\\\\< \\"&lt;\\"}). This interpreter
  has no char type, so map keys must be single-character strings instead
  (e.g. {\\"<\\" \\"&lt;\\"})."
  [s cmap]
  (apply str (map (fn [c]
                    (let [r (cmap c)]
                      (if (nil? r) c (str r))))
                  (split s #""))))
`,kt={"clojure.core":()=>ur,"clojure.string":()=>cr};function fr(e){const t=e.filter(n=>n.kind!=="Comment");return t.length<3||t[0].kind!=="LParen"||t[1].kind!=="Symbol"||t[1].value!=="ns"||t[2].kind!=="Symbol"?null:t[2].value}function Xe(e){const t=new Map,n=e.filter(o=>o.kind!=="Comment"&&o.kind!=="Whitespace");if(n.length<3||n[0].kind!=="LParen"||n[1].kind!=="Symbol"||n[1].value!=="ns")return t;let r=3,s=1;for(;r<n.length&&s>0;){const o=n[r];if(o.kind==="LParen"){s++,r++;continue}if(o.kind==="RParen"){s--,r++;continue}if(o.kind==="LBracket"){let i=r+1,l=null;for(;i<n.length&&n[i].kind!=="RBracket";){const p=n[i];p.kind==="Symbol"&&l===null&&(l=p.value),p.kind==="Keyword"&&(p.value===":as"||p.value===":as-alias")&&(i++,i<n.length&&n[i].kind==="Symbol"&&l&&t.set(n[i].value,l)),i++}}r++}return t}function dr(e){const t=e.find(n=>S(n)&&q(n.value[0])&&n.value[0].name==="ns");return!t||!S(t)?null:t}function pr(e){const t=dr(e);if(!t)return[];const n=[];for(let r=2;r<t.value.length;r++){const s=t.value[r];S(s)&&I(s.value[0])&&s.value[0].name===":require"&&n.push(s.value.slice(1))}return n}function Ye(e,t,n,r){if(!E(e))throw new a("require spec must be a vector, e.g. [my.ns :as alias]",{spec:e});const s=e.value;if(s.length===0||!q(s[0]))throw new a("First element of require spec must be a namespace symbol",{spec:e});const o=s[0].name;if(s.some(f=>I(f)&&f.name===":as-alias")){let f=1;for(;f<s.length;){const d=s[f];if(!I(d))throw new a(`Expected keyword in require spec, got ${d.kind}`,{spec:e,position:f});if(d.name===":as-alias"){f++;const m=s[f];if(!m||!q(m))throw new a(":as-alias expects a symbol alias",{spec:e,position:f});t.readerAliases||(t.readerAliases=new Map),t.readerAliases.set(m.name,o),f++}else throw new a(`:as-alias specs only support :as-alias, got ${d.name}`,{spec:e})}return}let l=n.get(o);if(!l&&r&&(r(o),l=n.get(o)),!l)throw new a(`Namespace ${o} not found. Only already-loaded namespaces can be required.`,{nsName:o});let p=1;for(;p<s.length;){const f=s[p];if(!I(f))throw new a(`Expected keyword in require spec, got ${f.kind}`,{spec:e,position:p});if(f.name===":as"){p++;const d=s[p];if(!d||!q(d))throw new a(":as expects a symbol alias",{spec:e,position:p});t.aliases||(t.aliases=new Map),t.aliases.set(d.name,l),p++}else if(f.name===":refer"){p++;const d=s[p];if(!d||!E(d))throw new a(":refer expects a vector of symbols",{spec:e,position:p});for(const m of d.value){if(!q(m))throw new a(":refer vector must contain only symbols",{spec:e,sym:m});let w;try{w=Fe(m.name,l)}catch{throw new a(`Symbol ${m.name} not found in namespace ${o}`,{nsName:o,symbol:m.name})}G(m.name,w,t)}p++}else throw new a(`Unknown require option ${f.name}. Supported: :as, :refer`,{spec:e,keyword:f.name})}}function hr(e,t){const n=e.registry;let r=e.currentNs;const s=n.get("clojure.core");s.resolveNs=b=>n.get(b)??null;const o=t?.output??(b=>console.log(b));G("println",c("println",(...b)=>(o(b.map(z).join(" ")),v())),s),G("print",c("print",(...b)=>(o(b.map(z).join(" ")),v())),s);const i=new Set(t?.sourceRoots??[]);function l(b){i.add(b)}const p=it();function f(b){const x=kt[b];if(x)return $(x(),b),!0;if(!t?.readFile||i.size===0)return!1;for(const j of i){const U=`${j.replace(/\/$/,"")}/${b.replace(/\./g,"/")}.clj`;try{const B=t.readFile(U);if(B)return $(B),!0}catch{continue}}return!1}function d(b){if(!n.has(b)){const x=we(s);x.namespace=b,n.set(b,x)}return n.get(b)}function m(b){d(b),r=b}function w(b){return n.get(b)??null}G("require",c("require",(...b)=>{const x=n.get(r);for(const j of b)Ye(j,x,n,f);return v()}),s);function F(b,x){const j=pr(b);for(const U of j)for(const B of U)Ye(B,x,n,f)}function $(b,x){const j=Ge(b),U=fr(j)??x??"user",B=Xe(j),re=He(j,U,B),X=d(U);F(re,X);for(const ie of re){const bt=p.expandAll(ie,X);p.evaluate(bt,X)}}return{registry:n,get currentNs(){return r},setNs:m,getNs:w,loadFile:$,addSourceRoot:l,evaluate(b){try{const x=Ge(b),j=w(r),U=Xe(x);j.aliases?.forEach((X,ie)=>{X.namespace&&U.set(ie,X.namespace)}),j.readerAliases?.forEach((X,ie)=>{U.set(ie,X)});const B=He(x,r,U);F(B,j);let re=v();for(const X of B){const ie=p.expandAll(X,j);re=p.evaluate(ie,j)}return re}catch(x){throw x instanceof je?new a(`Unhandled throw: ${h(x.value)}`,{thrownValue:x.value}):x instanceof he?new a("recur called outside of loop or fn",{args:x.args}):((x instanceof a||x instanceof R)&&x.pos&&(x.message+=un(b,x.pos)),x)}},evaluateForms(b){try{const x=w(r);let j=v();for(const U of b){const B=p.expandAll(U,x);j=p.evaluate(B,x)}return j}catch(x){throw x instanceof je?new a(`Unhandled throw: ${h(x.value)}`,{thrownValue:x.value}):x instanceof he?new a("recur called outside of loop or fn",{args:x.args}):x}}}}function gr(e){const t=new Map,n=we();n.namespace="clojure.core",Fn(n,e?.output),t.set("clojure.core",n);const r=we(n);r.namespace="user",t.set("user",r);const s=hr({registry:t,currentNs:"user"},e),o=kt["clojure.core"];if(!o)throw new Error("Missing built-in clojure.core source in registry");s.loadFile(o(),"clojure.core");for(const i of e?.entries??[])s.loadFile(i);return s}export{a as E,_e as a,v as b,gr as c,M as d,D as e,W as f,c as g,y as h,mr as i,A as j,L as k,h as p,Ge as t};
