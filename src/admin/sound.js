// A short two-tone chime made in the browser, so no sound file ships with the plugin.
let ctx = null;

const unlock = () => {
	try {
		const Ctx = window.AudioContext || window.webkitAudioContext;
		ctx = ctx || ( Ctx ? new Ctx() : null );
		if ( ctx && ctx.state === 'suspended' ) {
			ctx.resume();
		}
	} catch ( e ) {}
};
document.addEventListener( 'pointerdown', unlock, { once: true } );
document.addEventListener( 'keydown', unlock, { once: true } );

export const chime = () => {
	try {
		if ( ! ctx || ctx.state !== 'running' ) {
			return;
		}
		[ 660, 880 ].forEach( ( freq, i ) => {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			const start = ctx.currentTime + ( i * 0.16 );
			osc.type = 'sine';
			osc.frequency.value = freq;
			gain.gain.setValueAtTime( 0.0001, start );
			gain.gain.exponentialRampToValueAtTime( 0.18, start + 0.02 );
			gain.gain.exponentialRampToValueAtTime( 0.0001, start + 0.3 );
			osc.connect( gain ).connect( ctx.destination );
			osc.start( start );
			osc.stop( start + 0.32 );
		} );
	} catch ( e ) {}
};
