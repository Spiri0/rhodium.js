import MetisModule from './metis_module.js';
import { WASMPointer, WASMHelper } from '../utils.js';



class as {
    constructor(){

    }

}


class Metis {

	static METIS;
	static isLoaded = false;

	static async load() {

		if ( ! Metis.METIS ) {

			Metis.METIS = await MetisModule();
			this.isLoaded = true;

		}

	}

	static partition( groups, nparts ) {

		if ( ! this.isLoaded ) throw Error( "Metis library not loaded" );
		function _prepare_graph( adjacency ) {

			function assert( condition ) {

				if ( ! condition ) throw Error( "assert" );

			}

			let xadj = [ 0 ];
			let adjncy = [];
			for ( let i3 = 0; i3 < adjacency.length; i3 ++ ) {

				let adj = adjacency[ i3 ];
				if ( adj !== null && adj.length ) {

					assert( Math.max( ...adj ) < adjacency.length );

				}

				adjncy.push( ...adj );
				xadj.push( adjncy.length );

			}

			return [ xadj, adjncy ];

		}

		const [ _xadj, _adjncy ] = _prepare_graph( groups );

		const objval = new WASMPointer( new Uint32Array( 1 ), "out" );
		const parts = new WASMPointer( new Uint32Array( _xadj.length - 1 ), "out" );
		const options_array = new Int32Array( 40 );
		options_array.fill( - 1 );
		options_array[ 16 /* METIS_OPTION_UFACTOR */ ] = 200;

		WASMHelper.call(
			Metis.METIS,
			"METIS_PartGraphKway",
			"number",
			new WASMPointer( new Int32Array( [ _xadj.length - 1 ] ) ),
			new WASMPointer( new Int32Array( [ 1 ] ) ),
			new WASMPointer( new Int32Array( _xadj ) ),
			new WASMPointer( new Int32Array( _adjncy ) ),
			null,
			null,
			null,
			new WASMPointer( new Int32Array( [ nparts ] ) ),
			null,
			null,
			new WASMPointer( options_array ),
			objval,
			parts
		);

		const part_num = Math.max( ...parts.data );
		const parts_out = [];
		for ( let i3 = 0; i3 <= part_num; i3 ++ ) {

			const part = [];
			for ( let j2 = 0; j2 < parts.data.length; j2 ++ ) {

				if ( parts.data[ j2 ] === i3 ) {

					part.push( j2 );

				}

			}

			if ( part.length > 0 ) parts_out.push( part );

		}

		return parts_out;

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
	static group( adj, nparts ) {

		const groups = this.partition( adj, nparts );
		return groups;

	}

	static METIS_PartGraphRecursive( nvtxs, ncon, xadj, adjncy, vwgt, vsize, adjwgt, nparts, tpwgts, ubvec, options, edgecut, part ) {

		const parts = new WASMPointer( new Int32Array( [ ...part ] ), "out" );
		const r2 = WASMHelper.call(
			_Metis.METIS,
			"METIS_PartGraphRecursive",
			"number",
			nvtxs ? new WASMPointer( new Int32Array( [ nvtxs ] ) ) : null,
			ncon ? new WASMPointer( new Int32Array( [ ncon ] ) ) : null,
			xadj ? new WASMPointer( new Int32Array( [ ...xadj ] ) ) : null,
			adjncy ? new WASMPointer( new Int32Array( [ ...adjncy ] ) ) : null,
			vwgt ? new WASMPointer( new Int32Array( [ vwgt ] ) ) : null,
			vsize ? new WASMPointer( new Int32Array( [ vsize ] ) ) : null,
			adjwgt ? new WASMPointer( new Int32Array( [ ...adjwgt ] ) ) : null,
			nparts ? new WASMPointer( new Int32Array( [ nparts ] ) ) : null,
			tpwgts ? new WASMPointer( new Float32Array( [ ...tpwgts ] ) ) : null,
			ubvec ? new WASMPointer( new Int32Array( [ ubvec ] ) ) : null,
			options ? new WASMPointer( new Int32Array( [ ...options ] ) ) : null,
			edgecut ? new WASMPointer( new Int32Array( [ edgecut ] ) ) : null,
			parts
		);
		for ( let i3 = 0; i3 < parts.data.length; i3 ++ ) part[ i3 ] = parts.data[ i3 ];
		return r2;

	}

}


export default Metis;