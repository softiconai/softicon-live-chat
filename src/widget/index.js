import './public-path';
import './widget.scss';
import { createShell } from './shell';
import { createApi } from './api';
import { store, currentPage } from './storage';

// The small part every page loads: the corner button and the boot logic. The chat panel is a separate
// chunk, loaded on the first click, or at idle when this visitor already has a chat going.

const readConfig = () => {
	const el = document.querySelector( 'script#allc-config[type="application/json"]' );
	try {
		return el ? JSON.parse( el.textContent ) : null;
	} catch ( e ) {
		return null;
	}
};

const loadPanel = () => import( /* webpackChunkName: "panel" */ './panel' );

const idle = ( fn ) => ( window.requestIdleCallback ? window.requestIdleCallback( fn, { timeout: 3000 } ) : setTimeout( fn, 1500 ) );

const boot = () => {
	const cfg = readConfig();
	// === true: an element with id="allcBooted" in post content would also be a truthy window.allcBooted
	if ( ! cfg || window.allcBooted === true ) {
		return;
	}
	window.allcBooted = true;

	store.addPage( currentPage() );
	const api = createApi( cfg.rest );
	const originalTitle = document.title;

	const showTitleCount = ( count ) => {
		document.title = count && document.hidden ? `(${ count }) ${ originalTitle }` : originalTitle;
	};

	// the chat inside a page (block, shortcode); it replaces the corner button on that page
	const inline = [ ...document.querySelectorAll( '[data-allc-inline]' ) ].slice( 0, 1 );
	inline.forEach( ( host ) => {
		const noscript = host.querySelector( 'noscript' );
		if ( noscript ) {
			noscript.remove();
		}
		const shell = createShell( host, cfg, { floating: false } );
		loadPanel().then( ( { mountPanel } ) => {
			mountPanel( shell.slot, { cfg, api, mode: 'inline', onUnread: showTitleCount } ).open();
		} );
	} );

	const mobile = window.matchMedia( '(max-width: 767px)' ).matches;
	const deviceOk = cfg.devices === 'all' || ( cfg.devices === 'mobile' ? mobile : ! mobile );
	if ( inline.length || ! cfg.floating || ! deviceOk ) {
		return;
	}

	const host = document.createElement( 'div' );
	host.id = 'allc-chat';
	document.body.appendChild( host );

	let panel = null;
	let loading = null;
	let open = false;

	const ensurePanel = () => {
		if ( ! loading ) {
			loading = loadPanel().then( ( { mountPanel } ) => {
				panel = mountPanel( shell.slot, {
					cfg,
					api,
					mode: 'floating',
					onClose: () => setOpen( false, true ),
					onUnread: ( count ) => {
						shell.setBadge( count );
						showTitleCount( count );
					},
				} );
				return panel;
			} );
		}
		return loading;
	};

	const setOpen = ( value, returnFocus = false ) => {
		open = value;
		store.setOpen( value );
		shell.setOpen( value );
		// full screen on phones (up to 480px, like the panel's CSS): the page behind must not scroll
		document.documentElement.style.overflow = value && window.matchMedia( '(max-width: 480px)' ).matches ? 'hidden' : '';
		ensurePanel().then( ( p ) => ( value ? p.open() : p.close() ) );
		if ( ! value && returnFocus ) {
			shell.button.focus();
		}
	};

	const shell = createShell( host, cfg, { floating: true, onToggle: () => setOpen( ! open, ! open ) } );

	document.addEventListener( 'visibilitychange', () => ! document.hidden && showTitleCount( 0 ) );

	// any link to #live-chat, or with the class allc-open, opens the chat
	document.addEventListener( 'click', ( e ) => {
		const link = e.target.closest && e.target.closest( 'a[href$="#live-chat"], .allc-open' );
		if ( link ) {
			e.preventDefault();
			setOpen( true );
		}
	} );

	if ( window.location.hash === '#live-chat' || ( store.isOpen() && ! mobile ) ) {
		setOpen( true );
	} else if ( store.token() ) {
		idle( ensurePanel );
	} else if ( cfg.autoOpen > 0 && ! mobile ) {
		setTimeout( () => ! open && store.once( 'allc_auto' ) && setOpen( true ), cfg.autoOpen * 1000 );
	}
};

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', boot );
} else {
	boot();
}
