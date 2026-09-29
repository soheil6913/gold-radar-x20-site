import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const canvas=document.querySelector("#webgl");
const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0x020304,0.018);

const camera=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.1,100);
camera.position.set(0,0,10);

const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;

const group=new THREE.Group();
scene.add(group);

// Star/particle field
const count=1800;
const positions=new Float32Array(count*3);
const sizes=new Float32Array(count);
for(let i=0;i<count;i++){
 const r=3+Math.random()*16, a=Math.random()*Math.PI*2, y=(Math.random()-.5)*12;
 positions[i*3]=Math.cos(a)*r;
 positions[i*3+1]=y;
 positions[i*3+2]=Math.sin(a)*r-4;
 sizes[i]=.5+Math.random()*1.8;
}
const geo=new THREE.BufferGeometry();
geo.setAttribute("position",new THREE.BufferAttribute(positions,3));
geo.setAttribute("size",new THREE.BufferAttribute(sizes,1));
const mat=new THREE.PointsMaterial({color:0xe9b949,size:.035,transparent:true,opacity:.72,depthWrite:false});
const particles=new THREE.Points(geo,mat);
group.add(particles);

// Radar rings
for(let i=0;i<4;i++){
 const g=new THREE.TorusGeometry(2.05+i*.48,.008,8,160);
 const m=new THREE.MeshBasicMaterial({color:0xe9b949,transparent:true,opacity:.16-i*.025});
 const ring=new THREE.Mesh(g,m);
 ring.rotation.x=Math.PI/2;
 ring.rotation.z=i*.28;
 group.add(ring);
}

// Center core
const core=new THREE.Mesh(
 new THREE.IcosahedronGeometry(1.35,3),
 new THREE.MeshBasicMaterial({color:0xe9b949,wireframe:true,transparent:true,opacity:.2})
);
group.add(core);

const inner=new THREE.Mesh(
 new THREE.SphereGeometry(.62,32,32),
 new THREE.MeshBasicMaterial({color:0xe9b949,transparent:true,opacity:.13})
);
group.add(inner);

// Sweep beam
const sweepGeo=new THREE.PlaneGeometry(4.5,.018);
const sweepMat=new THREE.MeshBasicMaterial({color:0xffdf7e,transparent:true,opacity:.65,side:THREE.DoubleSide});
const sweep=new THREE.Mesh(sweepGeo,sweepMat);
sweep.position.set(2.25,0,0);
group.add(sweep);

let mx=0,my=0,tx=0,ty=0;
addEventListener("pointermove",e=>{tx=(e.clientX/innerWidth-.5)*1.2;ty=(e.clientY/innerHeight-.5)*.8});
addEventListener("touchmove",e=>{if(e.touches[0]){tx=(e.touches[0].clientX/innerWidth-.5)*1.2;ty=(e.touches[0].clientY/innerHeight-.5)*.8}},{passive:true});
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,2))});

const clock=new THREE.Clock();
function animate(){
 requestAnimationFrame(animate);
 const t=clock.getElapsedTime();
 mx+=(tx-mx)*.025; my+=(ty-my)*.025;
 group.rotation.y=t*.055+mx;
 group.rotation.x=my;
 particles.rotation.z=t*.012;
 core.rotation.x=t*.18;core.rotation.y=t*.3;
 inner.scale.setScalar(1+.08*Math.sin(t*2));
 sweep.rotation.z=-t*1.7;
 camera.position.x=mx*.7;
 camera.position.y=-my*.45;
 camera.lookAt(0,0,0);
 renderer.render(scene,camera);
}
animate();
