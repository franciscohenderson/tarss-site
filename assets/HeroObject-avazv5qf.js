import{r as e}from"./rolldown-runtime-hePW80VL.js";import{l as t,n,u as r}from"./index-BVa9YEAU.js";import{a as i,b as a,f as o,g as s,h as c,l,n as u,o as d,s as f,t as p,u as m,y as h}from"./three.module-Bwz1XaLg.js";var g=e(r(),1),_=t(),v=`
uniform float uTime;
uniform float uAmp;
uniform float uFreq;
uniform vec3 uPull;
vec3 hoMod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 hoMod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 hoPermute(vec4 x) { return hoMod289(((x * 34.0) + 1.0) * x); }
vec4 hoInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float hoNoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = hoMod289(i);
  vec4 p = hoPermute(hoPermute(hoPermute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = hoInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
// Dos capas de ruido: una lenta y grande que cambia la silueta, una chica que ondula la piel.
vec3 hoBlob(vec3 p) {
  vec3 d = normalize(p);
  float n = hoNoise(d * 1.2 * uFreq + vec3(0.0, uTime * 0.15, uTime * 0.08)) * 0.35 * uAmp
          + hoNoise(d * 2.5 * uFreq - vec3(uTime * 0.2, 0.0, 0.0)) * 0.1 * uAmp;
  // La superficie se estira hacia donde está el cursor.
  n += pow(max(dot(d, uPull), 0.0), 3.0) * 0.24;
  return p * (1.0 + n);
}
`;function y(){let e=new h;e.background=new i(131587);let t=(t,n,r,a,o)=>{let c=new l(new s(r,a),new m({color:new i(t).multiplyScalar(n),side:2}));c.position.set(...o),c.lookAt(0,0,0),e.add(c)};return t(16730288,16,3,10,[-7,1,1.5]),t(12720250,14,3,10,[7,-1,1]),t(16777215,6,9,1.1,[0,7,2]),t(16761572,1.2,5,5,[0,-3,8]),t(16730288,8,6,1,[0,-7,-2]),e}function b(){let e=(0,g.useRef)(null);return(0,g.useEffect)(()=>{let t=e.current;if(!t)return;let r=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches,i=window.matchMedia(`(max-width: 640px)`).matches,s=new u({antialias:!0,alpha:!0});s.setPixelRatio(Math.min(window.devicePixelRatio,2)),s.toneMapping=4,s.toneMappingExposure=1.1,t.appendChild(s.domElement);let m=new h,g=new c(32,1,.1,50);g.position.set(0,0,9.4);let _=new p(s),b=y();m.environment=_.fromScene(b,.035).texture;let x=new d;m.add(x);let S={uTime:{value:0},uAmp:{value:1},uFreq:{value:1},uPull:{value:new a}},C=new o({color:656904,metalness:1,roughness:.12,envMapIntensity:1.25,clearcoat:1,clearcoatRoughness:.05});C.onBeforeCompile=e=>{Object.assign(e.uniforms,S),e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>\n${v}`).replace(`#include <beginnormal_vertex>`,`vec3 hoT = normalize(cross(normal, abs(normal.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
           vec3 hoB = cross(normal, hoT);
           vec3 hoP = hoBlob(position);
           vec3 objectNormal = normalize(cross(hoBlob(position + hoT * 0.012) - hoP, hoBlob(position + hoB * 0.012) - hoP));`).replace(`#include <begin_vertex>`,`vec3 transformed = hoP;`),e.fragmentShader=e.fragmentShader.replace(`#include <emissivemap_fragment>`,`#include <emissivemap_fragment>
         float hoRim = pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), 3.0);
         vec3 hoRimColor = mix(vec3(1.0, 0.28, 0.69), vec3(0.72, 0.10, 0.46), smoothstep(-0.3, 0.3, normal.x));
         totalEmissiveRadiance += hoRimColor * hoRim * 1.25;`)};let w=new l(new f(1.4,i?28:48),C);x.add(w);let T=new d;T.rotation.set(.5,.2,.3),x.add(T);let E=new f(.16,16),D=new o({color:656904,metalness:1,roughness:.05,clearcoat:1,envMapIntensity:3}),O=[0,1,2].map(e=>{let t=new l(E,D);return T.add(t),{mesh:t,phase:e/3*Math.PI*2,speed:.45+e*.16}});function k(){let{clientWidth:e,clientHeight:n}=t;e&&n&&(s.setSize(e,n,!1),g.aspect=e/n,g.position.z=g.aspect<1?9.4/Math.max(g.aspect,.62):9.4,g.updateProjectionMatrix())}let A=new ResizeObserver(k);A.observe(t),k();let j={x:0,y:0},M=e=>{j.x=e.clientX/window.innerWidth*2-1,j.y=e.clientY/window.innerHeight*2-1};window.addEventListener(`pointermove`,M,{passive:!0});let N=performance.now(),P=0,F=!0,I=0,L=window.scrollY,R=new a(0,1,0);function z(){let e=(performance.now()-N)/1e3+3;S.uTime.value=e,w.rotation.y=e*.12;let t=window.scrollY;I+=(Math.min(Math.abs(t-L)/40,1.4)-I)*.1,L=t,S.uAmp.value+=(n.amp+I*.9-S.uAmp.value)*.06,S.uFreq.value+=(n.freq-S.uFreq.value)*.04,S.uPull.value.set(j.x,-j.y,.75).normalize().applyAxisAngle(R,-w.rotation.y),w.scale.y+=(n.squash-w.scale.y)*.05,n.pulse*=.9,x.scale.setScalar(1+n.pulse*.07),O.forEach(({mesh:t,phase:n,speed:r})=>{let i=n+e*r;t.position.set(Math.cos(i)*2.35,Math.sin(i)*2.35,Math.sin(e*2+i)*.5)}),x.rotation.x+=(j.y*.16-x.rotation.x)*.04,x.rotation.y+=(j.x*.28-x.rotation.y)*.04,x.position.y=Math.sin(e*.6)*.08,s.render(m,g)}function B(){F&&z(),P=requestAnimationFrame(B)}let V=new IntersectionObserver(([e])=>{F=e.isIntersecting});return V.observe(t),r?z():B(),()=>{cancelAnimationFrame(P),A.disconnect(),V.disconnect(),window.removeEventListener(`pointermove`,M),[m,b].forEach(e=>e.traverse(e=>{e.geometry?.dispose(),e.material&&[].concat(e.material).forEach(e=>e.dispose())})),m.environment?.dispose(),_.dispose(),s.dispose(),s.domElement.remove()}},[]),(0,_.jsx)(`div`,{ref:e,"aria-hidden":`true`,className:`size-full [&>canvas]:size-full`})}export{b as default};