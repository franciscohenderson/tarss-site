import{r as e}from"./rolldown-runtime-hePW80VL.js";import{a as t,c as n,l as r}from"./index-DOiJ5UmT.js";import{A as i,C as a,E as o,O as s,P as c,T as l,_ as u,a as d,b as f,c as p,i as m,k as h,n as g,o as _,p as v,u as y,w as b,y as x}from"./three.module-zi5eeQJb.js";var S=e(r(),1),C=n(),ee=`
  attribute vec3 aPosB;
  attribute vec3 aColB;
  attribute vec3 color;
  attribute vec4 aRand;
  uniform float uTime, uIntro, uMix, uTunnel, uBase, uScale, uCamZ, uFade;
  uniform vec2 uWind;
  varying vec3 vColor;
  varying float vAlpha;

  vec3 hash3(float n) { return fract(sin(vec3(n, n + 1.7, n + 3.1)) * vec3(43758.5453, 22578.1459, 19642.3490)) * 2.0 - 1.0; }

  void main() {
    vec3 a = position;
    vec3 b = aPosB;
    float m = smoothstep(aRand.x * 0.35, 0.65 + aRand.x * 0.35, uMix);
    vec3 p = mix(a, b, m);
    // Entre una foto y otra los puntos se abren como polvo y se vuelven a juntar.
    float burst = sin(3.14159 * m);
    p += hash3(aRand.y * 91.0) * burst * (0.35 + aRand.z * 0.9);
    vec3 col = mix(color, aColB, m);

    // Entrada: todos parten de un puñado de puntitos en el centro.
    float d = clamp((uIntro - aRand.x * 0.55) / 0.45, 0.0, 1.0);
    float e = 1.0 - pow(1.0 - d, 3.0);
    vec3 seed = hash3(aRand.w * 37.0) * vec3(0.32, 0.32, 0.2) + vec3(0.0, -0.12, 0.0);
    p = mix(seed, p, e);

    p.xy *= uScale;
    // Viento: las copas se mueven más que el suelo.
    float sway = sin(uTime * 0.7 + p.y * 1.7 + aRand.y * 6.28) * 0.012 + sin(uTime * 1.9 + aRand.z * 9.0) * 0.004;
    p.x += sway * (0.6 + aRand.w) + uWind.x * (p.z + 1.0) * 0.04;
    p.y += uWind.y * (p.z + 1.0) * 0.03;

    // Túnel: los puntos corren hacia la cámara y se abren hacia los bordes.
    float t = uTunnel * uTunnel;
    p.z += t * (6.0 + aRand.z * 14.0);
    p.xy *= 1.0 + t * (0.6 + aRand.x * 1.2);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float near = max(-mv.z, 0.05);
    gl_PointSize = min(uBase * uScale * (uCamZ / near) * (0.65 + aRand.y * 0.8), uBase * uScale * 3.5);
    vColor = col * (1.0 + t * 0.35);
    vAlpha = uFade * (0.25 + 0.75 * e) * smoothstep(0.05, 0.5, near) * (1.0 - smoothstep(0.75, 1.0, uTunnel));
  }
`,te=`
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    float a = smoothstep(0.5, 0.28, r) * vAlpha;
    if (a < 0.02) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;async function w(e,t,n,r,i){let a=new Image;a.crossOrigin=`anonymous`,a.src=e,await a.decode();let o=Math.round(t*a.naturalHeight/a.naturalWidth),c=document.createElement(`canvas`);c.width=t,c.height=o;let l=c.getContext(`2d`,{willReadFrequently:!0});l.drawImage(a,0,0,t,o);let u=l.getImageData(0,0,t,o).data,d=t*o,f=new Float32Array(d*3),m=new Float32Array(d*3),h=4*t/o,g=i.map(e=>new p(e)),_=1,v=()=>(_=_*16807%2147483647)/2147483647;for(let e=0;e<o;e++)for(let i=0;i<t;i++){let a=e*t+i,c=(i+v()*.9)/t,l=(e+v()*.9)/o,d=Math.hypot((c-n[0])*1.1,l-n[1]),_=1-Math.min(d/.7,1);f[a*3]=(c-.5)*h,f[a*3+1]=(.5-l)*4,f[a*3+2]=-_*_*r+(v()-.5)*.18;let y=u[a*4]/255,b=u[a*4+1]/255,x=u[a*4+2]/255;if(g.length&&v()<.05){let e=g[Math.floor(v()*g.length)],t=.35+v()*.5;y+=(e.r-y)*t,b+=(e.g-b)*t,x+=(e.b-x)*t}let S=new p().setRGB(y,b,x,s);m[a*3]=S.r,m[a*3+1]=S.g,m[a*3+2]=S.b}return{pos:f,col:m,n:d,W:h,H:4,cols:t}}function ne(e){let t=document.createElement(`canvas`);t.width=4096,t.height=220;let n=t.getContext(`2d`);n.fillStyle=e.color??`#fff`,n.font=`${e.weight??400} 150px ${e.font}`,n.textBaseline=`middle`;let r=`${e.text}`,i=n.measureText(r).width,a=Math.max(2,Math.floor(4096/(i+140))),o=(4096-a*i)/a;for(let e=0;e<a;e++)n.fillText(r,e*(i+o)+o/2,118);let c=new _(t);c.colorSpace=s,c.anisotropy=8;let l=new y(e.radius??1.25,e.radius??1.25,e.height??.34,160,1,!0),u=new f({map:c,transparent:!0,side:2,depthWrite:!1}),d=new x(l,u),p=new v;return p.add(d),p.rotation.set(e.tilt?.[0]??.28,0,e.tilt?.[1]??-.1),p.position.set(0,e.y??.15,e.z??-.6),{tilt:p,mesh:d,mat:u}}function T({src:e,progress:n,api:r,bg:_=`#0b0a10`,vp:v=[.5,.75],depth:y=3.2,ring:T,speckle:E=[],cols:D=180,fit:O=`cover`,transparent:k=!1,className:A=``,onReady:re}){let j=(0,S.useRef)(null),M=t();return(0,S.useEffect)(()=>{let t=j.current;if(!t)return;let S;try{S=new g({antialias:!1,alpha:k,premultipliedAlpha:!1,powerPreference:`high-performance`})}catch{return}let C=!0,A=Math.min(window.devicePixelRatio||1,2);S.setPixelRatio(A),S.outputColorSpace=s,S.setClearColor(_,+!k),S.autoClear=!1,t.appendChild(S.domElement);let N=new h,P=5.2,F=new b(42,1,.05,60);F.position.set(0,0,P);let I=new h,ie=new a(-1,1,1,-1,0,1),L=new f({color:new p(_),transparent:!0,opacity:1,depthTest:!1,depthWrite:!1});I.add(new x(new l(2,2),L));let R={uTime:{value:0},uIntro:{value:+!!M},uMix:{value:0},uTunnel:{value:0},uBase:{value:2},uScale:{value:1},uCamZ:{value:P},uWind:{value:new c},uFade:{value:1}},z=1,B=new i({vertexShader:ee,fragmentShader:te,uniforms:R,transparent:!0,depthWrite:!1}),V=null,H=null,U=null,W=null,G=()=>{let{width:e,height:n}=t.getBoundingClientRect();if(!e||!n||(S.setSize(e,n,!1),F.aspect=e/n,F.updateProjectionMatrix(),!H))return;let r=2*P*Math.tan(u.degToRad(F.fov/2)),i=r*F.aspect,a=O===`width`?i/H.W*1.12:Math.max(i/H.W,r/H.H)*1.04;R.uScale.value=a;let o=H.W/H.cols,s=n*A/r;R.uBase.value=o*s*1.25},ae=e=>{let t=new d;t.setAttribute(`position`,new m(e.pos,3)),t.setAttribute(`color`,new m(e.col,3)),t.setAttribute(`aPosB`,new m(e.pos.slice(),3)),t.setAttribute(`aColB`,new m(e.col.slice(),3));let n=new Float32Array(e.n*4);for(let e=0;e<n.length;e++)n[e]=Math.random();t.setAttribute(`aRand`,new m(n,4)),V=new o(t,B),V.frustumCulled=!1,N.add(V)};r&&(r.current={show:async e=>{if(!V)return;let t=await w(e,D,v,y,E);if(!C)return;let n=V.geometry,r=n.attributes.position.count,i=n.attributes.aPosB.array,a=n.attributes.aColB.array;for(let e=0;e<r;e++){let n=e%t.n*3;i[e*3]=t.pos[n],i[e*3+1]=t.pos[n+1],i[e*3+2]=t.pos[n+2],a[e*3]=t.col[n],a[e*3+1]=t.col[n+1],a[e*3+2]=t.col[n+2]}n.attributes.aPosB.needsUpdate=!0,n.attributes.aColB.needsUpdate=!0,W={start:performance.now(),dur:M?10:1900}},fade:e=>z=e}),(async()=>{try{if(T?.font){let e=T.font.replace(/"/g,``);for(let t=0;t<50&&![...document.fonts].some(t=>t.family.replace(/"/g,``)===e&&t.status===`loaded`);t++)await new Promise(e=>setTimeout(e,60))}H=await w(e,D,v,y,E)}catch{return}C&&(ae(H),T&&(U=ne(T),N.add(U.tilt)),G(),re?.())})(),G();let K=new ResizeObserver(G);K.observe(t);let q=!0,J=new IntersectionObserver(([e])=>q=e.isIntersecting);J.observe(t);let Y=new c,X=new c,Z=e=>{let n=t.getBoundingClientRect();n.width&&Y.set(((e.clientX-n.left)/n.width-.5)*2,((e.clientY-n.top)/n.height-.5)*-2)};window.addEventListener(`pointermove`,Z,{passive:!0});let Q=0,oe=performance.now(),$=0,se=0,ce=e=>{Q=requestAnimationFrame(ce);let t=Math.min((e-oe)/1e3,.05);if(oe=e,!q||document.hidden||!V)return;if(R.uTime.value+=t,M||(R.uIntro.value=Math.min(1,R.uIntro.value+t/2.6)),$+=((n?.current??0)-$)*Math.min(t*5,1),R.uTunnel.value=$,W){let t=Math.min((e-W.start)/W.dur,1);if(R.uMix.value=t<.5?4*t*t*t:1-(-2*t+2)**3/2,t>=1){let e=V.geometry;e.attributes.position.array.set(e.attributes.aPosB.array),e.attributes.color.array.set(e.attributes.aColB.array),e.attributes.position.needsUpdate=!0,e.attributes.color.needsUpdate=!0,R.uMix.value=0,W=null}}R.uFade.value+=(z-R.uFade.value)*Math.min(t*4,1),X.lerp(Y,Math.min(t*2.5,1)),R.uWind.value.copy(X),F.position.x=X.x*.12+Math.sin(R.uTime.value*.21)*.05,F.position.y=X.y*.08,F.lookAt(0,0,-1.5),U&&(U.mesh.rotation.y=-R.uTime.value*.32-$*2.5,U.mat.opacity=Math.max(0,1-$*3.2)*Math.min(1,Math.max(0,(R.uIntro.value-.55)/.35)),U.tilt.scale.setScalar(1+$*1.4));let r=Math.abs($-se)/Math.max(t,.001);se=$,L.opacity=!k&&($>.02||W)?u.clamp(.16+(W?.25:0)+r*.02,.12,.6):1,L.opacity>=1?S.clear():S.render(I,ie),S.render(N,F)};return Q=requestAnimationFrame(ce),()=>{C=!1,cancelAnimationFrame(Q),K.disconnect(),J.disconnect(),window.removeEventListener(`pointermove`,Z),V?.geometry.dispose(),B.dispose(),U&&(U.mesh.geometry.dispose(),U.mat.map?.dispose(),U.mat.dispose()),L.dispose(),S.dispose(),S.domElement.remove()}},[M]),(0,C.jsx)(`div`,{ref:j,"aria-hidden":`true`,className:`demo-3d ${A}`})}var E=`abcdefghijklmnopqrstuvwxyzáéíóú`;function D(e,n=520){let[r,i]=(0,S.useState)(e),a=t();return(0,S.useEffect)(()=>{if(a){i(e);return}let t=0,r=performance.now(),o=a=>{let s=Math.min((a-r)/n,1),c=Math.floor(s*e.length),l=e.slice(0,c);for(let t=c;t<e.length;t++)l+=e[t]===` `?` `:E[Math.floor(Math.random()*31)];i(l),s<1&&(t=requestAnimationFrame(o))};return t=requestAnimationFrame(o),()=>cancelAnimationFrame(t)},[e,a]),r}function O({text:e,ms:t,className:n,as:r=`span`}){let i=D(e,t);return(0,C.jsx)(r,{className:n,"aria-label":e,children:(0,C.jsx)(`span`,{"aria-hidden":`true`,children:i})})}export{O as n,T as t};