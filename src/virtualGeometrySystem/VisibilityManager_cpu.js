import * as THREE from "three";


class VisibilityManager_CPU {

	constructor() {

		this.tempMatrix = new THREE.Matrix4();

	}

	dot( a, b ) {

		return a.x * b.x + a.y * b.y + a.z * b.z;

	}

	applyMatrix4( a, m ) {

		const x = a.x, y = a.y, z = a.z;
		const e = m;

		const w = 1 / ( e[ 3 ] * x + e[ 7 ] * y + e[ 11 ] * z + e[ 15 ] );

		let x1 = ( e[ 0 ] * x + e[ 4 ] * y + e[ 8 ] * z + e[ 12 ] ) * w;
		let y1 = ( e[ 1 ] * x + e[ 5 ] * y + e[ 9 ] * z + e[ 13 ] ) * w;
		let z1 = ( e[ 2 ] * x + e[ 6 ] * y + e[ 10 ] * z + e[ 14 ] ) * w;

		return { x: x1, y: y1, z: z1 };

	}

	projectErrorToScreen( center, radius, screenHeight ) {

        if ( radius > 1e10 ) {

			return 1e10;

        }

		const testFOV = Math.PI / 180 * 50;
		const cotHalfFov = 1 / Math.tan( testFOV / 2 );

		const d2 = this.dot( center, center );
		const r2 = radius * radius;

		return screenHeight ** 2 * cotHalfFov ** 2 * r2 / ( d2 - r2 );

	}

	sphereApplyMatrix4( center, radius, matrix ) {

		radius = radius * matrix.getMaxScaleOnAxis();

		return { center: this.applyMatrix4( center, matrix.elements ), radius };

	}

	isMeshletVisible( meshlet, meshletMatrixWorld, cameraViewMatrix, screenWidth, screenHeight ) {

		const completeProj = this.tempMatrix.multiplyMatrices( cameraViewMatrix, meshletMatrixWorld );

		const clusterProjectedBounds = this.sphereApplyMatrix4( meshlet.boundingVolume.center, Math.max( meshlet.clusterError, 1e-10 ), completeProj );
		const clusterError = this.projectErrorToScreen( clusterProjectedBounds.center, clusterProjectedBounds.radius, screenHeight );

		const parentProjectedBounds = this.sphereApplyMatrix4( meshlet.parentBoundingVolume.center, Math.max( meshlet.parentError, 1e-10 ), completeProj );
		const parentError = this.projectErrorToScreen( parentProjectedBounds.center, parentProjectedBounds.radius, screenHeight );

		const errorThreshold = 1.0;

		return clusterError <= errorThreshold && parentError > errorThreshold;

	}

}


export default VisibilityManager_CPU;