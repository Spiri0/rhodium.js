import Meshoptimizer from './meshoptimizer/meshoptimizer.js';
import Meshlet from './Meshlet.js';


const attribute_size = 8;

class MeshletCreator {

	static cone_weight = 0;

	static buildMeshletsFromBuildOutput( vertices, output ) {

		let meshlets = [];
		for ( let i3 = 0; i3 < output.meshlets_count; i3 ++ ) {

			const meshlet = output.meshlets_result[ i3 ];
			let meshlet_positions = [];
			let meshlet_indices = [];
			for ( let v2 = 0; v2 < meshlet.vertex_count; ++ v2 ) {

				const o2 = attribute_size * output.meshlet_vertices_result[ meshlet.vertex_offset + v2 ];
			    const vx = vertices[ o2 + 0 ];
			    const vy = vertices[ o2 + 1 ];
			    const vz = vertices[ o2 + 2 ];
			    const nx = vertices[ o2 + 3 ];
				const ny = vertices[ o2 + 4 ];
			    const nz = vertices[ o2 + 5 ];
			    const uvx = vertices[ o2 + 6 ];
			    const uvy = vertices[ o2 + 7 ];
			    meshlet_positions.push( vx, vy, vz );
				if ( attribute_size === 8 ) {

					meshlet_positions.push( nx, ny, nz );
					meshlet_positions.push( uvx, uvy );

				}

			}

			for ( let t2 = 0; t2 < meshlet.triangle_count; ++ t2 ) {

				const o2 = meshlet.triangle_offset + 3 * t2;
			    meshlet_indices.push( output.meshlet_triangles_result[ o2 + 0 ] );
			    meshlet_indices.push( output.meshlet_triangles_result[ o2 + 1 ] );
			    meshlet_indices.push( output.meshlet_triangles_result[ o2 + 2 ] );

			}

			meshlets.push( new Meshlet( new Float32Array( meshlet_positions ), new Uint32Array( meshlet_indices ) ) );

		}

		return meshlets;

	}

	static build( vertices, indices, max_vertices, max_triangles ) {

		const cone_weight = MeshletCreator.cone_weight;
	    const output = Meshoptimizer.meshopt_buildMeshlets( vertices, indices, max_vertices, max_triangles, cone_weight );
	    const m2 = {
			meshlets_count: output.meshlets_count,
			meshlets_result: output.meshlets_result.slice( 0, output.meshlets_count ),
			meshlet_vertices_result: output.meshlet_vertices_result,
			meshlet_triangles_result: output.meshlet_triangles_result
		};
		const meshlets = MeshletCreator.buildMeshletsFromBuildOutput( vertices, m2 );
	    return meshlets;

	}

}


export default MeshletCreator;