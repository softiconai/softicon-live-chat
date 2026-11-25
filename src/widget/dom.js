// Tiny DOM helpers. Text always goes in as text nodes, never as HTML.

const SVG_NS = 'http://www.w3.org/2000/svg';

export const h = ( tag, attrs = {}, ...children ) => {
	const el = document.createElement( tag );
	Object.entries( attrs || {} ).forEach( ( [ key, value ] ) => {
		if ( value === undefined || value === null || value === false ) {
			return;
		}
		if ( key.startsWith( 'on' ) && typeof value === 'function' ) {
			el.addEventListener( key.slice( 2 ).toLowerCase(), value );
		} else if ( key === 'class' ) {
			el.className = value;
		} else if ( key === 'value' || key === 'checked' || key === 'disabled' || key === 'hidden' || key === 'required' ) {
			el[ key ] = value;
		} else {
			el.setAttribute( key, value === true ? '' : value );
		}
	} );
	append( el, children );
	return el;
};

export const append = ( el, children ) => {
	children.flat( Infinity ).forEach( ( child ) => {
		if ( child === null || child === undefined || child === false || child === '' ) {
			return;
		}
		el.appendChild( typeof child === 'string' || typeof child === 'number' ? document.createTextNode( String( child ) ) : child );
	} );
	return el;
};

export const clear = ( el ) => {
	while ( el.firstChild ) {
		el.removeChild( el.firstChild );
	}
	return el;
};

export const svg = ( d, cls = 'allc_svg' ) => {
	const el = document.createElementNS( SVG_NS, 'svg' );
	el.setAttribute( 'viewBox', '0 0 24 24' );
	el.setAttribute( 'aria-hidden', 'true' );
	el.setAttribute( 'focusable', 'false' );
	el.setAttribute( 'class', cls );
	const path = document.createElementNS( SVG_NS, 'path' );
	path.setAttribute( 'd', d );
	path.setAttribute( 'fill', 'currentColor' );
	el.appendChild( path );
	return el;
};

const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]])/gi;

// a message as text nodes and links, line breaks kept by CSS (white-space: pre-wrap)
export const linkify = ( text ) => {
	const out = [];
	let last = 0;
	String( text ).replace( URL_RE, ( match, url, offset ) => {
		if ( offset > last ) {
			out.push( text.slice( last, offset ) );
		}
		const href = url.startsWith( 'www.' ) ? 'https://' + url : url;
		out.push( h( 'a', { href, target: '_blank', rel: 'noopener nofollow ugc' }, url ) );
		last = offset + match.length;
		return match;
	} );
	if ( last < text.length ) {
		out.push( text.slice( last ) );
	}
	return out;
};

// readable text on the accent color
export const onColor = ( hex ) => {
	const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec( String( hex ).length === 4 ? String( hex ).replace( /^#?(.)(.)(.)$/, '#$1$1$2$2$3$3' ) : hex );
	if ( ! m ) {
		return '#ffffff';
	}
	const [ r, g, b ] = m.slice( 1 ).map( ( v ) => {
		const c = parseInt( v, 16 ) / 255;
		return c <= 0.03928 ? c / 12.92 : Math.pow( ( c + 0.055 ) / 1.055, 2.4 );
	} );
	const lum = ( 0.2126 * r ) + ( 0.7152 * g ) + ( 0.0722 * b );
	return lum > 0.45 ? '#111827' : '#ffffff';
};

let uid = 0;
export const nextId = ( prefix ) => `allc-${ prefix }-${ ++uid }`;
