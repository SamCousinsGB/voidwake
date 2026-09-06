import type * as THREE from 'three';
/** Celestial depth is cleared before ships, preserving depth within each layer. */
export function renderFlightLayers(renderer:Pick<THREE.WebGLRenderer,'clear'|'render'|'clearDepth'>,celestial:THREE.Scene,flight:THREE.Scene,camera:THREE.Camera){
 renderer.clear();renderer.render(celestial,camera);renderer.clearDepth();renderer.render(flight,camera);
}
