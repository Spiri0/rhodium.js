import * as THREE from "three";
import {GUI} from './three-defs.js';
import {entity} from './entity.js';
import EntityManager from './entity-manager.js';
import ThreeJSController from './threejs-component.js';
import {spawners} from './spawners.js';
import ModelManager from './model/model.js';
import { Stats2 } from './betterStats.js';
import Stats from 'three/addons/libs/stats.module.js';


class Main extends entity.Entity {

	static isInitialized = false;

	constructor( limits ) {

		super();
		this.limits = limits;

	}

	async Initialize() {

		if ( Main.isInitialized ) {
            console.log("App is already initialized");
            return;
        }

		this.entityManager = new EntityManager();
		this.entityManager.Add( this, 'main' );
		await this.OnGameStarted();

		Main.isInitialized = true;

	}

	async OnGameStarted() {

		//this.CreateGUI();
		await this.LoadControllers();

		if ( !this.running ) {

			this.running = true;
			this.previousTime = performance.now();
			this.timeElapsedS = 0;

			this.TIMESTEP = 1000 / 60;
			this.lastTime = performance.now();
			this.accumulator = 0;

			this._needsResize = false;

			this.renderer.setAnimationLoop( this.Animate.bind( this ) );

		}

	}

	CreateGUI() {

		this.guiParams = {
		};
		this.gui_ = new GUI();
		this.gui_.close();

	}

	async LoadControllers() {

		const threejs = new entity.Entity();

		threejs.AddComponent( new ThreeJSController( this.limits ) );
		this.entityManager.Add( threejs, 'threejs' );

		this.scene = threejs.GetComponent( 'ThreeJSController' ).scene;
		this.camera = threejs.GetComponent( 'ThreeJSController' ).camera;
		this.renderer = threejs.GetComponent( 'ThreeJSController' ).renderer;
		this.threejs = threejs.GetComponent( 'ThreeJSController' );


		await this.renderer.init();


		this.otherStats = {
			maxTriangles: 0,
		};

		const basicParams = {
			scene: this.scene,
			camera: this.camera,
			threejs: this.threejs,
			renderer: this.renderer,
			otherStats: this.otherStats
		};


		this.fps = new Stats();
		this.stats = new Stats2( this.renderer );
	//	document.body.appendChild( this.stats.domElement );
		document.body.appendChild( this.fps.dom );




		const spawner = new entity.Entity();


		//Player
		spawner.AddComponent( new spawners.PlayerSpawner( {
			...basicParams,
			layer: 0,
		} ) );

		this.entityManager.Add( spawner, 'spawners' );
		spawner.GetComponent( 'PlayerSpawner' ).Spawn();


		//---------------------------------------------------------------------------------



		const model = new entity.Entity();
		const modelManager = new ModelManager();
		await modelManager.Init( {
			...basicParams,
			layer: 2,
			gui: this.gui_,
			guiParams: this.guiParams,
		} );
		model.AddComponent( modelManager );
		this.entityManager.Add( model, 'model' );



		//--------------------------------------------------------------------------------------

		const ambientLight = new THREE.AmbientLight( 0xffffff, 10.25 );
		this.scene.add( ambientLight );
		ambientLight.layers.set( 2 );

	}

/*
	Animate() {

		const now = performance.now();
		const deltaTime = ( now - this.previousTime );
		this.previousTime = now;


		this.threejs.Render();
		this.Step( deltaTime );
		

		this.stats.update( this.renderer.info.render, this.otherStats );
		this.fps.update();

		//console.log(deltaTime)

	}
*/

	Animate( now ) {

		//const now = performance.now();

		let delta = now - this.previousTime;
		this.previousTime = now;

		this.accumulator += delta;

		if ( this.accumulator > 200 ) this.accumulator = 200;

		if ( this.accumulator >= this.TIMESTEP ) {

			const dt = this.TIMESTEP;

			this.Step( dt );

			this.accumulator -= this.TIMESTEP;

		}

		this.threejs.Render();
		this.stats.update( this.renderer.info.render, this.otherStats );
		this.fps.update();

		//this.Step( deltaTime );
		//this.threejs.Render();
		//console.log(deltaTime)

	}


	Step( timeElapsed ) {

		const timeElapsedS = Math.min( timeElapsed / 1000, 0.1 );

		this.entityManager.Update( timeElapsedS, 0 );
		this.entityManager.Update( timeElapsedS, 1 );

	}

}


export default Main;
