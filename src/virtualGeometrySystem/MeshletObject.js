import * as THREE from "three";
import { StorageBufferAttribute, IndirectStorageBufferAttribute } from "three/webgpu";
import { wgslFn, varyingProperty, cameraProjectionMatrix, cameraViewMatrix, modelNormalMatrix, 
attribute, texture, vertexIndex, instanceIndex, storage, struct, array, uniform, uint, uniformArray, vec4, depthPass } from "three/tsl";

import { visibilityManager_GPU, initDrawBuffer } from './shaders/VisibilityManager_gpu.js';
import VisibilityManager_CPU from './VisibilityManager_cpu.js';
import Meshlet from './Meshlet.js';


class MeshletObject {

	constructor( meshlets, count ) {

		this.meshlets = meshlets;
		this.count = count;
		this.meshletCount = meshlets.length;
		this.maxLod = meshlets[ meshlets.length - 1 ].lod;

		this.meshletWorldMatrices = [];
		this.meshInstanceWorldMatrix = [];

		this.verticesPerMeshlet = Meshlet.max_triangles * 3;
		this.precisionScale = 1;

		this.cameraViewProjectionMatrix = new THREE.Matrix4();
		this.frustumArray = array( new Array( 6 ).fill().map( () => uniform( new THREE.Vector4() ) ) );
		this.frustum = new THREE.Frustum();

		this.vec2 = new THREE.Vector2();
		this.vec3 = new THREE.Vector3();
		this.vec4 = new THREE.Vector4();

        this.initialUpdate = 0;//true;
        this.visibility_cpu = new VisibilityManager_CPU();
		this.gpu = 1;

	}

