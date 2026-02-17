import Metis from './metis/metis.js';
import Meshlet from './Meshlet.js';


class MeshletGrouper {

	static adjacencyList( meshlets ) {

		let vertexHashToMeshletMap = /* @__PURE__ */ new Map();
		for ( let i3 = 0; i3 < meshlets.length; i3 ++ ) {

			const meshlet = meshlets[ i3 ];
			for ( let j2 = 0; j2 < meshlet.vertices.length; j2 += 8 ) {

				const hash = `${meshlet.vertices[ j2 + 0 ].toPrecision( 6 )},${meshlet.vertices[ j2 + 1 ].toPrecision( 6 )},${meshlet.vertices[ j2 + 2 ].toPrecision( 6 )}`;
				let meshletList = vertexHashToMeshletMap.get( hash );
				if ( ! meshletList ) meshletList = /* @__PURE__ */ new Set();
				meshletList.add( i3 );
				vertexHashToMeshletMap.set( hash, meshletList );

			}

		}

		const adjacencyList = /* @__PURE__ */ new Map();
		for ( let [ _2, indices ] of vertexHashToMeshletMap ) {

			if ( indices.size === 1 ) continue;
			for ( let index of indices ) {

				if ( ! adjacencyList.has( index ) ) {

					adjacencyList.set( index, /* @__PURE__ */ new Set() );

				}

				for ( let otherIndex of indices ) {

					if ( otherIndex !== index ) {

						adjacencyList.get( index ).add( otherIndex );

					}

				}

			}

		}

		let adjacencyListArray = new Array( meshlets.length ).fill( 0 ).map( ( v2 ) => [] );
		for ( let [ key, adjacents ] of adjacencyList ) {

			if ( ! adjacencyListArray[ key ] ) adjacencyListArray[ key ] = [];
			adjacencyListArray[ key ].push( ...Array.from( adjacents ) );

		}

		return adjacencyListArray;

	}

	static rebuildMeshletsFromGroupIndices( meshlets, groups ) {

		let groupedMeshlets = [];
		for ( let i3 = 0; i3 < groups.length; i3 ++ ) {

			if ( ! groupedMeshlets[ i3 ] ) groupedMeshlets[ i3 ] = [];
			for ( let j2 = 0; j2 < groups[ i3 ].length; j2 ++ ) {

				const meshletId = groups[ i3 ][ j2 ];
				const meshlet = meshlets[ meshletId ];
				groupedMeshlets[ i3 ].push( meshlet );

			}

		}

		return groupedMeshlets;

	}

	static group( meshlets, nparts ) {

		function split( meshlet, parts ) {

			const adj = MeshletGrouper.adjacencyList( meshlet );
			const groups = Metis.partition( adj, parts );
			return MeshletGrouper.rebuildMeshletsFromGroupIndices( meshlet, groups );

		}

		function splitRec( input, partsNeeded ) {

			if ( partsNeeded === 1 ) {

				return [ input ];

			} else {

				const partsLeft = Math.ceil( partsNeeded / 2 );
				const partsRight = Math.floor( partsNeeded / 2 );
				const [ leftInput, rightInput ] = split( input, 2 );
				const leftResult = splitRec( leftInput, partsLeft );
				const rightResult = splitRec( rightInput, partsRight );
				return [ ...leftResult, ...rightResult ];

			}

		}

		//console.log( "CALLEDsss" );
		return splitRec( meshlets, nparts );

	}

	static groupV2( meshlets, nparts ) {

    	const adj = MeshletGrouper.adjacencyList( meshlets );
	    let adjancecy = /* @__PURE__ */ new Map();
		for ( const arr of adj ) {

		    for ( let i3 = 0; i3 < arr.length; i3 ++ ) {

				const f2 = arr[ i3 ];
		        let adjacents = adjancecy.get( f2 ) || [];
			    for ( let j2 = i3 + 1; j2 < arr.length; j2 ++ ) {

		    		const t2 = arr[ j2 ];
				    if ( ! adjacents.includes( t2 ) ) adjacents.push( t2 );

				}

    	    	adjancecy.set( f2, adjacents );

		    }

		}

		console.log( adjancecy );
	    console.log( adj );

	}

