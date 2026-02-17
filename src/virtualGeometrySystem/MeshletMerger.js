import Meshlet from './Meshlet.js';
import { attribute_size } from './meshoptimizer/meshoptimizer.js';


class Vertex {
    constructor(position, normal, uv) {
        this.position = position;
        this.normal = normal;
        this.uv = uv;
    }
}


class MeshletMerger {

	static removeDuplicateVertices( vertexData, indexData ) {

		const vertexMap = /* @__PURE__ */ new Map();
		const uniqueVertices = [];
		const newIndices = [];
		var precisionPoints = 4;
		var precision = Math.pow( 10, precisionPoints );
		for ( let i3 = 0; i3 < indexData.length; i3 ++ ) {

			const index = indexData[ i3 ];
			const pos = vertexData.subarray( index * attribute_size, index * attribute_size + 3 );
			const norm = vertexData.subarray( index * attribute_size + 3, index * attribute_size + 6 );
			const uv = vertexData.subarray( index * attribute_size + 6, index * attribute_size + 8 );
			const vertex = new Vertex( Array.from( pos ), Array.from( norm ), Array.from( uv ) );
			const vertexKey = Math.round( vertex.position[ 0 ] * precision ) + "_" + Math.round( vertex.position[ 1 ] * precision ) + "_" + Math.round( vertex.position[ 2 ] * precision );
			if ( vertexMap.has( vertexKey ) ) {

				newIndices.push( vertexMap.get( vertexKey ) );

			} else {

				const newIndex = uniqueVertices.length;
				uniqueVertices.push( vertex );
				vertexMap.set( vertexKey, newIndex );
				newIndices.push( newIndex );

			}

		}

		const newVertexData = new Float32Array( uniqueVertices.length * attribute_size );
		uniqueVertices.forEach( ( v2, index ) => {

			newVertexData.set( [ ...v2.position, ...v2.normal, ...v2.uv ], index * attribute_size );

		} );
		return {
			vertices: newVertexData,
			indices: new Uint32Array( newIndices )
		};

	}
	static merge( meshlets ) {

		const vertices = [];
		const indices = [];
		let indexOffset = 0;
		for ( let i3 = 0; i3 < meshlets.length; ++ i3 ) {

			const indices2 = meshlets[ i3 ].indices;
			for ( let j2 = 0; j2 < indices2.length; j2 ++ ) {

				indices.push( indices2[ j2 ] + indexOffset );

			}

			indexOffset += meshlets[ i3 ].vertices.length / attribute_size;

		}

		for ( let i3 = 0; i3 < meshlets.length; ++ i3 ) vertices.push( ...meshlets[ i3 ].vertices );
		const { vertices: newVertices, indices: newIndices } = this.removeDuplicateVertices( new Float32Array( vertices ), new Uint32Array( indices ) );
		return new Meshlet( newVertices, newIndices );

	}
	static mergeV2( meshlets ) {

		let vertices = [];
		let indices = [];
		let indicesOffset = 0;
		for ( const meshlet of meshlets ) {

			for ( const vertex of meshlet.vertices ) vertices.push( vertex );
			for ( const index of meshlet.indices ) indices.push( index + indicesOffset );
			indicesOffset += meshlet.vertices.length / 3;

		}

		return new Meshlet( new Float32Array( vertices ), new Uint32Array( indices ) );

	}

}


export default MeshletMerger;