	async init( params ) {

		let meshletsPerLOD = [];

		for ( let meshlet of this.meshlets ) {

			if ( ! meshletsPerLOD[ meshlet.lod ] )
				meshletsPerLOD[ meshlet.lod ] = [];
				meshletsPerLOD[ meshlet.lod ].push( meshlet );

		}

		for ( let meshlets of meshletsPerLOD ) {

			if ( meshlets.length === 1 ) {

				this.rootMeshlet = meshlets[ 0 ];
				break;

			}

		}

		let nonIndexedMeshlets = [];

		for ( let meshlet of this.meshlets ) {

			nonIndexedMeshlets.push( this.meshletToNonIndexedVertices( meshlet ) );

		}


		this.meshletsProcessed = new Map();
		let currentVertexOffset = 0;
		for ( let nonIndexedMeshlet of nonIndexedMeshlets ) {

			this.meshletsProcessed.set( nonIndexedMeshlet.meshlet, {
				meshletId: nonIndexedMeshlet.meshlet.id,
				vertexOffset: currentVertexOffset,
				vertexCount: nonIndexedMeshlet.vertices.length
			} );
			currentVertexOffset += nonIndexedMeshlet.vertices.length;

		}



		console.log(this.meshlets.length);
		console.log(this.meshlets);
		//console.log(this.maxLod);


		this.isWireframe = false;




		const drawBufferStruct = struct( {
			vertexCount: 'uint',
			instanceCount: { type: 'uint', atomic: true },
			firstVertex: 'uint',
			firstInstance: 'uint',
			...( this.isWireframe && { offset: 'uint' } )
		}, 'DrawBuffer' );

		const meshletInfoStruct = struct( {
			cone_apex: 'vec4',
			cone_axis: 'vec4',
			cone_cutoff: 'float',
			cBoundingSphereHigh: 'vec4',
			cBoundingSphereLow: 'vec4',
			pBoundingSphereHigh: 'vec4',
			pBoundingSphereLow: 'vec4',
			errorHigh: 'vec4',
			errorLow: 'vec4',
			lod: 'vec4',
			bboxMin: 'vec4',
			bboxMax: 'vec4',
		}, 'MeshletInfo' );

		const objectInfoStruct = struct( {
			meshID: 'uint',
			meshletID: 'uint',
			padding: 'uvec2',
		}, 'ObjectInfo' );

		const meshMatrixInfoStruct = struct( {
			modelWorldMatrix: 'mat4',
		}, 'MeshMatrixInfo' );

		const interleavedStruct = struct( {
			position: 'vec3',
			normal: 'vec3',
			uv: 'vec2',
		}, 'Interleaved' );


        //console.log( Object.keys( meshletInfoStruct ) );
        
		

		this.drawBufferMembersCount = this.isWireframe ? 5 : 4;

		const size = this.count;
		this.meshletInfoStructSize = 12 * 4;
		this.workgroupSize = Math.ceil( Math.cbrt( this.meshletCount ) / 4 );

		const meshletInfo = this.getMeshletsInfo(this.meshlets);
		this.interleavedBuffer  = this.createVerticesBuffer(nonIndexedMeshlets);

		this.drawBuffer = new IndirectStorageBufferAttribute( new Uint32Array( this.drawBufferMembersCount ), this.drawBufferMembersCount );
		this.meshletInfoBuffer = new StorageBufferAttribute( meshletInfo, this.meshletInfoStructSize );
		this.objectInfoBuffer = new StorageBufferAttribute( new Uint32Array( size * this.meshletCount * 4 ), 4 );
		this.instanceInfoBuffer = new StorageBufferAttribute( new Uint32Array( size * this.meshletCount ), 1 );
		this.meshWorldMatrixBuffer = new StorageBufferAttribute( new Float32Array( size * 16 ) , 16 );

        console.log(this.interleavedBuffer);

		//this.frustumBuffer = new THREE.StorageBufferAttribute( new Float32Array( 6 * 4 ) , 4 );

		//this.frustumArray.values = [ vec4(1,0,0,0), vec4(0,2,0,0), vec4(0,0,3,0), vec4(0,0,0,0), vec4(0,0,0,0), vec4(0,0,0,0) ];

		console.log(this.frustumArray);

		this.computeShader = visibilityManager_GPU( {
			
			depthTexture: texture( params.threejs.renderTarget.depthTexture ),
			cameraProjectionMatrix: uniform( new THREE.Matrix4() ),
			cameraProjectionMatrixInverse: uniform( new THREE.Matrix4() ),
			cameraViewMatrix: uniform( new THREE.Matrix4() ),
			cameraPosition: uniform( new THREE.Vector3() ),
			cameraNearFarFov: uniform( new THREE.Vector3() ),
			frustumArray: this.frustumArray,
			precisionScale: uniform( this.precisionScale ),
			screenSize: uniform( this.vec2.set( 0, 0 ) ),
			maxLod: uniform( this.maxLod ),
            maxTriangles: uniform( Meshlet.max_triangles ),
			
			instanceInfo: storage( this.instanceInfoBuffer, 'uint', this.instanceInfoBuffer.count ),
			drawBuffer: storage( this.drawBuffer, drawBufferStruct, this.drawBuffer.count ),
			objectInfo: storage( this.objectInfoBuffer, objectInfoStruct, this.objectInfoBuffer.count ).toReadOnly(),
			meshletInfo: storage( this.meshletInfoBuffer, meshletInfoStruct, this.meshletInfoBuffer.count ).toReadOnly(),
			meshWorldMatrix: storage( this.meshWorldMatrixBuffer, meshMatrixInfoStruct, this.meshWorldMatrixBuffer.count ).toReadOnly(),
			index: instanceIndex,
			wireframe: uint( this.isWireframe )
		} ).compute( size * this.meshletCount );


          
		this.initDrawBuffer = initDrawBuffer( {
			drawBuffer: storage( this.drawBuffer, drawBufferStruct, this.drawBuffer.count ),
		} ).compute( 1 );  



		const vMeshletID = varyingProperty("float", "meshletID");
		const vPosition = varyingProperty("vec3", "vPosition");
		const vNormal = varyingProperty("vec3", "vNormal");
		const vUv = varyingProperty("vec2", "vUv");
		const vColor = varyingProperty("vec4", "vColor");


		const vertexShaderParams = {
			projectionMatrix: cameraProjectionMatrix,
			cameraViewMatrix: cameraViewMatrix,
			modelNormalMatrix: modelNormalMatrix,
			gpu: this.gpu,
			meshId: attribute("meshId"),
			vertexIndex: vertexIndex,
			instanceIndex: instanceIndex,
            maxTriangles: Meshlet.max_triangles,
			instanceInfo: storage( this.instanceInfoBuffer, 'uint', this.instanceInfoBuffer.count ).toReadOnly(),
			objectInfo: storage( this.objectInfoBuffer, objectInfoStruct, this.objectInfoBuffer.count ).toReadOnly(),
			meshWorldMatrix: storage( this.meshWorldMatrixBuffer, meshMatrixInfoStruct, this.meshWorldMatrixBuffer.count ).toReadOnly(),
			interleavedBuffer: storage( this.interleavedBuffer, interleavedStruct, this.interleavedBuffer.count ).toReadOnly(),
		}

		const fragmentShaderParams = {
			vMeshletID: vMeshletID,
			vPosition: vPosition,
			vNormal: vNormal,
 			meshletInfo: storage( this.meshletInfoBuffer, meshletInfoStruct, this.meshletInfoBuffer.count ).toReadOnly(),
			vUv: vUv,
			vColor: vColor,
		}


		const structName = this.count === 1 ? 'MeshMatrixInfo' : 'array<MeshMatrixInfo>';
		const modelWorldMatrix = this.count === 1 ? 'meshWorldMatrix.modelWorldMatrix' : 'meshWorldMatrix[ object.meshID ].modelWorldMatrix';

		const vertexShader = wgslFn(`
			fn main_vertex(
				projectionMatrix: mat4x4<f32>,
				cameraViewMatrix: mat4x4<f32>,
				modelNormalMatrix: mat3x3<f32>,
				gpu: f32,
				meshId: u32,
				vertexIndex: u32,
				instanceIndex: u32,
				maxTriangles: f32,
				instanceInfo: ptr<storage, array<u32>, read>,
				objectInfo: ptr<storage, array<ObjectInfo>, read>,
				meshWorldMatrix: ptr<storage, ${structName}, read>,
				interleavedBuffer: ptr<storage, array<Interleaved>, read>,
			) -> vec4<f32> {

				var meshID = select( meshId, instanceInfo[ instanceIndex ], u32(gpu) == 1u );
				var object = objectInfo[ meshID ];
				var modelWorldMatrix = ${modelWorldMatrix};

				var vertexId = vertexIndex + object.meshletID * 3u * u32(maxTriangles);

				var position = interleavedBuffer[ vertexId ].position;
				var normal = interleavedBuffer[ vertexId ].normal;
				var uv = interleavedBuffer[ vertexId ].uv;


				var outPosition = projectionMatrix * cameraViewMatrix * modelWorldMatrix * vec4f( position, 1 );


				varyings.meshletID = f32( object.meshletID );
                
				varyings.vNormal = normalize( modelNormalMatrix * normal );
				varyings.vColor = vec4<f32>( 1, 0, 0, 1 );
				varyings.vUv = uv;

				return outPosition;
			}

		`, [ vMeshletID, vPosition, vNormal, vUv, vColor ]);


		const fragmentShader = wgslFn(`
			fn main_fragment(
				vMeshletID: f32,
				vPosition: vec3<f32>,
				vNormal: vec3<f32>,
				meshletInfo: ptr<storage, array<MeshletInfo>, read>,
				vUv: vec2<f32>,
				vColor: vec4<f32>
			) -> vec4<f32> {

				var color = hashColor(u32(vMeshletID));

				//color = vColor.rgb;

				return vec4<f32>(color, 1.0);
				//return vec4<f32>(0, 1, 0, 1);
				//return vec4<f32>(vPosition, 1);
				//return vec4<f32>(vNormal, 1);
				//return vec4<f32>(vUv, 0, 1);
			}

			fn hashColor(seed: u32) -> vec3<f32> {

				var x = seed;
				x = ((x >> 16u) ^ x) * 0x45d9f3bu;
				x = ((x >> 16u) ^ x) * 0x45d9f3bu;
				x =  (x >> 16u) ^ x;

				var color = vec3<f32>(
					f32((x & 0xFF0000u) >> 16u) / 255.0,
					f32((x & 0x00FF00u) >> 8u) / 255.0,
					f32( x & 0x0000FFu) / 255.0
				);

				if (color.x == 0.0 && color.y == 0.0 && color.z == 0.0) {
					return vec3<f32>(0, 0.5, 0.5);
				}

				color = normalize(color * color * color) * 0.5;

				return color;
			}

		`);


		this.instancedGeometry = new THREE.InstancedBufferGeometry();
		this.instancedGeometry.instanceCount = 1;   //initial value
		//this.positionAttribute = new THREE.InstancedBufferAttribute(new Float32Array( this.verticesPerMeshlet * 3 ), 3); //3 times because nonIndexed geometry
		this.positionAttribute = new THREE.BufferAttribute(new Float32Array( 3 ), 1 );
		this.instancedGeometry.setAttribute( "position", this.positionAttribute);
		this.instancedGeometry.setAttribute( "meshId", new THREE.InstancedBufferAttribute( new Uint32Array( 0 ), 1 )); 


		if ( this.gpu ) this.instancedGeometry.setIndirect( this.drawBuffer );



		const material = new THREE.MeshBasicNodeMaterial();
		material.vertexNode = vertexShader(vertexShaderParams);
		material.fragmentNode = fragmentShader(fragmentShaderParams);
		material.colorSpace = THREE.SRGBColorSpace;
		//material.transparent = true;
		material.wireframe = this.isWireframe;


		

		this.mesh = new THREE.Mesh(this.instancedGeometry, material);
		this.mesh.frustumCulled = false;

		console.log( this.mesh );


		this.mesh.onBeforeRender = ( renderer, scene, camera ) => {

			this.cameraFrustum( camera );

			this.computeShader.computeNode.parameters.cameraProjectionMatrix.value = camera.projectionMatrix;
			this.computeShader.computeNode.parameters.cameraProjectionMatrixInverse.value = camera.projectionMatrixInverse;
			this.computeShader.computeNode.parameters.cameraPosition.value = camera.position;
			this.computeShader.computeNode.parameters.cameraNearFarFov.value = this.vec3.set( camera.near, camera.far, camera.fov );
			
			this.computeShader.computeNode.parameters.cameraViewMatrix.value = camera.matrixWorldInverse;
			this.computeShader.computeNode.parameters.screenSize.value = this.vec2.set( renderer.domElement.width, renderer.domElement.height );
	
			renderer.compute( this.initDrawBuffer );
			renderer.compute( this.computeShader );
	
			if ( ! this.gpu ) this.render( renderer, camera );
	
		//	this.instancedGeometry.instanceCount = new Uint32Array( await renderer.getArrayBufferAsync( this.drawBuffer ) )[ 1 ];	

		}

	}