	static buildMetisAdjacencyList( vertices, indices ) {

		let adjacencyList = new Array( vertices.length / attribute_size );
	    for ( let i3 = 0; i3 < adjacencyList.length; i3 ++ ) {

			adjacencyList[ i3 ] = /* @__PURE__ */ new Set();

		}

		for ( let i3 = 0; i3 < indices.length; i3 += 3 ) {

      		const v1 = indices[ i3 ];
	    	const v2 = indices[ i3 + 1 ];
	  	    const v3 = indices[ i3 + 2 ];
    		adjacencyList[ v1 ].add( v2 );
  	    	adjacencyList[ v1 ].add( v3 );
		    adjacencyList[ v2 ].add( v1 );
		  	adjacencyList[ v2 ].add( v3 );
		    adjacencyList[ v3 ].add( v1 );
		    adjacencyList[ v3 ].add( v2 );

		}

		return adjacencyList.map( ( set ) => Array.from( set ) );

	}

	static partitionMeshByMetisOutput( vertices, indices, metisPartitions ) {

    	const attribute_size2 = 8;
	    const numPartitions = metisPartitions.length;
		const vertexToPartitions = /* @__PURE__ */ new Map();
		metisPartitions.forEach( ( partition, index ) => {

			partition.forEach( ( vertex ) => {

				if ( ! vertexToPartitions.has( vertex ) ) {

					vertexToPartitions.set( vertex, [] );

				}

				vertexToPartitions.get( vertex ).push( index );

			} );

		} );
		const partitionedData = Array.from( { length: numPartitions }, () => ( {
  			vertexMap: /* @__PURE__ */ new Map(),
	  		vertices: [],
		  	indices: []
		} ) );
		for ( let i3 = 0; i3 < indices.length; i3 += 3 ) {

  			const v1 = indices[ i3 ];
	  		const v2 = indices[ i3 + 1 ];
		  	const v3 = indices[ i3 + 2 ];
			const v1Parts = vertexToPartitions.get( v1 );
  			const v2Parts = vertexToPartitions.get( v2 );
	  		const v3Parts = vertexToPartitions.get( v3 );
		  	const commonPartitions = v1Parts.filter(
				( part ) => v2Parts.includes( part ) && v3Parts.includes( part )
			);
			let assignedPartition;
			if ( commonPartitions.length > 0 ) {

				assignedPartition = commonPartitions[ 0 ];

			} else {

				const vertexPartitions = [
					{ vertex: v1, partitions: v1Parts },
			      	{ vertex: v2, partitions: v2Parts },
					{ vertex: v3, partitions: v3Parts }
				];
				vertexPartitions.sort( ( a2, b2 ) => a2.vertex - b2.vertex );
			    assignedPartition = vertexPartitions[ 0 ].partitions[ 0 ];

			}

			const partData = partitionedData[ assignedPartition ];
			[ v1, v2, v3 ].forEach( ( vertex ) => {

				if ( ! partData.vertexMap.has( vertex ) ) {

					const newVertexIndex = partData.vertices.length / attribute_size2;
					partData.vertexMap.set( vertex, newVertexIndex );
					for ( let j2 = 0; j2 < attribute_size2; j2 ++ ) {

						partData.vertices.push( vertices[ vertex * attribute_size2 + j2 ] );

					}

				}

			} );
			    partData.indices.push(
				partData.vertexMap.get( v1 ),
		        partData.vertexMap.get( v2 ),
		        partData.vertexMap.get( v3 )
			);

		}

		const meshlets = partitionedData.filter( ( part ) => part.vertices.length > 0 ).map( ( part ) => new Meshlet( new Float32Array( part.vertices ), new Uint32Array( part.indices ) ) );
	    return meshlets;

	}

	static split( meshlet, nparts ) {

		function removeSelfLoops( adjacencyList ) {

		    return adjacencyList.map( ( neighbors ) => {

				return neighbors.filter( ( neighbor ) => neighbor !== adjacencyList.indexOf( neighbors ) );

			} );

		}

		const adj = this.buildMetisAdjacencyList( meshlet.vertices, meshlet.indices );
	    const groups = Metis.partition( removeSelfLoops( adj ), nparts );
	    return this.partitionMeshByMetisOutput( meshlet.vertices, meshlet.indices, groups );

	}

}


export default MeshletGrouper;