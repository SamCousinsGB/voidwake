import * as THREE from 'three';
import type { BattleEffect } from './engine';
export function createBattleEffects(scene:THREE.Scene){
 const meshes=new Map<number,THREE.Mesh>();
 const vertexShader='varying vec2 uvPos;void main(){uvPos=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
 const fragmentShader=`varying vec2 uvPos;uniform float progress;uniform float singularity;uniform vec3 color;
 void main(){vec2 p=uvPos*2.-1.;float r=length(p),fade=1.-smoothstep(.7,1.,progress);vec3 col=color;float alpha=0.;
 if(singularity>.5){float spin=progress*9.;float a=atan(p.y,p.x);float horizon=.21*min(1.,progress*8.);float rim=exp(-pow((r-horizon)*80.,2.));float disk=exp(-pow((length(p*vec2(1.,2.6))-.45)*13.,2.));float spiral=pow(max(0.,sin(a*4.+r*25.-spin)),5.)*exp(-r*3.)*.5;col=color*(rim*2.+disk+spiral)+vec3(1.)*rim;alpha=(rim+disk*.65+spiral)*fade;if(r<horizon){col=vec3(.001,.001,.007);alpha=fade;}alpha*=1.-smoothstep(.82,1.,r);}
 else{float wave=progress*.94;float ring=exp(-pow((r-wave)*32.,2.));float fire=exp(-r*r*12./max(.08,progress))*pow(1.-progress,2.)*1.8;col=mix(color,vec3(1.,.96,.84),min(1.,fire));alpha=(ring*(1.-progress)+fire)*fade;}
 gl_FragColor=vec4(col,clamp(alpha,0.,1.));}`;
 return {update(effects:BattleEffect[]){
  for(const effect of effects){let mesh=meshes.get(effect.id);if(!mesh){const mat=new THREE.ShaderMaterial({uniforms:{progress:{value:0},singularity:{value:effect.kind==='singularity'?1:0},color:{value:new THREE.Color(effect.color)}},vertexShader,fragmentShader,transparent:true,depthWrite:false,depthTest:false,blending:THREE.NormalBlending});mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),mat);mesh.renderOrder=20;scene.add(mesh);meshes.set(effect.id,mesh);}mesh.position.set(effect.x,effect.y,100);mesh.scale.setScalar(effect.radius);(mesh.material as THREE.ShaderMaterial).uniforms.progress.value=1-effect.life/effect.maxLife;}
  for(const [id,mesh] of meshes)if(!effects.some(e=>e.id===id)){scene.remove(mesh);mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();meshes.delete(id);}
 }};
}