	cameraFrustum( camera ) {

		camera.updateProjectionMatrix();
		this.cameraViewProjectionMatrix.multiplyMatrices( camera.projectionMatrix, camera.matrixWorldInverse );
		this.frustum.setFromProjectionMatrix( this.cameraViewProjectionMatrix );

		this.frustum.planes.forEach( ( plane, index ) => 

			this.frustumArray.values[ index ].value.set( plane.normal.x, plane.normal.y, plane.normal.z, plane.constant )

		);

	}

/*
	async update( renderer, camera ) {
	
		this.cameraFrustum( camera );

		this.computeShader.computeNode.parameters.cameraProjectionMatrix.value = camera.projectionMatrix;
		this.computeShader.computeNode.parameters.cameraProjectionMatrixInverse.value = camera.projectionMatrixInverse;
		this.computeShader.computeNode.parameters.cameraPosition.value = camera.position;
		this.computeShader.computeNode.parameters.cameraNearFarFov.value = this.vec3.set( camera.near, camera.far, camera.fov );
		
		this.computeShader.computeNode.parameters.cameraViewMatrix.value = camera.matrixWorldInverse;
		this.computeShader.computeNode.parameters.screenSize.value = this.vec2.set( renderer.domElement.width, renderer.domElement.height );

		renderer.computeAsync( this.initDrawBuffer );
		renderer.computeAsync( this.computeShader, [ this.workgroupSize, this.workgroupSize, this.workgroupSize ] );

		if ( ! this.gpu ) this.render( renderer, camera );

		this.instancedGeometry.instanceCount = new Uint32Array( await renderer.getArrayBufferAsync( this.drawBuffer ) )[ 1 ];

	}
*/

