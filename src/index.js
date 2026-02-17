import Main from "./main.js";


async function getGPULimits() {

	if ( ! navigator.gpu ) {

		console.error( 'WebGPU is not supported' );
		return null;

	}

	let adapter = await navigator.gpu.requestAdapter();
	if ( ! adapter ) {

		console.error( 'Failed to get GPU adapter' );
		return null;

	}

	const limits = adapter.limits;

	adapter = null;

	return limits;

}



( async () => {

	const limits = await getGPULimits();

	if ( limits ) {

		const APP = new Main( limits );
		await APP.Initialize();

	} else {

		console.error( 'Fehler beim Abrufen der GPU-Limits' );

	}

} )();
