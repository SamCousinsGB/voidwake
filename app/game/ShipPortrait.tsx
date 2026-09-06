'use client';
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { makeShip,disposeModel } from './ShipModels';
import { SHIPS,type ShipClass } from './world';
const portraits=new Map<string,string>();
let renderer:THREE.WebGLRenderer|null=null;
let releaseTimer:ReturnType<typeof setTimeout>|undefined;
export default function ShipPortrait({ship}:{ship:ShipClass}){
 const [src,setSrc]=useState(portraits.get(ship));
 useEffect(()=>{if(portraits.has(ship)){setSrc(portraits.get(ship));return;}let model:THREE.Group|undefined;
  try{clearTimeout(releaseTimer);renderer??=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setSize(360,220);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.5;const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-74,74,46,-46,.1,1000);camera.position.set(0,-75,190);camera.lookAt(0,0,0);scene.add(new THREE.AmbientLight('#b8d4ed',2));const light=new THREE.DirectionalLight('#fff2d4',4);light.position.set(-90,60,150);scene.add(light);const rim=new THREE.DirectionalLight('#79c5ff',2);rim.position.set(60,-60,50);scene.add(rim);model=makeShip(ship);model.scale.setScalar(.86);model.rotation.z=-.42;scene.add(model);renderer.render(scene,camera);const url=renderer.domElement.toDataURL('image/png');portraits.set(ship,url);setSrc(url);releaseTimer=setTimeout(()=>{renderer?.dispose();renderer=null;},1000);
  }catch{/* The name and ship statistics remain available if WebGL is unavailable. */}finally{if(model)disposeModel(model);}
 },[ship]);
 return src?<img className="ship-portrait" src={src} alt={`${SHIPS[ship].name} starship`}/>:<div className="ship-portrait portrait-fallback">{SHIPS[ship].name}</div>;
}