	//---------------------------------------------------------------------------------------------------

	render( renderer, camera ) {

		camera.updateMatrixWorld();
		const screenWidth = renderer.domElement.width;
		const screenHeight = renderer.domElement.height;
		const cameraViewMatrix = camera.matrixWorldInverse;

		let i = 0, j = 0;

		for ( let instance of this.meshletWorldMatrices ) {

			const { meshlet, meshletMatrix } = instance;

			const isVisible = this.visibility_cpu.isMeshletVisible( meshlet, meshletMatrix, cameraViewMatrix, screenWidth, screenHeight );

			if ( isVisible ) {

				this.localPositionAttribute.array[ i ] = j;

				i++;
			}

			j++;
		}

		this.localPositionAttribute.needsUpdate = true;
		this.instancedGeometry.instanceCount = i;
	}



    splitValue( value, scale ) {
        const scaledValue = value * scale;
        const high = Math.fround( scaledValue );
        const low = scaledValue - high;
    
        return { high, low };
    }
    

    preprocessMeshletData( meshlet, scale ) {

        const splitCenter = meshlet.boundingVolume.center.toArray().map(value => this.splitValue( value, scale ));
        const splitRadius = this.splitValue( meshlet.boundingVolume.radius, scale );
    
        const splitParentCenter = meshlet.parentBoundingVolume.center.toArray().map(value => this.splitValue( value, scale ));
        const splitParentRadius = this.splitValue( meshlet.boundingVolume.radius, scale );
    
        const splitClusterError = this.splitValue( meshlet.clusterError, scale );
        const splitParentError = this.splitValue( meshlet.parentError, scale );
    
        if (splitParentError.high === Infinity) {

            splitParentError.high = 0xFFFFFFFF;
            splitParentError.low = 0;

        }
    
        return {
            splitCenter,
            splitRadius,
            splitParentCenter,
            splitParentRadius,
            splitClusterError,
            splitParentError,
        };
    }
    




