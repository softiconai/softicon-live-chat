import { __, _n, sprintf } from '@wordpress/i18n';
import { chime } from './sound';
import './notify.scss';

// Every wp-admin page for agents: Heartbeat brings the waiting count; the admin bar and the menu bubble
// follow it, and a new waiting chat rings once (the inbox page has its own, faster loop).
const $ = window.jQuery;
const onInbox = !! document.getElementById( 'allc-inbox' );
let last = null;

const setCount = ( selector, count ) => {
	document.querySelectorAll( selector ).forEach( ( el ) => {
		el.textContent = String( count );
		el.dataset.count = String( count );
		const bubble = el.closest( '.allcCount' );
		if ( bubble ) {
			bubble.className = bubble.className.replace( /count-\d+/, 'count-' + count );
		}
	} );
};

const update = ( counts ) => {
	setCount( '#wp-admin-bar-allc .allcBarCount', counts.waiting + counts.unread );
	setCount( '.allcCount .pending-count', counts.waiting );
	if ( ! onInbox && last !== null && counts.waiting > last ) {
		let sound = true;
		try {
			sound = window.localStorage.getItem( 'allc_sound' ) !== '0';
		} catch ( e ) {}
		if ( sound ) {
			chime();
		}
		if ( window.Notification && Notification.permission === 'granted' ) {
			// eslint-disable-next-line no-new
			new Notification( __( 'Live Chat', 'softicon-live-chat' ), {
				/* translators: %d: number of visitors waiting */
				body: sprintf( _n( '%d visitor is waiting for an answer', '%d visitors are waiting for an answer', counts.waiting, 'softicon-live-chat' ), counts.waiting ),
				tag: 'allc-waiting',
			} );
		}
	}
	last = counts.waiting;
};

if ( $ && ! onInbox ) {
	$( document ).on( 'heartbeat-send', ( e, payload ) => {
		payload.allc = 1;
	} );
	$( document ).on( 'heartbeat-tick', ( e, payload ) => {
		if ( payload && payload.allc ) {
			update( payload.allc );
		}
	} );
	// a faster beat while agents are in wp-admin, so new chats show up within half a minute
	if ( window.wp && window.wp.heartbeat && window.wp.heartbeat.interval() > 30 ) {
		window.wp.heartbeat.interval( 30 );
	}
}

window.allcNotify = { update };
