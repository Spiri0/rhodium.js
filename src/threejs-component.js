import * as THREE from "three";
import { WebGPU, CSS2DRenderer} from './three-defs.js';
import {entity} from "./entity.js";
import { pass, depthPass, viewportUV, wgslFn } from "three/tsl";




class ThreeJSController extends entity.Component {

	constructor( limits ) {

		super();
		this.limits = limits;
		//console.log( limits );

	}

	InitEntity() {

    	if ( WebGPU.isAvailable() === false ) {

    		document.body.appendChild( WebGPU.getErrorMessage() );
			throw new Error( 'Your Browser does not support WebGPU yet' );

		}

		this.renderer = new THREE.WebGPURenderer( {
			canvas: document.createElement( 'canvas' ),
			antialias: true,
			forceWebGL: false,
			requiredLimits: {
				maxBufferSize: this.limits.maxBufferSize,
				maxStorageBufferBindingSize: this.limits.maxStorageBufferBindingSize
			}
		} );

		this.renderer.outputColorSpace = THREE.SRGBColorSpace;
		this.renderer.setPixelRatio( window.devicePixelRatio );
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		this.renderer.physicallyCorrectLights = true;
		this.renderer.domElement.id = 'threejs';
		this.renderer.setClearColor( 0x00001f );
		//this.renderer.setClearAlpha( 0 );
		this.maxAnisotropy = this.renderer.getMaxAnisotropy();

		this.container = document.getElementById( 'container' );
		this.renderer.setSize( this.container.clientWidth, this.container.clientHeight );
		this.container.appendChild( this.renderer.domElement );

		this.labelRenderer = new CSS2DRenderer();
		this.labelRenderer.setSize( this.container.clientWidth, this.container.clientHeight );
		this.labelRenderer.domElement.style.position = 'absolute';
		this.labelRenderer.domElement.style.top = '0px';
		this.labelRenderer.domElement.style.pointerEvents = 'none';
		this.container.appendChild( this.labelRenderer.domElement );

		this.scene = new THREE.Scene();
		this.uiScene = new THREE.Scene();

		this.width = this.container.clientWidth;
		this.height = this.container.clientHeight;
		let aspect = this.width / this.height;
		let fov = 50;
		let near = 1e-2;
		let far = 1e4;

		this.camera = new THREE.PerspectiveCamera( fov, aspect, near, far );
		this.uiCamera = new THREE.OrthographicCamera( - this.width / 2, this.width / 2, this.height / 2, - this.height / 2, 0, 10 );


		this.scenePass = pass( this.scene, this.camera );
		this.scenePassTexture = this.scenePass.getTextureNode();
		this.sceneDepthPass = depthPass( this.scene, this.camera, { samples: this.renderer.samples } );
		this.sceneDepthPassTexture = this.sceneDepthPass.getTextureNode( 'depth' );


		this.postProcessing = new THREE.PostProcessing( this.renderer );


		this.renderTarget = new THREE.RenderTarget( this.width, this.height );
		this.renderTarget.stencilBuffer = false;
		this.renderTarget.depthBuffer = true;
		this.renderTarget.depthTexture = new THREE.DepthTexture();
		this.renderTarget.depthTexture.type = THREE.FloatType;
		this.renderTarget.depthTexture.format = THREE.DepthFormat;
		this.renderTarget.depthTexture.minFilter = THREE.NearestFilter;
		this.renderTarget.depthTexture.magFilter = THREE.NearestFilter;
		//this.renderTarget.depthTexture.generateMipmaps = true;
		this.renderTarget.depthTexture.needsUpdate = true;





		const shaderParams = {
			uv: viewportUV,
			depthFloat: this.sceneDepthPassTexture,
			cameraNear: this.camera.near,
			cameraFar: this.camera.far
		  }
		  
		  const fragmentShader = wgslFn(`
			fn main_fragment(
			  uv: vec2<f32>,
			  depthFloat: f32,
			  cameraNear: f32,
			  cameraFar: f32
			) -> vec4<f32> {
			
			  var linearDepth = cameraNear * cameraFar / (cameraFar - depthFloat * (cameraFar - cameraNear));
			  var normalizedDepth = (linearDepth - cameraNear) / (cameraFar - cameraNear);
		
			  return vec4( vec3( normalizedDepth ), 1.0 );
		
			}
		  `);
		
		  this.postProcessing.outputNode = fragmentShader(shaderParams);  







		


		window.addEventListener( 'resize', () => {

			this.OnResize_();

		}, false );

		this.OnResize_();

	}


	async Render() {

		this.camera.layers.enableAll();

		this.renderer.setRenderTarget( this.renderTarget );
		this.renderer.render( this.scene, this.camera );
		this.renderer.setRenderTarget( null );

		this.renderer.render( this.scene, this.camera );
		this.renderer.autoClear = false;
		this.renderer.render( this.uiScene, this.uiCamera );
		this.renderer.autoClear = true;

	//	this.postProcessing.render();

	}


	OnResize_() {

		const width = this.container.clientWidth;
		const height = this.container.clientHeight;

		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();

		this.renderer.setSize( width, height );

		this.renderTarget.setSize( width, height );

		if ( this.uiCamera ) {

			this.uiCamera.left = - width / 2;
			this.uiCamera.right = width / 2;
			this.uiCamera.top = height / 2;
			this.uiCamera.bottom = - height / 2;
			this.uiCamera.updateProjectionMatrix();

		}

	}

}


export default ThreeJSController;