    meshletToNonIndexedVertices( meshlet ) {

        const geometry = new THREE.BufferGeometry();
        const interleavedBuffer = new THREE.InterleavedBuffer( meshlet.vertices, 8 );
    
        geometry.setAttribute( 'position', new THREE.InterleavedBufferAttribute( interleavedBuffer, 3, 0 ) );
        geometry.setAttribute( 'normal', new THREE.InterleavedBufferAttribute( interleavedBuffer, 3, 3 ) );
        geometry.setAttribute( 'uv', new THREE.InterleavedBufferAttribute( interleavedBuffer, 2, 6 ) );
        geometry.setIndex(new THREE.Uint32BufferAttribute( meshlet.indices, 1 ));
    
        const nonIndexed = geometry.toNonIndexed();

        geometry.dispose();
    
        const positions = new Float32Array( this.verticesPerMeshlet * 3 );
        const normals = new Float32Array( this.verticesPerMeshlet * 3 );
        const uvs = new Float32Array( this.verticesPerMeshlet * 2 );
    
        positions.set( nonIndexed.getAttribute('position').array, 0 );
        normals.set( nonIndexed.getAttribute('normal').array, 0 );
        uvs.set( nonIndexed.getAttribute('uv').array, 0 );


        const interleaved = new Float32Array( this.verticesPerMeshlet * 12 );
        let interleavedIndex = 0;

        for (let i = 0; i < this.verticesPerMeshlet; i++) {

            interleaved[interleavedIndex++] = positions[i * 3 + 0];
            interleaved[interleavedIndex++] = positions[i * 3 + 1];
            interleaved[interleavedIndex++] = positions[i * 3 + 2];
            interleaved[interleavedIndex++] = 0.0;
    
            interleaved[interleavedIndex++] = normals[i * 3 + 0];
            interleaved[interleavedIndex++] = normals[i * 3 + 1];
            interleaved[interleavedIndex++] = normals[i * 3 + 2];
            interleaved[interleavedIndex++] = 0.0;

            interleaved[interleavedIndex++] = uvs[i * 2 + 0];
            interleaved[interleavedIndex++] = uvs[i * 2 + 1];
            interleaved[interleavedIndex++] = 0.0;
            interleaved[interleavedIndex++] = 0.0;

        }


        return {
            meshlet,
            vertices: positions,
            normals: normals,
            uvs: uvs,
            interleaved: interleaved
        };

    }


