// Browser storage, wrapped: private windows and blocked storage must not break the chat.

const TOKEN = 'allc_token';
const PAGES = 'allc_pages';
const SEEN = 'allc_seen';
const OPEN = 'allc_open';
const TOKEN_DAYS = 30;
// the page list belongs to one visit: after 30 quiet minutes it starts over
const VISIT_MS = 30 * 60000;

const read = ( area, key ) => {
	try {
		return window[ area ].getItem( key );
	} catch ( e ) {
		return null;
	}
};

const write = ( area, key, value ) => {
	try {
		if ( value === null ) {
			window[ area ].removeItem( key );
		} else {
			window[ area ].setItem( key, value );
		}
	} catch ( e ) {}
};

const json = ( value, fallback ) => {
	try {
		return JSON.parse( value ) ?? fallback;
	} catch ( e ) {
		return fallback;
	}
};

export const store = {
	token() {
		const saved = json( read( 'localStorage', TOKEN ), null );
		if ( ! saved || ! /^[a-f0-9]{64}$/.test( saved.t ) || Date.now() - saved.at > TOKEN_DAYS * 864e5 ) {
			if ( saved ) {
				this.clearToken();
			}
			return '';
		}
		return saved.t;
	},
	setToken( token ) {
		write( 'localStorage', TOKEN, JSON.stringify( { t: token, at: Date.now() } ) );
	},
	clearToken() {
		write( 'localStorage', TOKEN, null );
		write( 'localStorage', SEEN, null );
	},
	seen() {
		return parseInt( read( 'localStorage', SEEN ), 10 ) || 0;
	},
	setSeen( id ) {
		write( 'localStorage', SEEN, String( id ) );
	},
	isOpen() {
		return read( 'sessionStorage', OPEN ) === '1';
	},
	setOpen( open ) {
		write( 'sessionStorage', OPEN, open ? '1' : null );
	},
	once( key ) {
		if ( read( 'sessionStorage', key ) ) {
			return false;
		}
		write( 'sessionStorage', key, '1' );
		return true;
	},
	// the last pages of this visit stay in the visitor's browser; they reach the server only with a chat
	pages() {
		const saved = json( read( 'localStorage', PAGES ), null );
		return saved && Array.isArray( saved.pages ) && Date.now() - saved.at < VISIT_MS ? saved.pages : [];
	},
	addPage( page ) {
		const pages = this.pages().filter( ( p ) => p && p.url !== page.url );
		pages.push( page );
		write( 'localStorage', PAGES, JSON.stringify( { at: Date.now(), pages: pages.slice( -10 ) } ) );
	},
};

export const currentPage = () => ( {
	// no query string: it can hold order keys, reset links or search terms
	url: window.location.origin + window.location.pathname,
	title: document.title.slice( 0, 200 ),
	time: Math.round( Date.now() / 1000 ),
} );
