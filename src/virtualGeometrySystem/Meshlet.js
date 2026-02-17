import Meshoptimizer from './meshoptimizer/meshoptimizer.js';
import { Utils, BoundingVolume, Sphere } from './utils.js';
import { attribute_size } from "./meshoptimizer/meshoptimizer.js";


class Meshlet {

	static max_triangles = 128;
	static max_vertices = 255;

	constructor( vertices, indices ) {

		this.id = Utils.UUID();
		this.vertices = vertices;
		this.indices = indices;
		this.lod = 0;
		this.children = [];
		this.parents = [];
		this._boundingVolume = null;

		this.bounds = BoundingVolume.FromVertices( this.vertices, attribute_size );

		if ( this.indices.length / 3 < Meshoptimizer.kMeshletMaxTriangles ) {

			const coneBounds = Meshoptimizer.meshopt_computeClusterBounds( this.vertices, this.indices );
			this.coneBounds = {
				cone_apex: coneBounds.cone_apex,
				cone_axis: coneBounds.cone_axis,
				cone_cutoff: coneBounds.cone_cutoff
			};

		}

		this.parentBoundingVolume = null;
		this.parentError = Infinity;
		this.clusterError = 0;

	}

	get boundingVolume() {

		if ( ! this._boundingVolume ) {

			this._boundingVolume = Sphere.fromVertices( this.vertices, this.indices, attribute_size );

		}

		return this._boundingVolume;

	}

	set boundingVolume( boundingVolume ) {

		this._boundingVolume = boundingVolume;

	}

	static convertBufferAttributeToNonIndexed( attribute, indices, itemSize, isInterleaved = false, stride = 3, offset = 0 ) {

		if ( ! attribute ) throw Error( "Invalid attribute" );

		const array = attribute;
		const resultArray = new Float32Array( indices.length * itemSize );

		let index = 0, index2 = 0;

		for ( let i = 0, l = indices.length; i < l; i ++ ) {

			index = isInterleaved ? indices[ i ] * stride + offset : indices[ i ] * itemSize;

			for ( let j = 0; j < itemSize; j ++ ) {

				resultArray[ index2 ++ ] = array[ index ++ ];

			}

		}

		return resultArray;

	}

}


export default Meshlet;