    createVerticesBuffer( meshlets ) {

        const vertexCount = meshlets.length * this.verticesPerMeshlet;
        const interleaved = new Float32Array( vertexCount * 12 );

        let interleavedIndex = 0;

        for ( let meshlet of meshlets ) {

            interleaved.set( meshlet.interleaved, interleavedIndex );

            interleavedIndex += meshlet.interleaved.length;

        }

        const interleavedBuffer = new THREE.StorageBufferAttribute( interleaved, 12 );

        return interleavedBuffer;
    }


    getMeshletsInfo( meshlets ) {

        const meshletCount = meshlets.length;
        const countPerMeshlet = this.meshletInfoStructSize;
      
        const meshletInfoArray = new Float32Array( meshletCount * countPerMeshlet );
      

        for ( let i = 0; i < meshletCount; i++ ) {

            const meshlet = meshlets[i];
            const offset = i * countPerMeshlet;
            const scale = this.precisionScale;



            const {
                splitCenter,
                splitRadius,
                splitParentCenter,
                splitParentRadius,
                splitClusterError,
                splitParentError,
            } = this.preprocessMeshletData( meshlet, scale );


            meshletInfoArray.set( [
                ...meshlet.coneBounds.cone_apex.toArray(), 0,
                ...meshlet.coneBounds.cone_axis.toArray(), 0,
                meshlet.coneBounds.cone_cutoff, 0, 0, 0,
                splitCenter[0].high, splitCenter[1].high, splitCenter[2].high, splitRadius.high,
                splitCenter[0].low, splitCenter[1].low, splitCenter[2].low, splitRadius.low,
                splitParentCenter[0].high, splitParentCenter[1].high, splitParentCenter[2].high, splitParentRadius.high,
                splitParentCenter[0].low, splitParentCenter[1].low, splitParentCenter[2].low, splitParentRadius.low,
                splitClusterError.high, splitParentError.high, 0, 0,
                splitClusterError.low, splitParentError.low, 0, 0,
                meshlet.lod, 0, 0, 0,
                ...meshlet.bounds.min.toArray(), 0,
                ...meshlet.bounds.max.toArray(), 0
            ], offset );



            
        }

        return meshletInfoArray;
    }


    addMeshAtPosition( position ) {

        const tempMesh = new THREE.Object3D();
        tempMesh.position.copy( position );
        tempMesh.updateMatrixWorld();

        this.meshInstanceWorldMatrix.push( tempMesh.matrixWorld );

    }


    async addMeshletAtPosition(){

        const matrixCount = this.meshInstanceWorldMatrix.length;
        const meshletCount = this.meshlets.length;
        const instanceCount = meshletCount * matrixCount;
 
        this.objectInfo = new Uint32Array( instanceCount * 4 );


        for ( let i = 0; i < matrixCount; i++ ) {

            this.meshWorldMatrixBuffer.array.set( this.meshInstanceWorldMatrix[i].elements, i * 16 );

        }
        
        this.meshWorldMatrixBuffer.set( this.meshWorldMatrixBuffer.array, 0 );

        
        let index = 0;

        for ( let meshID = 0; meshID < this.meshInstanceWorldMatrix.length; meshID++ ) {
            for ( let meshletID = 0; meshletID < this.meshlets.length; meshletID++ ) {

                this.meshlets[ meshletID ].id = meshletID;

                const objectData = [ meshID, meshletID, 0, 0 ];
                this.objectInfo.set( objectData, index );
                index += 4;
            }
        }

        //console.log(this.objectInfo.length)

        this.objectInfoBuffer.array.set( this.objectInfo );
        this.objectInfoBuffer.set( this.objectInfoBuffer.array, 0 );

        this.instancedGeometry.instanceCount = instanceCount;


        //------------cpu side------------
        for ( let meshMatrix of this.meshInstanceWorldMatrix ) {
            for ( let meshlet of this.meshlets ) {

                this.meshletWorldMatrices.push( {
                    meshlet: meshlet,
                    meshletMatrix: meshMatrix
                } ); 
            }
        }

        this.localPositionAttribute = new THREE.InstancedBufferAttribute( new Uint32Array( instanceCount ), 1 );
        this.instancedGeometry.setAttribute( "meshId", this.localPositionAttribute ); 
        this.localPositionAttribute.usage = THREE.StaticDrawUsage;
        //---------------------------------

    }

}


export default MeshletObject;
