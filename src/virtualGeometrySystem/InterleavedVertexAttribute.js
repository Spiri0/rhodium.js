import * as THREE from "three";


class InterleavedVertexAttribute extends THREE.InterleavedBuffer {

	constructor( attributes, strides ) {

		const interleavedArray = InterleavedVertexAttribute.interleaveAttributes( attributes, strides );
		const stride = strides.reduce( ( a, b ) => a + b, 0 );
		super( interleavedArray, stride );

	}

	static interleaveAttributes( attributes, strides ) {

		const totalLength = attributes.reduce( ( sum, attr ) => sum + attr.array.length, 0 );
		const interleavedArray = new Float32Array( totalLength );
		const interleavedLength = strides.reduce( ( a, b ) => a + b, 0 );

		let offset = 0;
		for ( let i = 0; i < attributes.length; i ++ ) {

			const attribute = attributes[ i ];
			const stride = strides[ i ];
			InterleavedVertexAttribute.stridedCopy( interleavedArray, attribute.array, offset, stride, interleavedLength );
			offset += stride;

		}

		return interleavedArray;

	}

	static stridedCopy( target, values, offset, count, stride ) {

		for ( let i = 0; i < values.length; i += count ) {

			for ( let j = 0; j < count && i + j < values.length && offset < target.length; j ++ ) {

				target[ offset + j ] = values[ i + j ];

			}

			offset += stride;

		}

	}

}


export default InterleavedVertexAttribute;