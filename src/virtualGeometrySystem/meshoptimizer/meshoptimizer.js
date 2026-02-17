import * as THREE from "three";
import MeshOptimizerModule from './meshoptimizer_module.js';
import Meshlet from '../Meshlet.js';
import { WASMPointer, WASMHelper } from '../utils.js';



export const attribute_size = 8;

class Meshoptimizer {

	static module;
	static isLoaded = false;
	static kMeshletMaxTriangles = 512;
	static async load() {

		if ( ! Meshoptimizer.module ) {

			Meshoptimizer.module = await MeshOptimizerModule();
			this.isLoaded = true;

		}

	}
	static buildNeighbors( meshlets, meshlet_vertices_result ) {

		const vertex_to_meshlets = [];
		for ( let i3 = 0; i3 < meshlets.length; i3 ++ ) {

			const meshlet = meshlets[ i3 ];
			const meshlet_vertices = meshlet_vertices_result.slice( meshlet.vertex_offset, meshlet.vertex_offset + meshlet.vertex_count );
			for ( let j2 = 0; j2 < meshlet_vertices.length; j2 ++ ) {

				if ( ! vertex_to_meshlets[ meshlet_vertices[ j2 ] ] ) vertex_to_meshlets[ meshlet_vertices[ j2 ] ] = { count: 0, meshlets: [] };
				vertex_to_meshlets[ meshlet_vertices[ j2 ] ].count ++;
				vertex_to_meshlets[ meshlet_vertices[ j2 ] ].meshlets.push( i3 );

			}

		}

		const neighbors = Array.from( { length: meshlets.length }, () => /* @__PURE__ */ new Set() );
		for ( const v2 of vertex_to_meshlets ) {

			const meshletArray = v2.meshlets;
			for ( let i3 = 0; i3 < meshletArray.length; i3 ++ ) {

				for ( let j2 = i3 + 1; j2 < meshletArray.length; j2 ++ ) {

					neighbors[ meshletArray[ i3 ] ].add( meshletArray[ j2 ] );
					neighbors[ meshletArray[ j2 ] ].add( meshletArray[ i3 ] );

				}

			}

		}

		return neighbors.map( ( set ) => [ ...set ] );

	}
	static meshopt_buildMeshlets( vertices, indices, max_vertices, max_triangles, cone_weight ) {

		if ( ! this.isLoaded ) throw Error( "Library not loaded" );
		const MeshOptmizer = Meshoptimizer.module;
		function rebuildMeshlets( data ) {

			let meshlets2 = [];
			for ( let i3 = 0; i3 < data.length; i3 += 4 ) {

				meshlets2.push( {
					vertex_offset: data[ i3 + 0 ],
					triangle_offset: data[ i3 + 1 ],
					vertex_count: data[ i3 + 2 ],
					triangle_count: data[ i3 + 3 ]
				} );

			}

			return meshlets2;

		}

		const max_meshlets = WASMHelper.call( MeshOptmizer, "meshopt_buildMeshletsBound", "number", indices.length, max_vertices, max_triangles );
		const meshlets = new WASMPointer( new Uint32Array( max_meshlets * 4 ), "out" );
		const meshlet_vertices = new WASMPointer( new Uint32Array( max_meshlets * max_vertices ), "out" );
		const meshlet_triangles = new WASMPointer( new Uint8Array( max_meshlets * max_triangles * 3 ), "out" );
		const meshletCount = WASMHelper.call(
			MeshOptmizer,
			"meshopt_buildMeshlets",
			"number",
			meshlets,
			meshlet_vertices,
			meshlet_triangles,
			new WASMPointer( Uint32Array.from( indices ) ),
			indices.length,
			new WASMPointer( Float32Array.from( vertices ) ),
			vertices.length / attribute_size,
			attribute_size * Float32Array.BYTES_PER_ELEMENT,
			max_vertices,
			max_triangles,
			cone_weight
		);
		const meshlets_result = rebuildMeshlets( meshlets.data ).slice( 0, meshletCount );
		const output = {
			meshlets_count: meshletCount,
			meshlets_result: meshlets_result.slice( 0, meshletCount ),
			meshlet_vertices_result: new Uint32Array( meshlet_vertices.data ),
			meshlet_triangles_result: new Uint8Array( meshlet_triangles.data )
		};
		return output;

	}
	static meshopt_computeClusterBounds( vertices, indices ) {

		if ( ! this.isLoaded ) throw Error( "Library not loaded" );
		const MeshOptmizer = Meshoptimizer.module;
		const boundsDataPtr = new WASMPointer( new Float32Array( 16 ), "out" );
		WASMHelper.call(
			MeshOptmizer,
			"meshopt_computeClusterBounds",
			"number",
			boundsDataPtr,
			new WASMPointer( Uint32Array.from( indices ) ),
			indices.length,
			new WASMPointer( Float32Array.from( vertices ) ),
			vertices.length / attribute_size,
			attribute_size * Float32Array.BYTES_PER_ELEMENT
		);
		const boundsData = boundsDataPtr.data;
		return {
			// /* bounding sphere, useful for frustum and occlusion culling */
			center: new THREE.Vector3( boundsData[ 0 ], boundsData[ 1 ], boundsData[ 2 ] ),
			// center: Vector3; // float center[3];
			radius: boundsData[ 3 ],
			// float radius;
			// /* normal cone, useful for backface culling */
			cone_apex: new THREE.Vector3( boundsData[ 4 ], boundsData[ 5 ], boundsData[ 6 ] ),
			// float cone_apex[3];
			cone_axis: new THREE.Vector3( boundsData[ 7 ], boundsData[ 8 ], boundsData[ 9 ] ),
			// float cone_axis[3];
			cone_cutoff: boundsData[ 10 ]
			// float cone_cutoff; /* = cos(angle/2) */
			// // /* normal cone axis and cutoff, stored in 8-bit SNORM format; decode using x/127.0 */
			// cone_axis_s8: new Vector3(boundsData[11], boundsData[12], boundsData[13]), // signed char cone_axis_s8[3];
			// cone_cutoff_s8: new Vector3(boundsData[14], boundsData[15], boundsData[16]) // signed char cone_cutoff_s8;
		};

	}
	static clean( meshlet ) {

		const MeshOptmizer = Meshoptimizer.module;
		const remap = new WASMPointer( new Uint32Array( meshlet.indices.length * attribute_size ), "out" );
		const indices = new WASMPointer( new Uint32Array( meshlet.indices ), "in" );
		const vertices = new WASMPointer( new Float32Array( meshlet.vertices ), "in" );
		const vertex_count = WASMHelper.call(
			MeshOptmizer,
			"meshopt_generateVertexRemap",
			"number",
			remap,
			indices,
			meshlet.indices.length,
			vertices,
			meshlet.vertices.length / attribute_size,
			attribute_size * Float32Array.BYTES_PER_ELEMENT
		);
		const indices_remapped = new WASMPointer( new Uint32Array( meshlet.indices.length ), "out" );
		WASMHelper.call(
			MeshOptmizer,
			"meshopt_remapIndexBuffer",
			"number",
			indices_remapped,
			indices,
			meshlet.indices.length,
			remap
		);
		const vertices_remapped = new WASMPointer( new Float32Array( vertex_count * attribute_size ), "out" );
		WASMHelper.call(
			MeshOptmizer,
			"meshopt_remapVertexBuffer",
			"number",
			vertices_remapped,
			vertices,
			meshlet.vertices.length / attribute_size,
			attribute_size * Float32Array.BYTES_PER_ELEMENT,
			remap
		);
		return new Meshlet( new Float32Array( vertices_remapped.data ), new Uint32Array( indices_remapped.data ) );

	}
	static meshopt_simplify( meshlet, target_count, target_error = 1 ) {

		const MeshOptmizer = Meshoptimizer.module;
		const destination = new WASMPointer( new Uint32Array( meshlet.indices.length ), "out" );
		const result_error = new WASMPointer( new Float32Array( 1 ), "out" );
		const meshopt_SimplifyLockBorder = 1 << 0;
		const meshopt_SimplifySparse = 1 << 1;
		const meshopt_SimplifyErrorAbsolute = 1 << 2;
		const options = meshopt_SimplifyLockBorder | meshopt_SimplifySparse;

		const simplified_index_count = WASMHelper.call(
			MeshOptmizer,
			"meshopt_simplify",
			"number",
			destination,
			new WASMPointer( new Uint32Array( meshlet.indices ) ),
			meshlet.indices.length,
			new WASMPointer( new Float32Array( meshlet.vertices ) ),
			meshlet.vertices.length / attribute_size,
			attribute_size * Float32Array.BYTES_PER_ELEMENT,
			target_count,
			target_error,
			options,
			result_error
		);

		const destination_resized = destination.data.slice( 0, simplified_index_count );
		return {
			error: result_error.data[ 0 ],
			meshlet: new Meshlet( meshlet.vertices, destination_resized )
		};

	}
	static meshopt_simplifyWithAttributes( meshlet, vertex_lock_array, target_count, target_error = 1 ) {

		const MeshOptmizer = Meshoptimizer.module;
		const destination = new WASMPointer( new Uint32Array( meshlet.indices.length ), "out" );
		const result_error = new WASMPointer( new Float32Array( 1 ), "out" );
		const meshopt_SimplifyLockBorder = 1 << 0;
		const meshopt_SimplifySparse = 1 << 1;
		const meshopt_SimplifyErrorAbsolute = 1 << 2;
		const options = meshopt_SimplifySparse;
		const vertex_lock = vertex_lock_array === null ? null : new WASMPointer( vertex_lock_array, "in" );
		const simplified_index_count = WASMHelper.call(
			MeshOptmizer,
			"meshopt_simplifyWithAttributes",
			"number",
			destination,
			// unsigned int* destination,
			new WASMPointer( new Uint32Array( meshlet.indices ) ),
			// const unsigned int* indices,
			meshlet.indices.length,
			// size_t index_count,
			new WASMPointer( new Float32Array( meshlet.vertices ) ),
			// const float* vertex_positions,
			meshlet.vertices.length / attribute_size,
			// size_t vertex_count,
			attribute_size * Float32Array.BYTES_PER_ELEMENT,
			// size_t vertex_positions_stride,
			null,
			0,
			null,
			0,
			vertex_lock,
			target_count,
			// size_t target_index_count,
			target_error,
			// float target_error, Should be 0.01 but cant reach 128 triangles with it
			options,
			// unsigned int options, preserve borders
			result_error
			// float* result_error
		);
		const destination_resized = destination.data.slice( 0, simplified_index_count );
		return {
			error: result_error.data[ 0 ],
			meshlet: new Meshlet( meshlet.vertices, destination_resized )
		};

	}
	// ib, ib, 24, vb, 9, 12, NULL, 0, NULL, 0, lock, 3, 1e-3f, 0
	static meshopt_simplifyWithAttributesRaw( indices, a2, vertices, b2, c2, d2, e2, f2, g2, lock, target_count, target_error, options ) {

		const MeshOptmizer = Meshoptimizer.module;
		const destination = new WASMPointer( new Uint32Array( indices.length ), "out" );
		const result_error = new WASMPointer( new Float32Array( 1 ), "out" );
		const vertex_lock = new WASMPointer( lock, "in" );
		const simplified_index_count = WASMHelper.call(
			MeshOptmizer,
			"meshopt_simplifyWithAttributes",
			"number",
			destination,
			// unsigned int* destination,
			new WASMPointer( new Uint32Array( indices ) ),
			// const unsigned int* indices,
			a2,
			// size_t index_count,
			new WASMPointer( new Float32Array( vertices ) ),
			// const float* vertex_positions,
			b2,
			// size_t vertex_count,
			c2,
			d2,
			e2,
			f2,
			g2,
			vertex_lock,
			target_count,
			// size_t target_index_count,
			target_error,
			// float target_error, Should be 0.01 but cant reach 128 triangles with it
			options,
			// unsigned int options, preserve borders
			result_error
			// float* result_error
		);
		const destination_resized = destination.data.slice( 0, simplified_index_count );
		return destination_resized;

	}
	static meshopt_simplifyScale( meshlet ) {

		const MeshOptmizer = Meshoptimizer.module;
		const vertices = new WASMPointer( new Float32Array( meshlet.vertices ), "in" );
		const scale2 = WASMHelper.call(
			MeshOptmizer,
			"meshopt_simplifyScale",
			"number",
			vertices,
			meshlet.vertices.length / attribute_size,
			attribute_size * Float32Array.BYTES_PER_ELEMENT
		);
		return scale2;

	}

}



export default Meshoptimizer;