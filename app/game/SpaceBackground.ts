import * as THREE from 'three';
import { STAR_LAYERS, parallaxOffset } from './parallax.ts';

const noise = `
float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec3(1.7,9.2,4.1);a*=.5;}return v;}`;

export function createSpaceBackground(scene: THREE.Scene, pixelRatio: number) {
  const layers: { object: THREE.Object3D; depth: number }[] = [];
  const materials: THREE.ShaderMaterial[] = [];
  let seed = 749831;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  const nebulaMaterial = new THREE.ShaderMaterial({
    depthWrite: false,
    uniforms: { time: { value: 0 }, tint: { value: new THREE.Color('#367a93') } },
    vertexShader: 'varying vec2 uvPos;void main(){uvPos=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 uvPos;uniform float time;uniform vec3 tint;${noise}
void main(){
 vec2 p=(uvPos-.5)*21.;
 float warp=fbm(vec3(p*.83,2.8));
 float clouds=fbm(vec3(p*1.4+warp*2.,4.3));
 float wisps=fbm(vec3(p*3.5+clouds*3.,8.1));
 float lane=exp(-pow(p.y*.65-p.x*.29+warp*1.2-.35,2.)*1.6);
 float density=smoothstep(.29,.74,clouds)*lane;
 vec3 blue=mix(vec3(.011,.025,.048),tint*.34,density);
 vec3 violet=vec3(.11,.055,.13)*density*smoothstep(-1.,2.,p.x);
 vec3 dust=vec3(.025,.019,.038)*smoothstep(.35,.61,wisps)*lane;
 vec3 light=vec3(.11,.28,.32)*pow(density,3.)*wisps;
 gl_FragColor=vec4(max(vec3(.006,.012,.024),blue+violet+light-dust),1.);
}`,
  });
  const nebula = new THREE.Mesh(new THREE.PlaneGeometry(10500, 10500), nebulaMaterial);
  nebula.position.z = -1100;
  scene.add(nebula); layers.push({ object: nebula, depth: 0.025 }); materials.push(nebulaMaterial);

  const hazeMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec2 uvPos;void main(){uvPos=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 uvPos;uniform float time;${noise}void main(){vec2 p=(uvPos-.5)*14.;float n=fbm(vec3(p*1.8,5.));float shape=exp(-pow(p.y+p.x*.23-.9,2.)*2.);float alpha=pow(n,3.)*shape*.22;gl_FragColor=vec4(.16,.25,.30,alpha);}`,
  });
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(8500, 8500), hazeMaterial);
  haze.position.z = -800; scene.add(haze); layers.push({ object: haze, depth: 0.09 }); materials.push(hazeMaterial);

  for (const layer of STAR_LAYERS) {
    const positions = new Float32Array(layer.count * 3), colors = new Float32Array(layer.count * 3), sizes = new Float32Array(layer.count), phases = new Float32Array(layer.count);
    for (let i = 0; i < layer.count; i++) {
      positions.set([(random() - .5) * 9000, (random() - .5) * 9000, layer.z], i * 3);
      const warmth = random(); const magnitude = .55 + random() * .45;
      colors.set(warmth > .85 ? [1 * magnitude, .77 * magnitude, .55 * magnitude] : [.67 * magnitude, .85 * magnitude, 1 * magnitude], i * 3);
      sizes[i] = (.65 + random() * .65) * layer.size * pixelRatio;
      phases[i] = random() * Math.PI * 2;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('magnitude', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
      uniforms: { time: { value: 0 }, opacity: { value: layer.opacity } },
      vertexShader: 'attribute float magnitude;attribute float phase;varying vec3 vColor;varying float vPhase;void main(){vColor=color;vPhase=phase;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=magnitude;}',
      fragmentShader: 'varying vec3 vColor;varying float vPhase;uniform float time;uniform float opacity;void main(){vec2 p=gl_PointCoord-.5;float d=length(p)*2.;float disc=exp(-d*d*5.);float twinkle=.91+.09*sin(time*.7+vPhase);gl_FragColor=vec4(vColor,disc*opacity*twinkle);}',
    });
    const points = new THREE.Points(geometry, material); points.frustumCulled = false;
    scene.add(points); layers.push({ object: points, depth: layer.depth }); materials.push(material);
  }
  return {
    update(x: number, y: number, time: number) {
      for (const { object, depth } of layers) { object.position.x = parallaxOffset(x, depth); object.position.y = parallaxOffset(y, depth); }
      for (const material of materials) material.uniforms.time.value = time;
    },
    setSystem(color: string) { nebulaMaterial.uniforms.tint.value.set(color).multiplyScalar(.70); },
  };
}
