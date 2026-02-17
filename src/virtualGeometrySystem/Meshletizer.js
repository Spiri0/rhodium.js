import Metis from './metis/metis.js';
import Meshlet from './Meshlet.js';
import MeshletMerger from './MeshletMerger.js';
import MeshletCreator from './MeshletCreator.js';
import MeshletGrouper from './MeshletGrouper.js';
import MeshletBorder from './MeshletBorder.js';
import Meshoptimizer from './meshoptimizer/meshoptimizer.js';


class Meshletizer {

	constructor(){

		this.attribute_size = 8;
		this.checkSum = 1;

	}

	static MaxLOD = 25;

	static async step( meshlets, lod, previousMeshlets ) {

		if ( meshlets.length === 1 && meshlets[ 0 ].vertices.length < Meshlet.max_triangles * 8 ) return meshlets;
		let nparts = Math.ceil( meshlets.length / 8 );
		if ( nparts > 8 ) nparts = 8;
		let grouped = [ meshlets ];
		if ( nparts > 1 ) {

			grouped = await MeshletGrouper.group( meshlets, nparts );

		}

		let splitOutputs = [];
		for ( let i3 = 0; i3 < grouped.length; i3 ++ ) {

			this.checkSum += grouped[ i3 ].length;

			const group = grouped[ i3 ];
			const mergedGroup = MeshletMerger.merge( group );
			const cleanedMergedGroup = Meshoptimizer.clean( mergedGroup );
			const tLod = ( lod + 1 ) / this.MaxLOD;
			const targetError = 0.1 * tLod + 0.01 * ( 1 - tLod );
			let target_count = cleanedMergedGroup.indices.length / 2;
			const sharedVertices = MeshletBorder.GetSharedVertices( group, this.attribute_size );
			const lockedArray = MeshletBorder.SharedVerticesToLockedArray( sharedVertices, mergedGroup, this.attribute_size );
			const simplified = Meshoptimizer.meshopt_simplifyWithAttributes( mergedGroup, lockedArray, target_count, targetError );
			const localScale = Meshoptimizer.meshopt_simplifyScale( simplified.meshlet );
			let meshSpaceError = simplified.error * localScale;
			let childrenError = 0;
			for ( let m2 of group ) {

				const previousMeshlet = previousMeshlets.get( m2.id );
				if ( ! previousMeshlet ) throw Error( "Could not find previous meshler" );
				childrenError = Math.max( childrenError, previousMeshlet.clusterError );

			}

			meshSpaceError += childrenError;
			let splits = MeshletCreator.build( simplified.meshlet.vertices, simplified.meshlet.indices, Meshlet.max_vertices, Meshlet.max_triangles );
			for ( let split of splits ) {

				split.clusterError = meshSpaceError;
				split.boundingVolume = simplified.meshlet.boundingVolume;
				split.lod = lod + 1;
				previousMeshlets.set( split.id, split );
				splitOutputs.push( split );
				split.parents.push( ...group );

			}

			for ( let m2 of group ) {

				m2.children.push( ...splits );
				const previousMeshlet = previousMeshlets.get( m2.id );
				if ( ! previousMeshlet ) throw Error( "Could not find previous meshlet" );
				previousMeshlet.parentError = meshSpaceError;
				previousMeshlet.parentBoundingVolume = simplified.meshlet.boundingVolume;

			}

		}

		return splitOutputs;

	}

	static async Build( vertices, indices ) {

		await Meshoptimizer.load();
		await Metis.load();
		this.checkSum = 1;
		const meshlets = MeshletCreator.build( vertices, indices, Meshlet.max_vertices, Meshlet.max_triangles );
		console.log( `starting with ${meshlets.length} meshlets` );
		let inputs = meshlets;
		let rootMeshlet = null;
		let previousMeshlets = new Map();
		for ( let m2 of meshlets ) previousMeshlets.set( m2.id, m2 );
		for ( let lod = 0; lod < Meshletizer.MaxLOD; lod ++ ) {

			const outputs = await this.step( inputs, lod, previousMeshlets );
			const inputTriangleArray = inputs.map( ( m2 ) => m2.indices.length / 3 );
			const outputTriangleArray = outputs.map( ( m2 ) => m2.indices.length / 3 );
			const inputTriangleCount = inputTriangleArray.reduce( ( a2, b2 ) => a2 + b2 );
			const outputTriangleCount = outputTriangleArray.reduce( ( a2, b2 ) => a2 + b2 );

			//console.log( `LOD: ${lod}: input: [meshlets: ${inputTriangleArray.length}, triangles: ${inputTriangleCount}] -> output: [meshlets: ${outputTriangleArray.length}, triangles: ${outputTriangleCount}]` );

            if ( outputTriangleCount >= inputTriangleCount ) {

				for ( const input of inputs ) {

					if ( input.indices.length / 3 > Meshlet.max_triangles ) {

						throw Error( `Output meshlet triangle count ${inputTriangleCount} >= input triangle count ${inputTriangleCount}` );

					}

				}

				break;

			}

			inputs = outputs;
			if ( outputs.length === 1 && outputs[ 0 ].indices.length / 3 <= Meshlet.max_triangles ) {

				console.log( "WE are done at lod", lod );
				rootMeshlet = outputs[ 0 ];
				rootMeshlet.lod = lod + 1;
				rootMeshlet.parentBoundingVolume = rootMeshlet.boundingVolume;
				break;

			}

		}

		if ( rootMeshlet === null ) throw Error( "Root meshlet is invalid!" );
		let meshletsOut = [];
		for ( const [ _2, meshlet ] of previousMeshlets ) {

			meshletsOut.push( meshlet );

		}

		return { meshletsOut, checkSum: this.checkSum };

	}

}


export default Meshletizer;