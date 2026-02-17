import * as THREE from "three";


class WASMPointer {

	constructor( data, type = "in" ) {

		this.data = data;
		this.ptr = null;
		this.type = type;

	}

}


class WASMHelper {

    static TYPES = {
      	i8: { array: Int8Array, heap: "HEAP8" },
      	i16: { array: Int16Array, heap: "HEAP16" },
      	i32: { array: Int32Array, heap: "HEAP32" },
      	f32: { array: Float32Array, heap: "HEAPF32" },
      	f64: { array: Float64Array, heap: "HEAPF64" },
      	u8: { array: Uint8Array, heap: "HEAPU8" },
      	u16: { array: Uint16Array, heap: "HEAPU16" },
      	u32: { array: Uint32Array, heap: "HEAPU32" }
    }

    static getTypeForArray(array) {
      	if (array instanceof Int8Array) return this.TYPES.i8;
      	else if (array instanceof Int16Array) return this.TYPES.i16;
      	else if (array instanceof Int32Array) return this.TYPES.i32;
      	else if (array instanceof Uint8Array) return this.TYPES.u8;
      	else if (array instanceof Uint16Array) return this.TYPES.u16;
      	else if (array instanceof Uint32Array) return this.TYPES.u32;
      	else if (array instanceof Float32Array) return this.TYPES.f32;
      	else if (array instanceof Float64Array) return this.TYPES.f64;
      	console.log(array);
      	throw Error("Array has no type");
    }

    static transferNumberArrayToHeap(module, array) {
      	const type = this.getTypeForArray(array);
      	const typedArray = type.array.from(array);
      	const heapPointer = module._malloc(
        	typedArray.length * typedArray.BYTES_PER_ELEMENT
      	);
      	if (type.heap === "HEAPU8") module[type.heap].set(typedArray, heapPointer);
      	else module[type.heap].set(typedArray, heapPointer >> 2);
      	return heapPointer;
    }

    static getDataFromHeapU8(module, address, type, length) {
      	return module[type.heap].slice(address, address + length);
    }

    static getDataFromHeap(module, address, type, length) {
      	return module[type.heap].slice(address >> 2, (address >> 2) + length);
    }

    static getArgumentTypes(args) {
      	let argTypes = [];
      	for (let i3 = 0; i3 < args.length; i3++) {
        	const arg = args[i3];
        	if (arg instanceof Uint8Array) argTypes.push("number");
        	else if (arg instanceof Uint16Array) argTypes.push("number");
        	else if (arg instanceof Uint32Array) argTypes.push("number");
        	else if (arg instanceof Int8Array) argTypes.push("number");
        	else if (arg instanceof Int16Array) argTypes.push("number");
        	else if (arg instanceof Int32Array) argTypes.push("number");
        	else if (arg instanceof Float32Array) argTypes.push("number");
        	else if (arg instanceof Float64Array) argTypes.push("number");
        	else if (typeof arg === "string") argTypes.push("string");
        	else argTypes.push("number");
      	}
      	return argTypes;
    }

    static transferArguments(module, args) {
      	let method_args = [];
      	for (let i3 = 0; i3 < args.length; i3++) {
        	const arg = args[i3];
        	if (arg instanceof WASMPointer) {
          		arg.ptr = WASMHelper.transferNumberArrayToHeap(module, arg.data);
          		method_args.push(arg.ptr);
        	} else method_args.push(args[i3]);
      	}
      	return method_args;
    }

    static getOutputArguments(module, args) {
      	for (let i3 = 0; i3 < args.length; i3++) {
        	const arg = args[i3];
        	if (!(arg instanceof WASMPointer)) continue;
        	if (arg.ptr === null) continue;
        	if (arg.type === "in") continue;
        	const type = WASMHelper.getTypeForArray(arg.data);
        	if (type === this.TYPES.u8) {
          		arg.data = WASMHelper.getDataFromHeapU8(module, arg.ptr, type, arg.data.length);
        	} else {
          		arg.data = WASMHelper.getDataFromHeap(module, arg.ptr, type, arg.data.length);
        	}
      	}
    }

    static call(module, method, returnType, ...args) {
      	let method_args = WASMHelper.transferArguments(module, args);
      	const method_arg_types = WASMHelper.getArgumentTypes(args);
      	const ret = module.ccall(
        	method,
        	returnType,
        	method_arg_types,
        	method_args
      	);
      	WASMHelper.getOutputArguments(module, args);
      	return ret;
    }

}

class Utils {

	static UUID() {

		return Math.floor( Math.random() * 1e6 ).toString();

	}
	static StringFindAllBetween( source, start, end, exclusive = true ) {

		const escapeRegExp = ( string ) => string.replace( /[.*+?^${}()|[\]\\]/g, "\\$&" );

		const regex = new RegExp( `${escapeRegExp( start )}(.*?)${escapeRegExp( end )}`, "gs" );
		const matches = [];
		let match;

		while ( ( match = regex.exec( source ) ) !== null ) {

			if ( exclusive ) {

				matches.push( match[ 1 ] );

			} else {

				matches.push( start + match[ 1 ] + end );

			}

		}

		return matches;

	}

}


class Sphere {

	constructor( center = new THREE.Vector3( 0, 0, 0 ), radius = 0 ) {

		this.center = center;
		this.radius = radius;

	}

	static fromAABB( minBounds, maxBounds ) {

		const center = new THREE.Vector3()
			.addVectors( minBounds, maxBounds )
			.multiplyScalar( 0.5 );
		const radius = minBounds.distanceTo( maxBounds ) * 0.5;

		return new Sphere( center, radius );

	}

	static fromVertices( vertices, indices, vertex_positions_stride ) {

		let min = new THREE.Vector3( Infinity, Infinity, Infinity );
		let max = new THREE.Vector3( - Infinity, - Infinity, - Infinity );
		let vertex = new THREE.Vector3();

		for ( const index of indices ) {

			const x = vertices[ index * vertex_positions_stride + 0 ];
			const y = vertices[ index * vertex_positions_stride + 1 ];
			const z = vertices[ index * vertex_positions_stride + 2 ];

			if ( isNaN( x ) || isNaN( y ) || isNaN( z ) ) throw Error( "Invalid vertex" );

			vertex.set( x, y, z );
			min.min( vertex );
			max.max( vertex );

		}

		return Sphere.fromAABB( min, max );

	}

}


class BoundingVolume {

	constructor( min, max ) {

		this.min = min;
		this.max = max;

	}

	static FromVertices( vertices, vertex_positions_stride ) {

		let min = new THREE.Vector3( Infinity, Infinity, Infinity );
		let max = new THREE.Vector3( - Infinity, - Infinity, - Infinity );

		for ( let i = 0; i < vertices.length; i += vertex_positions_stride ) {

			const x = vertices[ i + 0 ];
			const y = vertices[ i + 1 ];
			const z = vertices[ i + 2 ];

			if ( isNaN( x ) || isNaN( y ) || isNaN( z ) ) throw new Error( "Invalid vertex in vertices array" );

			min.set( Math.min( min.x, x ), Math.min( min.y, y ), Math.min( min.z, z ) );
			max.set( Math.max( max.x, x ), Math.max( max.y, y ), Math.max( max.z, z ) );

		}

		return new BoundingVolume( min, max );

	}

}


export { WASMHelper, WASMPointer, Utils, Sphere, BoundingVolume };