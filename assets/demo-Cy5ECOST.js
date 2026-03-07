import{a,b as S,i as _,d as x,e as F,f as $,g as q,h as N,j as E,k as J,c as R}from"./session-BNEXPeZN.js";class u extends Error{context;constructor(t,e){super(t),this.name="ConversionError",this.context=e}}const B=new Set(["list","vector","map"]);function r(n){switch(n.kind){case"number":return n.value;case"string":return n.value;case"boolean":return n.value;case"nil":return null;case"keyword":return n.name.startsWith(":")?n.name.slice(1):n.name;case"symbol":return n.name;case"list":case"vector":return n.value.map(r);case"map":{const t={};for(const[e,s]of n.entries){if(B.has(e.kind))throw new u(`Rich key types (${e.kind}) are not supported in JS object conversion. Restructure your map to use string, keyword, or number keys.`,{key:e,value:s});const l=String(r(e));t[l]=r(s)}return t}case"function":case"native-function":{const t=n;return(...e)=>{const s=e.map(o),l=a(t,s);return r(l)}}case"macro":throw new u("Macros cannot be exported to JavaScript. Macros are compile-time constructs.",{macro:n})}}function o(n){if(n==null)return S();if(_(n))return n;switch(typeof n){case"number":return J(n);case"string":return E(n);case"boolean":return N(n);case"function":{const t=n;return q("js-fn",(...e)=>{const s=e.map(r),l=t(...s);return o(l)})}case"object":{if(Array.isArray(n))return x(n.map(o));const t=Object.entries(n).map(([e,s])=>[F(`:${e}`),o(s)]);return $(t)}default:throw new u(`Cannot convert JS value of type ${typeof n} to CljValue`,{value:n})}}let d=null;function f(){return d||(d=R()),d}const m=f();m.loadFile(`(ns demo.math)

;; (def pi 3.14159)
(def pi 3.14159)

(defn add [a b]
  (+ a b))

(defn square [x]
  (* x x))

(defn factorial [n]
  (loop [i n acc 1]
    (if (<= i 1)
      acc
      (recur (dec i) (* acc i)))))`,"demo.math");const K=m.getNs("demo.math");r(K.bindings.get("pi"));const p=f();p.loadFile(`(ns demo
  (:require [demo.math :refer [pi square factorial] :as m]))

(def greeting "Hello from Clojure!")

(def add m/add)

(add 1 2)

(doc reduce)

(defn greet [name]
  (str greeting " Welcome, " name "!"))

(greet "Regibyte")

(defn fibonacci [n]
  (loop [i 0 a 0 b 1]
    (if (= i n)
      a
      (recur (inc i) b (+ a b)))))

(+ 1 2)

(println "Hello World!" "From Calva!!!!!!")

(type {:this-is :awesome!})

(when true
  (println "Yes\\n")
  (println "This\\n")
  (println "Is working!")
  42)


(map inc [2 3 4 5 8 2])`,"demo");const c=p.getNs("demo"),b=r(c.bindings.get("pi"));function j(...n){const t=c.bindings.get("square"),e=n.map(o),s=a(t,e);return r(s)}function h(...n){const t=c.bindings.get("factorial"),e=n.map(o),s=a(t,e);return r(s)}const y=r(c.bindings.get("greeting"));function w(...n){const t=c.bindings.get("add"),e=n.map(o),s=a(t,e);return r(s)}function k(...n){const t=c.bindings.get("greet"),e=n.map(o),s=a(t,e);return r(s)}function C(...n){const t=c.bindings.get("fibonacci"),e=n.map(o),s=a(t,e);return r(s)}const A=document.getElementById("results");function i(n,t){const e=document.createElement("div");e.className="result",e.innerHTML=`<span class="label">${n}</span> → <span class="value">${JSON.stringify(t)}</span>`,A.appendChild(e)}function g(n){const t=document.createElement("h2");t.textContent=n,A.appendChild(t)}g("Values");i("greeting",y);i("pi",b);g("Functions");i("(add 3 4)",w(3,4));i("(square 7)",j(7));i("(factorial 10)",h(10));i('(greet "RegiByte")',k("RegiByte"));g("Fibonacci sequence");for(let n=0;n<=10;n++)i(`(fibonacci ${n})`,C(n));console.log("All Clojure imports working!");window.bindings={greeting:y,pi:b,add:w,square:j,factorial:h,greet:k,fibonacci:C};console.log(window.bindings);
