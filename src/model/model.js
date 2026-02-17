import * as THREE from "three";
import { GLTFLoader, CSS2DObject} from '../three-defs.js';
import {entity} from '../entity.js';

import { instancePerSide, instanceDistance } from './config.js';
import ModelLoader from '../virtualGeometrySystem/ModelLoader.js';
import InterleavedVertexAttribute from '../virtualGeometrySystem/InterleavedVertexAttribute.js';
import Meshletizer from '../virtualGeometrySystem/Meshletizer.js';
import MeshletObject from '../virtualGeometrySystem/MeshletObject.js';



class ModelManager extends entity.Component {

	constructor() {

		super();

	}

	async Init(params){

		this.params = params;


		this.modelLoader = new ModelLoader( params );
	//	const gltfData = await this.modelLoader.processGLTF("./resources/models/bunny.glb");
	//	const gltfData = await this.modelLoader.processGLTF("./resources/models/canyon.glb");
		const gltfData = await this.modelLoader.processGLTF("./resources/models/dragon.glb");



		const { vertices, normals, uvs, indices } = gltfData;

		const interleavedVertexAttribute = new InterleavedVertexAttribute(
			[
				new THREE.BufferAttribute( vertices, 3 ),
				new THREE.BufferAttribute( normals, 3 ),
				new THREE.BufferAttribute( uvs, 2 )
			],
			[ 3, 3, 2 ]
		).array;




		let result;
		let allMeshlets;
		let maxAttempts = 10;
		let attempt = 0;


		do {

			result = await Meshletizer.Build( interleavedVertexAttribute, indices );
			allMeshlets = result.meshletsOut;
			attempt ++;

			if ( attempt >= maxAttempts ) {

				console.warn( "Maximum number of attempts reached. The condition was not met" );
				break;

			}

		} while ( allMeshlets.length !== result.checkSum );

		result = null;

		//--------------------------------------------------------------------------------------------------------


		const offset = instancePerSide / 2 * instanceDistance;


		this.meshlets = new MeshletObject( allMeshlets, instancePerSide ** 3 );
		await this.meshlets.init( this.params );

		this.params.scene.add( this.meshlets.mesh );

		console.log(this.meshlets)
		
		this.params.otherStats.maxTriangles = 2 * this.meshlets.interleavedBuffer.count / 3 * instancePerSide ** 2;

		
/*
		for ( let x = 0; x < instancePerSide; x ++ ) {

			for ( let z = 0; z < instancePerSide; z ++ ) {

				this.meshlets.addMeshAtPosition( new THREE.Vector3( x * instanceDistance - offset, 0, z * instanceDistance - offset ) );

			}

		}
*/


for (let x = 0; x < instancePerSide; x++) {

	for (let y = 0; y < instancePerSide; y++) {

		for (let z = 0; z < instancePerSide; z++) {

			this.meshlets.addMeshAtPosition(

				new THREE.Vector3(
					x * instanceDistance - offset,
					y * instanceDistance - offset,
					z * instanceDistance - offset
				)

			);
		}
	}
}




		await this.meshlets.addMeshletAtPosition();
		
	}

	Update(_) {

		//this.meshlets.update( this.params.renderer, this.params.camera );

	}


	OnResize_(params){

		const width = params.threejs.container.clientWidth;
		const height = params.threejs.container.clientHeight; 

	}

}


export default ModelManager;



/*
		for (let x = 0; x < instancePerSide; x++) {

    		for (let y = 0; y < instancePerSide; y++) {

        		for (let z = 0; z < instancePerSide; z++) {

            		this.meshlets.addMeshAtPosition(

                		new THREE.Vector3(
                    		x * distance - offset,
                    		y * distance - offset,
                    		z * distance - offset
                		)

            		);
        		}
    		}
		}
*/