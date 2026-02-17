//define buffer
const buffer = new THREE.StorageBufferAttribute( new Float32Array( size * 4 ) , 4 );

//assign to shader 
storage( buffer, 'vec4', buffer.count )  

//readback from gpu
const dataFromGPU = new Float32Array( await renderer.getArrayBufferAsync( buffer ) );





meshoptimizer_module.js:667 Cannot enlarge memory, asked to go up to 
2149031936 bytes, but the limit is 
2147483648 bytes!