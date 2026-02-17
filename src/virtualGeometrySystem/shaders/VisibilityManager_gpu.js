import { wgslFn } from "three/tsl";
import { instancePerSide } from '../../model/config.js';


const structName = instancePerSide === 1 ? 'MeshMatrixInfo' : 'array<MeshMatrixInfo>';
const modelWorldMatrix = instancePerSide === 1 ? 'meshWorldMatrix.modelWorldMatrix' : 'meshWorldMatrix[ object.meshID ].modelWorldMatrix';

//depthTexture: texture_depth_multisampled_2d,
//frustumArray: array<vec4<f32>, 6>,

const visibilityManager_GPU = wgslFn(`
	fn compute(
		depthTexture: texture_depth_2d,
		cameraProjectionMatrix: mat4x4<f32>,
		cameraProjectionMatrixInverse: mat4x4<f32>,
		cameraViewMatrix: mat4x4<f32>,
		cameraPosition: vec3<f32>,
		cameraNearFarFov: vec3<f32>,
		precisionScale: f32,
		maxLod: f32,
		maxTriangles: f32,		
		screenSize: vec2<f32>,
		frustumArray: array<vec4<f32>, 6>,
		drawBuffer: ptr<storage, DrawBuffer, read_write>,
		objectInfo: ptr<storage, array<ObjectInfo>, read>,
		meshletInfo: ptr<storage, array<MeshletInfo>, read>,
		instanceInfo: ptr<storage, array<u32>, read_write>,
		meshWorldMatrix: ptr<storage, ${structName}, read>,
		index: u32,
		wireframe: u32
	) -> void {


		let cameraData = createCameraData( cameraProjectionMatrix, cameraProjectionMatrixInverse, cameraViewMatrix, cameraPosition, cameraNearFarFov, frustumArray );

		let object = objectInfo[ index ];
		let meshlet = meshletInfo[ object.meshletID ];
		let modelWorldMatrix = ${modelWorldMatrix};


		let squaredScreenSize = screenSize * screenSize;

		var visible = true;

		visible = visible && !fastLodVisibilityCheck( meshlet, cameraData, modelWorldMatrix, precisionScale, maxLod );
		visible = visible && !IsFrustumCulled( meshlet, cameraData, modelWorldMatrix, squaredScreenSize, precisionScale );
		//visible = visible && !IsOccluded( meshlet, cameraData, modelWorldMatrix, precisionScale, depthTexture, screenSize );


		if ( visible ) {

			drawBuffer.vertexCount = u32( maxTriangles ) * 3u * select( 1u, 2u, wireframe == 1u );
			var countIndex = atomicAdd( &drawBuffer.instanceCount, 1u );
			instanceInfo[ countIndex ] = index;

		}

	}


	struct CameraData {
		projectionMatrix: mat4x4<f32>,
		projectionMatrixInverse: mat4x4<f32>,
		viewMatrix: mat4x4<f32>,
		position: vec3<f32>,
		nearFarFow: vec3<f32>,
		frustum: array<vec4<f32>, 6>
	};


	fn createCameraData( projectionMatrix: mat4x4<f32>, projectionMatrixInverse: mat4x4<f32>, viewMatrix: mat4x4<f32>, position: vec3<f32>, nearFarFow: vec3<f32>, frustum: array<vec4<f32>, 6> ) -> CameraData {

		return CameraData (
			projectionMatrix,
			projectionMatrixInverse,
			viewMatrix,
			position,
			nearFarFow,
			frustum
		);
	}



	const PI = 3.1415927;
	const testFOV = PI / 180 * 50;
	const squaredCotHalfFov = pow( 1.0 / tan(testFOV / 2.0 ), 2.0 );



	fn fastLodVisibilityCheck( meshlet: MeshletInfo, cameraData: CameraData, modelWorldMatrix: mat4x4<f32>, precisionScale: f32, maxLod: f32 ) -> bool {

		if ( meshlet.lod.x > ceil( maxLod / 2.0 ) ) {

			let boundingSphere = ( ( meshlet.cBoundingSphereHigh + meshlet.cBoundingSphereLow ) / precisionScale );
			let meshletPosition = ( modelWorldMatrix * vec4<f32>( boundingSphere.xyz, 1.0 ) ).xyz;
			let distance = length( meshletPosition - cameraData.position );

			if ( distance < boundingSphere.w ) {

				return true;

			}
		}

		return false;

	}


	fn planeDistanceToPoint( normal: vec3f, constant: f32, point: vec3f ) -> f32 {

		return dot( normal, point ) + constant;

	}


	fn IsFrustumCulled( meshlet: MeshletInfo, cameraData: CameraData, modelWorldMatrix: mat4x4<f32>, squaredScreenSize: vec2<f32>, precisionScale: f32 ) -> bool {

		let meshPosition = vec3( modelWorldMatrix[3][0], modelWorldMatrix[3][1], modelWorldMatrix[3][2] );

		let scaleX = length(vec3( modelWorldMatrix[0][0], modelWorldMatrix[0][1], modelWorldMatrix[0][2] ) );
		let scaleY = length(vec3( modelWorldMatrix[1][0], modelWorldMatrix[1][1], modelWorldMatrix[1][2] ) );
		let scaleZ = length(vec3( modelWorldMatrix[2][0], modelWorldMatrix[2][1], modelWorldMatrix[2][2] ) );
		let meshScale = vec3( scaleX, scaleY, scaleZ );

		let modelViewMatrix = cameraData.viewMatrix * modelWorldMatrix;
		let offset = vec3<f32>( modelViewMatrix[3][0], modelViewMatrix[3][1], modelViewMatrix[3][2] ) * precisionScale;

		if ( !isMeshletVisible( meshlet, modelViewMatrix, squaredScreenSize, offset, precisionScale ) ) {

			return true;
		}


        let boundingSphere = ( ( meshlet.cBoundingSphereHigh + meshlet.cBoundingSphereLow ) / precisionScale ) * meshScale.x;
        let center = vec4f( boundingSphere.xyz + meshPosition.xyz, 1.0 ).xyz;
        let negRadius = -boundingSphere.w;

        for ( var i = 0; i < 6; i++ ) {

            let distance = planeDistanceToPoint( cameraData.frustum[i].xyz, cameraData.frustum[i].w, center );

            if ( distance < negRadius ) {

                return true;    
            }
        }

		return false;

	}



	fn IsOccluded( meshlet: MeshletInfo, cameraData: CameraData, meshModelMatrix: mat4x4<f32>, precisionScale: f32, depthTexture: texture_depth_2d, screenSize: vec2<f32> ) -> bool {

		let epsilon = 0.1;

		var bmin = ( meshModelMatrix * vec4<f32>(meshlet.bboxMin.xyz, 1.0) ).xyz;
		var bmax = ( meshModelMatrix * vec4<f32>(meshlet.bboxMax.xyz, 1.0) ).xyz;

		bmin = bmin - vec3<f32>(epsilon);
		bmax = bmax + vec3<f32>(epsilon);

		let boxCorners = array<vec4<f32>, 8>(
			vec4<f32>(bmin.x, bmin.y, bmin.z, 1.0),
			vec4<f32>(bmin.x, bmin.y, bmax.z, 1.0),
			vec4<f32>(bmin.x, bmax.y, bmin.z, 1.0),
			vec4<f32>(bmin.x, bmax.y, bmax.z, 1.0),
			vec4<f32>(bmax.x, bmin.y, bmin.z, 1.0),
			vec4<f32>(bmax.x, bmin.y, bmax.z, 1.0),
			vec4<f32>(bmax.x, bmax.y, bmin.z, 1.0),
			vec4<f32>(bmax.x, bmax.y, bmax.z, 1.0)
		);

		var minZ = 1.0;
		var minXY = vec2f( 1.0 );
		var maxXY = vec2f( 0.0 );

		let transformMatrix = cameraData.projectionMatrix * cameraData.viewMatrix;

		for ( var i = 0; i < 8; i ++ ) {

			var clipPos = transformMatrix * boxCorners[i];
			var ndcPos = clipPos.xyz / clipPos.w;

			var clampedPos = clamp( ndcPos.xy, vec2f( -1.0 ), vec2f( 1.0 ) );

			var uvPos = clampedPos * vec2f( 0.5, -0.5 ) + vec2f( 0.5, 0.5 );

			minXY = min(minXY, uvPos);
			maxXY = max(maxXY, uvPos);

			minZ = saturate( min( minZ, ndcPos.z ) );
		}

		let boxUVs = vec4f( minXY, maxXY );

	//	let depthTextureSize = textureDimensions(depthTexture, 0);

		let mip = 0u;
		let samplesPerSide: u32 = 8u;
		let totalSamples: u32 = samplesPerSide * samplesPerSide;

		let sampleStep: f32 = 1.0 / f32(samplesPerSide);

		var totalDepth: f32 = 0.0;
		var count: f32 = 0.0;

		let sampleWidth = maxXY - minXY;
		let sampleStepX = sampleWidth.x / f32(samplesPerSide);
		let sampleStepY = sampleWidth.y / f32(samplesPerSide);

		var isNotOccluded = false;

		for (var y = 0u; y < samplesPerSide; y++) {
			for (var x = 0u; x < samplesPerSide; x++) {
				let sampleUV = ( minXY + vec2<f32>(f32(x), f32(y)) * vec2<f32>(sampleStepX, sampleStepY) ) * screenSize;

				//let depthSample = textureSampleLevel(depthTexture, depthSampler, sampleUV, u32(mip));
				let depthSample = textureLoad(depthTexture, vec2<u32>(sampleUV), u32(mip));

				if (minZ <= depthSample) {
					isNotOccluded = true;
					break;
				}
			}
			if (isNotOccluded) {
				break;
			}
		}

		return !isNotOccluded;

	}


	fn isMeshletVisible( meshlet: MeshletInfo, modelViewMatrix: mat4x4<f32>, squaredScreenSize: vec2<f32>, offset: vec3<f32>, precisionScale: f32 ) -> bool {

		let threshold = 1e-6;


		let errorHigh = meshlet.errorHigh;
		let errorLow = meshlet.errorLow;



 		let splitCenterHigh = meshlet.cBoundingSphereHigh;
		let splitCenterLow = meshlet.cBoundingSphereLow;

		let errorX = select( errorLow.x, threshold, abs(errorHigh.x) < threshold && errorLow.x < threshold );
		let errorY = select( errorLow.y, threshold, abs(errorHigh.y) < threshold && errorLow.y < threshold );



		let clusterProjectedBoundsHigh = sphereApplyMatrix4( splitCenterHigh, errorHigh.x, modelViewMatrix );
		let clusterProjectedBoundsLow = sphereApplyMatrix4( splitCenterLow, errorX, modelViewMatrix );

		let w_cluster = compute_w( modelViewMatrix, splitCenterHigh, splitCenterLow, precisionScale );
		let scaledRadiusCluster = ( clusterProjectedBoundsHigh.w + clusterProjectedBoundsLow.w );

		let scaledCenterCluster = compute_scaled_center( clusterProjectedBoundsHigh, clusterProjectedBoundsLow, offset, w_cluster );
		let clusterError = projectErrorToScreen( scaledCenterCluster, scaledRadiusCluster, squaredScreenSize.y );



		let splitCenterParentHigh = meshlet.pBoundingSphereHigh;
		let splitCenterParentLow = meshlet.pBoundingSphereLow;

		let parentProjectedBoundsHigh = sphereApplyMatrix4( splitCenterParentHigh, errorHigh.y, modelViewMatrix );
		let parentProjectedBoundsLow = sphereApplyMatrix4( splitCenterParentLow, errorY, modelViewMatrix );

		let w_parent = compute_w( modelViewMatrix, splitCenterParentHigh, splitCenterParentLow, precisionScale );
		let scaledRadiusParent = ( parentProjectedBoundsHigh.w + parentProjectedBoundsLow.w );

		let scaledCenterParent = compute_scaled_center( parentProjectedBoundsHigh, parentProjectedBoundsLow, offset, w_parent );
		let parentError = projectErrorToScreen( scaledCenterParent, scaledRadiusParent, squaredScreenSize.y );



		const errorThreshold = 1.0;

		return clusterError <= errorThreshold && parentError > errorThreshold;

	}


	fn compute_w( modelViewMatrix: mat4x4<f32>, splitCenterHigh: vec4<f32>, splitCenterLow: vec4<f32>, scale: f32 ) -> f32 {

		return 1.0 / (
			modelViewMatrix[0][3] * ( splitCenterHigh.x + splitCenterLow.x ) / scale +
			modelViewMatrix[1][3] * ( splitCenterHigh.y + splitCenterLow.y ) / scale +
			modelViewMatrix[2][3] * ( splitCenterHigh.z + splitCenterLow.z ) / scale +
			modelViewMatrix[3][3]
		);
	}


	fn compute_scaled_center( projectedBoundsHigh: vec4<f32>, projectedBoundsLow: vec4<f32>, offset: vec3<f32>, w: f32 ) -> vec3<f32> {

		return vec3<f32>(
			(( projectedBoundsHigh.x + projectedBoundsLow.x ) + offset.x ) * w,
			(( projectedBoundsHigh.y + projectedBoundsLow.y ) + offset.y ) * w,
			(( projectedBoundsHigh.z + projectedBoundsLow.z ) + offset.z ) * w
		);
	}


	fn applyMatrix4( a: vec3<f32>, m: mat4x4<f32> ) -> vec3<f32> {

		let x1 = m[0][0] * a.x + m[1][0] * a.y + m[2][0] * a.z;
		let y1 = m[0][1] * a.x + m[1][1] * a.y + m[2][1] * a.z;
		let z1 = m[0][2] * a.x + m[1][2] * a.y + m[2][2] * a.z;

		return vec3<f32>( x1, y1, z1 );
	}


	fn sphereApplyMatrix4( boundingSphere: vec4<f32>, radius: f32, modelViewMatrix: mat4x4<f32> ) -> vec4<f32> {

		let transformedCenter = applyMatrix4( boundingSphere.xyz, modelViewMatrix );
		let projectedRadius = radius * getMaxScaleOnAxis( modelViewMatrix );

		return vec4<f32>( transformedCenter, projectedRadius );
	}


	fn projectErrorToScreen( center: vec3<f32>, radius: f32, squaredScreenHeight: f32 ) -> f32 {

		if ( radius > 1e6 ) {
			return 1e6;
		}

		let d2 = dot( center, center );
		let r2 = radius * radius;

		return squaredScreenHeight * squaredCotHalfFov * r2 / ( d2 - r2 );
	}


	fn getMaxScaleOnAxis( matrix: mat4x4<f32> ) -> f32 {

		let scaleX = length( matrix[0].xyz );
		let scaleY = length( matrix[1].xyz );
		let scaleZ = length( matrix[2].xyz );

		return max( max( scaleX, scaleY ), scaleZ );
	}

`);



const initDrawBuffer = wgslFn(`
	fn compute(
		drawBuffer: ptr<storage, DrawBuffer, read_write>,
	) -> void {

		drawBuffer.vertexCount = 0u;
		atomicStore(&drawBuffer.instanceCount, 0u);
		drawBuffer.firstVertex = 0u;
		drawBuffer.firstInstance = 0u;

	}
`);


export { visibilityManager_GPU, initDrawBuffer };