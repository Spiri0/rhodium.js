import * as THREE from "three";
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from './meshoptimizer/meshopt_decoder.module.js';


/*
class ModelLoader {

	constructor( params ) {

		this.params = params;
		this.gltf = new GLTFLoader();

	}

	addArrayData( targetArray, sourceArray ) {

		if ( sourceArray ) {

			for ( let i = 0; i < sourceArray.length; i ++ ) {

				targetArray.push( sourceArray[ i ] );

			}

		}

	}

	async loadGLTF( path ) {

		return new Promise( ( resolve, reject ) => {

			this.gltf.setMeshoptDecoder( MeshoptDecoder );

			this.gltf.load(
				path,
				( gltf ) => {

					const model = gltf.scene;

					model.updateMatrixWorld( true );

					let positions = [];
					let normals = [];
					let uvs = [];
					let indices = [];

					model.traverse( ( node ) => {

						if ( node.isMesh ) {

							const geometry = node.geometry;

							geometry.applyMatrix4( node.matrixWorld );

							this.addArrayData( positions, geometry.attributes.position.array );
							this.addArrayData( normals, geometry.attributes.normal?.array );
							this.addArrayData( uvs, geometry.attributes.uv?.array );
							this.addArrayData( indices, geometry.index?.array );

						}

					} );

					resolve( {
						vertices: new Float32Array( positions ),
						normals: new Float32Array( normals ),
						uvs: new Float32Array( uvs ),
						indices: new Uint32Array( indices ),
					} );

				},
				undefined,
				( error ) => reject( error )
			);

		} );

	}

	async processGLTF( gltfURL ) {

		try {

			this.gltfData = await this.loadGLTF( gltfURL );

		} catch ( error ) {

			console.error( "Error loading GLTF:", error );
			return null;

		}

		return this.gltfData;

	}

}
*/



class ModelLoader {

	constructor( params ) {

		this.params = params;
		this.gltf = new GLTFLoader();

	}

	addArrayData( targetArray, sourceArray ) {

		if ( sourceArray ) {

			for ( let i = 0; i < sourceArray.length; i ++ ) {

				targetArray.push( sourceArray[ i ] );

			}

		}

	}

	convertToTriangles( geometry ) {

		if ( ! geometry.isBufferGeometry ) return;

		if ( geometry.index ) {

			const indices = geometry.index.array;
			if ( indices.length % 3 !== 0 ) {

				console.warn( 'Geometry is not a triangle mesh)' );
				const newGeometry = new THREE.Geometry().fromBufferGeometry( geometry );
				newGeometry.mergeVertices();
				newGeometry.computeFaceNormals();
				newGeometry.computeVertexNormals();

				return newGeometry.toBufferGeometry();

			}

		}

		return geometry;

	}

	async loadGLTF( path ) {

		return new Promise( ( resolve, reject ) => {

			this.gltf.setMeshoptDecoder( MeshoptDecoder );

			this.gltf.load(
				path,
				( gltf ) => {

					const model = gltf.scene;
					model.updateMatrixWorld( true );

					let positions = [];
					let normals = [];
					let uvs = [];
					let indices = [];

					model.traverse( ( node ) => {

						if ( node.isMesh ) {

							const geometry = node.geometry;

							const convertedGeometry = this.convertToTriangles( geometry );

							convertedGeometry.applyMatrix4( node.matrixWorld );

							this.addArrayData( positions, convertedGeometry.attributes.position.array );
							this.addArrayData( normals, convertedGeometry.attributes.normal?.array );
							this.addArrayData( uvs, convertedGeometry.attributes.uv?.array );
							this.addArrayData( indices, convertedGeometry.index?.array );

						}

					} );

					resolve( {
						vertices: new Float32Array( positions ),
						normals: new Float32Array( normals ),
						uvs: new Float32Array( uvs ),
						indices: new Uint32Array( indices ),
					} );

				},
				
				undefined,
				( error ) => reject( error )
			);

		} );

	}

	async processGLTF( gltfURL ) {

		try {

			this.gltfData = await this.loadGLTF( gltfURL );

		} catch ( error ) {

			console.error( "Error loading GLTF:", error );
			return null;

		}

		return this.gltfData;

	}

}




export default ModelLoader;