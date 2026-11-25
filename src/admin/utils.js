import { __ } from '@wordpress/i18n';
import { dateI18n, getSettings } from '@wordpress/date';

const data = window.allcData || {};
export const locale = data.locale || undefined;

const rtf = typeof Intl.RelativeTimeFormat === 'function' ? new Intl.RelativeTimeFormat( locale, { numeric: 'auto', style: 'short' } ) : null;
// times in the site's time zone and formats (Settings → General), not the browser's
const formats = getSettings().formats;
const clock = { format: ( d ) => dateI18n( formats.time, d ) };
const full = { format: ( d ) => dateI18n( formats.datetime, d ) };

export const ago = ( seconds, now = Date.now() / 1000 ) => {
	if ( ! seconds ) {
		return '';
	}
	const diff = Math.round( seconds - now );
	const abs = Math.abs( diff );
	if ( abs < 45 ) {
		return __( 'now', 'softicon-live-chat' );
	}
	if ( ! rtf ) {
		return full.format( new Date( seconds * 1000 ) );
	}
	if ( abs < 3600 ) {
		return rtf.format( Math.round( diff / 60 ), 'minute' );
	}
	if ( abs < 86400 ) {
		return rtf.format( Math.round( diff / 3600 ), 'hour' );
	}
	return rtf.format( Math.round( diff / 86400 ), 'day' );
};

export const clockTime = ( seconds ) => ( seconds ? clock.format( new Date( seconds * 1000 ) ) : '' );
export const fullTime = ( seconds ) => ( seconds ? full.format( new Date( seconds * 1000 ) ) : '' );

// "Chrome on Windows" from a user agent, good enough for a support chat
export const device = ( ua = '' ) => {
	const browser = [ [ /Edg\//, 'Edge' ], [ /OPR\//, 'Opera' ], [ /Firefox\//, 'Firefox' ], [ /SamsungBrowser/, 'Samsung Internet' ], [ /Chrome\//, 'Chrome' ], [ /Safari\//, 'Safari' ] ].find( ( [ re ] ) => re.test( ua ) );
	const os = [ [ /iPhone|iPad|iPod/, 'iOS' ], [ /Android/, 'Android' ], [ /Windows/, 'Windows' ], [ /Mac OS X|Macintosh/, 'macOS' ], [ /Linux/, 'Linux' ] ].find( ( [ re ] ) => re.test( ua ) );
	if ( ! browser && ! os ) {
		return ua;
	}
	return [ browser && browser[ 1 ], os && os[ 1 ] ].filter( Boolean ).join( ' · ' );
};

export const visitorName = ( chat ) => chat.name || chat.email || `${ __( 'Visitor', 'softicon-live-chat' ) } #${ chat.id }`;

export const initials = ( name = '' ) => name.trim().split( /\s+/ ).slice( 0, 2 ).map( ( w ) => w[ 0 ] ).join( '' ).toUpperCase() || '?';

// a stable soft color per visitor for the avatar circle
export const hue = ( id ) => ( ( Number( id ) || 0 ) * 47 ) % 360;
