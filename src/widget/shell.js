import { h, svg, onColor } from './dom';
import { icons } from './icons';

// A shadow root with our stylesheet, so theme CSS stays out and ours stays in.
// floating: the corner launcher plus a slot for the panel; otherwise the slot is the whole box.
// preview: inside the settings page, positioned in its box instead of the window
export const createShell = ( host, cfg, { floating = true, onToggle, preview = false } = {} ) => {
	const root = host.shadowRoot || host.attachShadow( { mode: 'open' } );
	host.style.visibility = 'hidden';

	const link = h( 'link', { rel: 'stylesheet', href: cfg.css } );
	link.addEventListener( 'load', () => ( host.style.visibility = '' ) );

	const wrap = h( 'div', {
		class: [ 'allc_w', floating ? 'allc_floating' : 'allc_embedded', `allc_${ cfg.position === 'left' ? 'left' : 'right' }`, `allc_${ cfg.size === 'compact' ? 'compact' : 'normal' }`, preview ? 'allc_preview' : '' ].join( ' ' ),
	} );
	wrap.style.setProperty( '--allc-color', cfg.color || '#2563eb' );
	wrap.style.setProperty( '--allc-on', onColor( cfg.color || '#2563eb' ) );
	wrap.style.setProperty( '--allc-x', ( parseInt( cfg.offsetX, 10 ) || 0 ) + 'px' );
	wrap.style.setProperty( '--allc-y', ( parseInt( cfg.offsetY, 10 ) || 0 ) + 'px' );

	root.append( link, wrap );

	if ( ! floating ) {
		return { root, wrap, slot: wrap };
	}

	const slot = h( 'div', { class: 'allc_slot', hidden: true } );
	const badge = h( 'span', { class: 'allc_badge', hidden: true, 'aria-hidden': 'true' } );
	const label = cfg.texts.launcher ? h( 'span', { class: 'allc_launcherText' }, cfg.texts.launcher ) : null;
	const iconBox = h( 'span', { class: 'allc_launcherIcon' }, svg( icons[ cfg.icon ] || icons.chat ), svg( icons.down, 'allc_svg allc_closeIcon' ) );
	const button = h(
		'button',
		{
			type: 'button',
			class: 'allc_launcher' + ( label ? ' allc_hasText' : '' ),
			'aria-label': cfg.texts.open,
			'aria-expanded': 'false',
			onclick: () => onToggle && onToggle(),
		},
		iconBox,
		label,
		badge
	);
	wrap.append( slot, button );

	return {
		root,
		wrap,
		slot,
		button,
		setOpen( open ) {
			slot.hidden = ! open;
			wrap.classList.toggle( 'allc_isOpen', open );
			button.setAttribute( 'aria-expanded', open ? 'true' : 'false' );
			button.setAttribute( 'aria-label', open ? cfg.texts.close : cfg.texts.open );
		},
		setBadge( count ) {
			badge.hidden = ! count;
			badge.textContent = count > 9 ? '9+' : String( count );
			button.setAttribute( 'aria-label', count ? cfg.texts.unread.replace( '%d', count ) : cfg.texts.open );
		},
	};
};
