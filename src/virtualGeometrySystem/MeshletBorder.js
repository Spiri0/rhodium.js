class MeshletBorder {

  	// Returns an array with the shared vertices between meshes
	static GetSharedVertices( meshes, attribute_size2 ) {

		function VertexEncode( vertex ) {

			return `${vertex[ 0 ].toPrecision( 4 )},${vertex[ 1 ].toPrecision( 4 )},${vertex[ 2 ].toPrecision( 4 )}`;

		}

		function VertexDecode( vertexKey ) {

			const vertex = vertexKey.split( "," );
			return [ parseFloat( vertex[ 0 ] ), parseFloat( vertex[ 1 ] ), parseFloat( vertex[ 2 ] ) ];

		}

		let vertexCountMap = /* @__PURE__ */ new Map();
		for ( const mesh of meshes ) {

			for ( let i3 = 0; i3 < mesh.vertices.length; i3 += attribute_size2 ) {

				const vKey = VertexEncode( [ mesh.vertices[ i3 + 0 ], mesh.vertices[ i3 + 1 ], mesh.vertices[ i3 + 2 ] ] );
				let vCounts = vertexCountMap.get( vKey ) || 0;
				vertexCountMap.set( vKey, ++ vCounts );

			}

		}

		let sharedVertices = [];
		for ( const [ key, vCount ] of vertexCountMap ) {

			if ( vCount > 1 ) {

				sharedVertices.push( VertexDecode( key ) );

			}

		}

		return sharedVertices;

	}

	static getVertexIndicesForVertexKeys( vertexKeys, vertices, attribute_size2 ) {

		let matches = [];
	    for ( let i3 = 0; i3 < vertexKeys.length; i3 ++ ) {

			const v2 = vertexKeys[ i3 ];
			for ( let j2 = 0; j2 < vertices.length; j2 += attribute_size2 ) {

				const EPS = 1e-3;
		        if ( Math.abs( v2[ 0 ] - vertices[ j2 + 0 ] ) < EPS && Math.abs( v2[ 1 ] - vertices[ j2 + 1 ] ) < EPS && Math.abs( v2[ 2 ] - vertices[ j2 + 2 ] ) < EPS ) {

					matches.push( j2 );

			    }

			}

		}

		return matches;

	}

	// For a given mesh returns an array with locked vertices that match sharedVertices
	static SharedVerticesToLockedArray( sharedVertices, mesh, attribute_size2 ) {

		const mergedGroupLockedVertexIds = this.getVertexIndicesForVertexKeys( sharedVertices, mesh.vertices, attribute_size2 );
	    const lockedArray = new Uint8Array( mesh.vertices.length ).fill( 0 );
	    for ( const lockedVertex of mergedGroupLockedVertexIds ) {

			lockedArray[ lockedVertex ] = 1;

		}

		return lockedArray;

	}

}


export default MeshletBorder;