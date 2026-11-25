import { useEffect, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { createShell } from '../../widget/shell';
import { mountPanel } from '../../widget/panel';

const data = window.allcData || {};
const LABELS = {
	name: __( 'Name', 'softicon-live-chat' ),
	email: __( 'Email', 'softicon-live-chat' ),
	phone: __( 'Phone', 'softicon-live-chat' ),
};

// the same config the site gets from PHP (Widget::config), built from the unsaved settings
export const previewConfig = ( s, logo ) => {
	const dt = data.defaultTexts || {};
	return {
		css: data.widgetCss,
		color: s.color,
		position: s.position,
		offsetX: 16,
		offsetY: 16,
		size: s.size,
		icon: s.icon,
		logo,
		form: s.form_enabled,
		fields: s.fields.map( ( f ) => ( {
			...f,
			label: f.label || LABELS[ f.type ] || f.id,
			options: ( f.options || '' ).split( '\n' ).map( ( o ) => o.trim() ).filter( Boolean ),
		} ) ),
		consent: s.consent,
		channels: s.channels.map( ( c ) => ( { type: c.type, label: c.label, url: '#' } ) ),
		channelsMode: s.channels_mode,
		rating: s.rating,
		transcript: s.transcript,
		locale: data.locale,
		texts: {
			...data.texts,
			title: s.title || dt.title,
			subtitle: s.subtitle,
			greeting: s.greeting || dt.greeting,
			offline: s.offline_text || dt.offline,
			replyTime: s.reply_time,
			launcher: s.launcher_text,
			consent: s.consent_text || dt.consent,
		},
	};
};

// The real widget code in a box, fed the unsaved settings. Nothing is sent anywhere.
export default function Preview( { settings, logo } ) {
	const host = useRef();
	const [ mode, setMode ] = useState( 'form' );

	useEffect( () => {
		const el = host.current;
		const timer = setTimeout( () => {
			if ( el.shadowRoot ) {
				el.shadowRoot.replaceChildren();
			}
			const cfg = previewConfig( settings, logo );
			const shell = createShell( el, cfg, { floating: true, preview: true, onToggle: () => {} } );
			shell.setOpen( true );
			el.allcPanel = mountPanel( shell.slot, {
				cfg,
				api: null,
				mode: 'floating',
				preview: { online: mode !== 'offline', sample: mode === 'chat' },
			} );
		}, 120 );
		return () => {
			clearTimeout( timer );
			if ( el.allcPanel ) {
				el.allcPanel.destroy();
				el.allcPanel = null;
			}
		};
	}, [ settings, logo, mode ] );

	const modes = [
		{ value: 'form', label: __( 'Start', 'softicon-live-chat' ) },
		{ value: 'chat', label: __( 'Chat', 'softicon-live-chat' ) },
		{ value: 'offline', label: __( 'Offline', 'softicon-live-chat' ) },
	];

	return (
		<div className="allcPreview">
			<div className="allcPreviewBar" role="group" aria-label={ __( 'Preview', 'softicon-live-chat' ) }>
				<strong>{ __( 'Preview', 'softicon-live-chat' ) }</strong>
				{ modes.map( ( m ) => (
					<button key={ m.value } type="button" className={ mode === m.value ? 'isActive' : '' } aria-pressed={ mode === m.value } onClick={ () => setMode( m.value ) }>
						{ m.label }
					</button>
				) ) }
			</div>
			<div className="allcPreviewStage">
				<div ref={ host } className="allcPreviewHost" />
			</div>
		</div>
	);
}
