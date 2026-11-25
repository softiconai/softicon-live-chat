import { h, svg, clear, linkify, nextId } from './dom';
import { icons, channelIcon } from './icons';
import { store, currentPage } from './storage';

// polling, in ms: fast while a chat is active, slower when quiet, closed or hidden
const FAST = 3000;
const QUIET = 15000;
const CLOSED = 30000;
const HIDDEN = 60000;
const ENDED = 60000;
const RETRY = 10000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not(.allc_hp), select:not([disabled]), textarea:not([disabled])';
const isPhone = () => window.matchMedia( '(max-width: 480px)' ).matches;

const SAMPLE = ( t ) => [
	{ id: 1, type: 'visitor', body: 'Hi! Do you ship to Canada?', time: ( Date.now() / 1000 ) - 120 },
	{ id: 2, type: 'agent', name: 'Sam', body: t.greeting, time: ( Date.now() / 1000 ) - 60 },
];

let audio = null;
const beep = () => {
	try {
		if ( ! audio || audio.state !== 'running' ) {
			return;
		}
		const osc = audio.createOscillator();
		const gain = audio.createGain();
		osc.frequency.value = 880;
		gain.gain.setValueAtTime( 0.0001, audio.currentTime );
		gain.gain.exponentialRampToValueAtTime( 0.12, audio.currentTime + 0.02 );
		gain.gain.exponentialRampToValueAtTime( 0.0001, audio.currentTime + 0.35 );
		osc.connect( gain ).connect( audio.destination );
		osc.start();
		osc.stop( audio.currentTime + 0.4 );
	} catch ( e ) {}
};
// browsers allow sound only after the visitor touched the page
export const unlockSound = () => {
	try {
		const Ctx = window.AudioContext || window.webkitAudioContext;
		audio = audio || ( Ctx ? new Ctx() : null );
		if ( audio && audio.state === 'suspended' ) {
			audio.resume();
		}
	} catch ( e ) {}
};

export const mountPanel = ( container, { cfg, api, mode = 'floating', onClose, onUnread, preview } ) => {
	const t = cfg.texts;
	const time = new Intl.DateTimeFormat( cfg.locale || undefined, { hour: 'numeric', minute: '2-digit' } );
	const st = {
		open: mode !== 'floating',
		online: preview ? preview.online : null,
		agents: [],
		me: null,
		conv: null,
		messages: [],
		lastId: 0,
		view: 'loading',
		unread: 0,
		pageSent: false,
		delay: FAST,
		timer: 0,
		statusTimer: 0,
		busy: false,
		lastTyping: 0,
		rated: false,
		destroyed: false,
	};

	// ---- frame ----
	const logo = cfg.logo ? h( 'img', { class: 'allc_logo', src: cfg.logo, alt: '' } ) : null;
	const statusText = h( 'span', { class: 'allc_statusText' } );
	const statusEl = h( 'div', { class: 'allc_status' }, h( 'span', { class: 'allc_dot', 'aria-hidden': 'true' } ), statusText );
	const menu = h( 'div', { class: 'allc_menu', hidden: true }, h( 'button', { type: 'button', class: 'allc_menuItem', onclick: () => askEnd() }, t.end ) );
	const menuBtn = h(
		'button',
		{
			type: 'button',
			class: 'allc_iconBtn',
			'aria-label': t.more,
			'aria-haspopup': 'true',
			'aria-expanded': 'false',
			hidden: true,
			onclick: () => toggleMenu( menu.hidden ),
		},
		svg( icons.more )
	);
	const toggleMenu = ( show ) => {
		menu.hidden = ! show;
		menuBtn.setAttribute( 'aria-expanded', show ? 'true' : 'false' );
	};
	const closeBtn = mode === 'floating'
		? h( 'button', { type: 'button', class: 'allc_iconBtn', 'aria-label': t.close, onclick: () => onClose && onClose() }, svg( icons.down ) )
		: null;
	const head = h(
		'div',
		{ class: 'allc_head' },
		logo,
		h( 'div', { class: 'allc_headText' }, h( 'div', { class: 'allc_title' }, t.title ), t.subtitle ? h( 'div', { class: 'allc_subtitle' }, t.subtitle ) : null, statusEl ),
		h( 'div', { class: 'allc_headActions' }, menuBtn, menu, closeBtn )
	);
	const banner = h( 'div', { class: 'allc_banner', role: 'status', hidden: true }, t.offlineNet );
	const body = h( 'div', { class: 'allc_body' } );
	const foot = h( 'div', { class: 'allc_foot' } );
	const panel = h(
		'div',
		{
			class: `allc_panel allc_mode_${ mode }`,
			role: mode === 'floating' ? 'dialog' : 'region',
			'aria-label': t.title,
		},
		head,
		banner,
		body,
		foot
	);
	container.appendChild( panel );

	panel.addEventListener( 'keydown', ( e ) => {
		if ( e.key === 'Escape' && mode === 'floating' ) {
			if ( ! menu.hidden ) {
				toggleMenu( false );
				menuBtn.focus();
				return;
			}
			if ( onClose ) {
				onClose();
			}
		}
		// keep Tab inside the open floating panel
		if ( e.key === 'Tab' && mode === 'floating' ) {
			const items = [ ...panel.querySelectorAll( FOCUSABLE ) ].filter( ( el ) => ! el.closest( '[hidden]' ) );
			const active = panel.getRootNode().activeElement;
			if ( items.length && e.shiftKey && active === items[ 0 ] ) {
				e.preventDefault();
				items[ items.length - 1 ].focus();
			} else if ( items.length && ! e.shiftKey && active === items[ items.length - 1 ] ) {
				e.preventDefault();
				items[ 0 ].focus();
			}
		}
	} );
	panel.addEventListener( 'click', ( e ) => {
		if ( ! menu.hidden && ! menu.contains( e.target ) && ! menuBtn.contains( e.target ) ) {
			toggleMenu( false );
		}
	} );

	// ---- status line ----
	const renderStatus = () => {
		const online = st.online !== false;
		statusEl.classList.toggle( 'allc_isAway', ! online );
		let text = online ? t.online : t.away;
		if ( online && st.conv && st.conv.agent ) {
			text = st.conv.agent;
		} else if ( online && st.agents.length ) {
			text = `${ st.agents.join( ', ' ) } · ${ t.online }`;
		}
		if ( online && t.replyTime && ! ( st.conv && st.conv.agent ) ) {
			text += ` · ${ t.replyTime }`;
		}
		statusText.textContent = st.online === null ? '' : text;
	};

	const refreshStatus = async () => {
		if ( preview ) {
			return;
		}
		try {
			const s = await api.status();
			const changed = st.online !== s.online;
			st.online = !! s.online;
			st.agents = s.agents || [];
			st.me = s.me || null;
			renderStatus();
			// the form changes when the chat goes away or comes back
			if ( changed && st.view === 'form' ) {
				// keep what the visitor already typed
				const typed = {};
				body.querySelectorAll( '[name]' ).forEach( ( el ) => ( typed[ el.name ] = el.type === 'checkbox' ? el.checked : el.value ) );
				renderStart();
				body.querySelectorAll( '[name]' ).forEach( ( el ) => {
					if ( el.name !== 'website' && el.name in typed ) {
						el[ el.type === 'checkbox' ? 'checked' : 'value' ] = typed[ el.name ];
					}
				} );
			}
		} catch ( e ) {
			if ( st.online === null ) {
				st.online = true;
			}
		}
	};

	// ---- messages ----
	const bubble = ( m, extraClass = '' ) => {
		if ( m.type === 'system' ) {
			return h( 'div', { class: 'allc_system', 'data-id': m.id }, m.body );
		}
		const mine = m.type === 'visitor';
		return h(
			'div',
			{ class: `allc_msg ${ mine ? 'allc_mine' : 'allc_theirs' } ${ extraClass }`, 'data-id': m.id },
			! mine && m.name ? h( 'div', { class: 'allc_name' }, m.name ) : null,
			h( 'div', { class: 'allc_bubble' }, linkify( m.body ) ),
			m.time ? h( 'div', { class: 'allc_time' }, time.format( new Date( m.time * 1000 ) ) ) : null
		);
	};

	const log = h( 'div', { class: 'allc_log', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions' } );
	const typingEl = h( 'div', { class: 'allc_typing', role: 'status', hidden: true }, h( 'span' ), h( 'span' ), h( 'span' ), h( 'span', { class: 'allc_sr' }, t.typing ) );
	const seenEl = h( 'div', { class: 'allc_seen', hidden: true }, t.seen );

	const scrollDown = () => {
		body.scrollTop = body.scrollHeight;
	};

	const renderSeen = () => {
		const mine = [ ...st.messages ].reverse().find( ( m ) => m.type === 'visitor' );
		const show = !! ( mine && st.conv && st.conv.seen >= mine.id && st.messages[ st.messages.length - 1 ].id === mine.id );
		seenEl.hidden = ! show;
		if ( show ) {
			log.appendChild( seenEl );
		}
	};

	const isVisible = () => st.open && ! document.hidden;

	const countUnread = ( notify ) => {
		if ( isVisible() ) {
			if ( st.lastId > store.seen() ) {
				store.setSeen( st.lastId );
			}
			st.unread = 0;
		} else {
			const seen = store.seen();
			const before = st.unread;
			st.unread = st.messages.filter( ( m ) => m.type === 'agent' && m.id > seen ).length;
			if ( notify && st.unread > before ) {
				beep();
			}
		}
		if ( onUnread ) {
			onUnread( st.unread );
		}
	};

	// new data from the server: add only messages we do not have yet
	const apply = ( data, notify = true ) => {
		const prevStatus = st.conv && st.conv.status;
		st.conv = { ...( st.conv || {} ), ...data, messages: undefined };
		const fresh = ( data.messages || [] ).filter( ( m ) => m.id > st.lastId );
		fresh.forEach( ( m ) => {
			st.messages.push( m );
			if ( st.view === 'chat' ) {
				log.insertBefore( bubble( m ), typingEl );
			}
		} );
		if ( fresh.length ) {
			st.lastId = fresh[ fresh.length - 1 ].id;
		}
		if ( st.view === 'chat' ) {
			typingEl.hidden = ! data.typing;
			log.appendChild( typingEl );
			renderSeen();
			if ( fresh.length || data.typing ) {
				scrollDown();
			}
			if ( prevStatus && prevStatus !== data.status ) {
				renderFoot();
			}
		}
		renderStatus();
		countUnread( notify );
		return fresh.length > 0 || !! data.typing;
	};

	// ---- polling ----
	const nextDelay = () => {
		if ( document.hidden ) {
			return HIDDEN;
		}
		if ( st.conv && st.conv.status === 'closed' ) {
			// an ended chat is checked only while the panel is open; the agent's answer also goes by email
			return st.open ? ENDED : null;
		}
		return st.open ? st.delay : CLOSED;
	};

	const schedule = ( delay ) => {
		clearTimeout( st.timer );
		const wait = delay === undefined ? nextDelay() : delay;
		if ( preview || st.destroyed || ! store.token() || wait === null ) {
			return;
		}
		st.timer = setTimeout( tick, wait );
	};

	const setNet = ( ok ) => {
		banner.hidden = ok;
	};

	const tick = async () => {
		if ( st.busy ) {
			schedule( 1000 );
			return;
		}
		st.busy = true;
		try {
			const data = await api.sync( {
				after: st.lastId,
				open: isVisible(),
				page: st.pageSent ? undefined : currentPage(),
			} );
			st.pageSent = true;
			setNet( true );
			st.delay = apply( data ) ? FAST : Math.min( Math.round( st.delay * 1.3 ), QUIET );
		} catch ( e ) {
			if ( e.status === 404 ) {
				st.busy = false;
				reset();
				return;
			}
			setNet( e.status !== 429 ? false : true );
			st.delay = RETRY;
		}
		st.busy = false;
		schedule();
	};

	const onVisibility = () => {
		if ( ! document.hidden && store.token() ) {
			schedule( 0 );
		}
	};
	document.addEventListener( 'visibilitychange', onVisibility );

	// ---- views ----
	const greeting = () => h( 'div', { class: 'allc_msg allc_theirs allc_greeting' }, h( 'div', { class: 'allc_bubble' }, linkify( t.greeting ) ) );

	const channels = () => {
		const list = cfg.channels || [];
		if ( ! list.length || ( cfg.channelsMode === 'offline' && st.online !== false ) ) {
			return null;
		}
		const names = { whatsapp: t.whatsapp, messenger: t.messenger, telegram: t.telegram, phone: t.call, email: t.mail, link: t.link };
		return h(
			'div',
			{ class: 'allc_channels' },
			h( 'div', { class: 'allc_channelsLabel' }, t.orReach ),
			h(
				'div',
				{ class: 'allc_channelList' },
				list.map( ( c ) => h(
					'a',
					{
						class: `allc_channel allc_ch_${ c.type }`,
						href: c.url,
						target: c.type === 'phone' || c.type === 'email' ? undefined : '_blank',
						rel: 'noopener nofollow',
					},
					svg( channelIcon[ c.type ] || icons.link ),
					h( 'span', {}, c.label || names[ c.type ] )
				) )
			)
		);
	};

	const errorBox = () => h( 'div', { class: 'allc_error', id: nextId( 'error' ), role: 'alert', hidden: true } );
	const showError = ( box, text ) => {
		box.textContent = text || t.error;
		box.hidden = false;
	};

	const renderLoading = () => {
		st.view = 'loading';
		clear( body );
		clear( foot );
		body.appendChild( h( 'div', { class: 'allc_loading', 'aria-hidden': 'true' }, h( 'span' ), h( 'span' ), h( 'span' ) ) );
	};

	const started = ( data ) => {
		store.setToken( data.token );
		st.pageSent = true;
		st.messages = [];
		st.lastId = 0;
		apply( data, false );
		renderChat();
		if ( data.offline ) {
			log.insertBefore( h( 'div', { class: 'allc_system' }, t.sentAway ), typingEl );
		}
		st.delay = FAST;
		schedule();
	};

	// without the query string, like the pages
	const referrer = () => {
		try {
			const u = new URL( document.referrer );
			return u.origin + u.pathname;
		} catch ( e ) {
			return '';
		}
	};

	const startBody = ( fields, message, extra = {} ) => ( {
		fields,
		message,
		page: currentPage(),
		pages: store.pages(),
		referrer: referrer(),
		...extra,
	} );

	const renderForm = () => {
		st.view = 'form';
		clear( body );
		clear( foot );
		const shownAt = Date.now();
		const offline = st.online === false;
		const fields = [ ...( cfg.form ? cfg.fields : [] ) ];
		if ( offline && ! fields.some( ( f ) => f.type === 'email' ) ) {
			fields.push( { id: 'email', type: 'email', label: t.email, required: true, options: [] } );
		}
		const inputs = {};
		const err = errorBox();
		const form = h( 'form', { class: 'allc_form', novalidate: true } );

		fields.forEach( ( f ) => {
			const id = nextId( f.id );
			const required = f.required || ( offline && f.type === 'email' );
			let input;
			if ( f.type === 'textarea' ) {
				input = h( 'textarea', { id, name: f.id, rows: 2 } );
			} else if ( f.type === 'select' ) {
				input = h( 'select', { id, name: f.id }, h( 'option', { value: '' }, t.choose ), f.options.map( ( o ) => h( 'option', { value: o }, o ) ) );
			} else if ( f.type === 'checkbox' ) {
				input = h( 'input', { id, name: f.id, type: 'checkbox' } );
			} else {
				const types = { email: 'email', phone: 'tel' };
				const auto = { name: 'name', email: 'email', phone: 'tel' };
				input = h( 'input', { id, name: f.id, type: types[ f.type ] || 'text', autocomplete: auto[ f.type ] || 'off' } );
			}
			if ( required ) {
				input.setAttribute( 'aria-required', 'true' );
			}
			if ( st.me && ( f.type === 'name' || f.type === 'email' ) ) {
				input.value = st.me[ f.type ] || '';
			}
			inputs[ f.id ] = { input, f, required };
			const mark = required ? h( 'span', { class: 'allc_req', 'aria-hidden': 'true' }, ' *' ) : h( 'span', { class: 'allc_opt' }, ` (${ t.optional })` );
			form.appendChild(
				f.type === 'checkbox'
					? h( 'label', { class: 'allc_check' }, input, h( 'span', {}, f.label, mark ) )
					: h( 'div', { class: 'allc_field' }, h( 'label', { for: id }, f.label, mark ), input )
			);
		} );

		const msgId = nextId( 'message' );
		const message = h( 'textarea', { id: msgId, name: 'message', rows: 3, 'aria-required': 'true', maxlength: 2000 } );
		form.appendChild( h( 'div', { class: 'allc_field' }, h( 'label', { for: msgId }, t.message, h( 'span', { class: 'allc_req', 'aria-hidden': 'true' }, ' *' ) ), message ) );

		const consent = cfg.consent ? h( 'input', { type: 'checkbox', name: 'consent' } ) : null;
		if ( consent ) {
			form.appendChild( h( 'label', { class: 'allc_check allc_consent' }, consent, h( 'span', {}, linkify( t.consent ) ) ) );
		}
		// bots fill every field; people never see this one
		const trap = h( 'input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off', class: 'allc_hp', 'aria-hidden': 'true' } );
		const submit = h( 'button', { type: 'submit', class: 'allc_button' }, offline ? t.leave : t.start );
		form.append( trap, err, submit );

		form.addEventListener( 'submit', async ( e ) => {
			e.preventDefault();
			err.hidden = true;
			if ( preview ) {
				return;
			}
			const values = {};
			let bad = null;
			Object.values( inputs ).forEach( ( { input, f, required } ) => {
				let value = input.value.trim();
				if ( f.type === 'checkbox' ) {
					value = input.checked ? '1' : '';
				}
				values[ f.id ] = value;
				input.removeAttribute( 'aria-invalid' );
				input.removeAttribute( 'aria-describedby' );
				if ( ! bad && ( ( required && ! value ) || ( f.type === 'email' && value && ! EMAIL_RE.test( value ) ) ) ) {
					bad = { input, text: f.type === 'email' && value ? t.invalidEmail : t.requiredField.replace( '%s', f.label ) };
				}
			} );
			if ( ! bad && ! message.value.trim() ) {
				bad = { input: message, text: t.requiredField.replace( '%s', t.message ) };
			}
			if ( ! bad && consent && ! consent.checked ) {
				bad = { input: consent, text: t.acceptConsent };
			}
			if ( bad ) {
				bad.input.setAttribute( 'aria-invalid', 'true' );
				bad.input.setAttribute( 'aria-describedby', err.id );
				showError( err, bad.text );
				bad.input.focus();
				return;
			}
			submit.disabled = true;
			try {
				started( await api.start( startBody( values, message.value.trim(), { consent: consent ? consent.checked : false, website: trap.value, elapsed: Date.now() - shownAt } ) ) );
			} catch ( ex ) {
				submit.disabled = false;
				showError( err, ex.message );
				const field = ex.field && ( inputs[ ex.field ] ? inputs[ ex.field ].input : ex.field === 'message' && message );
				if ( field ) {
					field.setAttribute( 'aria-invalid', 'true' );
					field.focus();
				}
			}
		} );

		body.append(
			h( 'div', { class: 'allc_log' }, greeting(), offline ? h( 'div', { class: 'allc_notice' }, linkify( t.offline ) ) : null ),
			form
		);
		const more = channels();
		if ( more ) {
			foot.appendChild( more );
		}
		foot.hidden = ! more;
	};

	const composer = () => {
		const err = errorBox();
		const input = h( 'textarea', { class: 'allc_input', rows: 1, placeholder: t.placeholder, 'aria-label': t.message, maxlength: 2000 } );
		const send = h( 'button', { type: 'submit', class: 'allc_send', 'aria-label': t.send }, svg( icons.send ) );
		const form = h( 'form', { class: 'allc_composer' }, input, send );
		const shownAt = Date.now();

		const grow = () => {
			input.style.height = 'auto';
			input.style.height = Math.min( input.scrollHeight, 120 ) + 'px';
		};
		input.addEventListener( 'input', () => {
			grow();
			if ( st.conv && ! preview && Date.now() - st.lastTyping > 4000 ) {
				st.lastTyping = Date.now();
				api.typing().catch( () => {} );
			}
		} );
		input.addEventListener( 'keydown', ( e ) => {
			if ( e.key === 'Enter' && ! e.shiftKey && ! e.isComposing ) {
				e.preventDefault();
				if ( form.requestSubmit ) {
					form.requestSubmit();
				} else {
					form.dispatchEvent( new Event( 'submit', { cancelable: true } ) );
				}
			}
		} );
		form.addEventListener( 'submit', async ( e ) => {
			e.preventDefault();
			const text = input.value.trim();
			if ( ! text || preview || send.disabled ) {
				return;
			}
			err.hidden = true;
			send.disabled = true;
			const pending = bubble( { id: 0, type: 'visitor', body: text }, 'allc_pending' );
			pending.setAttribute( 'aria-hidden', 'true' );
			log.insertBefore( pending, typingEl );
			scrollDown();
			input.value = '';
			grow();
			try {
				if ( st.conv ) {
					const data = await api.send( { message: text, after: st.lastId } );
					pending.remove();
					apply( data, false );
					st.delay = FAST;
					schedule();
				} else {
					pending.remove();
					started( await api.start( startBody( {}, text, { elapsed: Date.now() - shownAt } ) ) );
				}
			} catch ( ex ) {
				pending.remove();
				input.value = text;
				grow();
				showError( err, ex.message );
			}
			send.disabled = false;
			input.focus();
		} );
		return h( 'div', {}, err, form );
	};

	const ratingBox = () => {
		const canRate = cfg.rating && ! ( st.conv && st.conv.rated ) && ! st.rated;
		// the server sends a copy only of a chat an agent answered
		const canCopy = cfg.transcript && st.conv && st.conv.hasEmail && st.conv.agent && ! st.rated;
		const box = h( 'div', { class: 'allc_ended' }, h( 'p', { class: 'allc_endedText' }, t.ended ) );
		if ( canRate || canCopy ) {
			let rating = 0;
			const pick = ( value, btn ) => {
				rating = value;
				[ good, bad ].forEach( ( b ) => b.setAttribute( 'aria-pressed', b === btn ? 'true' : 'false' ) );
			};
			const good = h( 'button', { type: 'button', class: 'allc_rate', 'aria-pressed': 'false', onclick: () => pick( 1, good ) }, svg( icons.good ), h( 'span', {}, t.good ) );
			const bad = h( 'button', { type: 'button', class: 'allc_rate', 'aria-pressed': 'false', onclick: () => pick( -1, bad ) }, svg( icons.bad ), h( 'span', {}, t.bad ) );
			const note = canRate ? h( 'textarea', { class: 'allc_note', rows: 2, placeholder: t.comment, 'aria-label': t.comment, maxlength: 500 } ) : null;
			const copy = canCopy ? h( 'input', { type: 'checkbox' } ) : null;
			const err = errorBox();
			const submit = h( 'button', { type: 'button', class: 'allc_button' }, t.submit );
			submit.addEventListener( 'click', async () => {
				if ( preview ) {
					return;
				}
				submit.disabled = true;
				try {
					await api.rate( { rating, note: note ? note.value : '', transcript: copy ? copy.checked : false } );
					st.rated = true;
					renderFoot();
					foot.querySelector( '.allc_endedText' ).textContent = t.thanks;
				} catch ( ex ) {
					submit.disabled = false;
					showError( err, ex.message );
				}
			} );
			box.append(
				canRate ? h( 'p', { class: 'allc_rateAsk' }, t.rate ) : null,
				canRate ? h( 'div', { class: 'allc_rateRow' }, good, bad ) : null,
				note,
				copy ? h( 'label', { class: 'allc_check' }, copy, h( 'span', {}, t.transcript ) ) : null,
				err,
				submit
			);
		}
		box.appendChild( h( 'button', { type: 'button', class: 'allc_link', onclick: () => newChat() }, t.newChat ) );
		return box;
	};

	const renderFoot = () => {
		clear( foot );
		foot.hidden = false;
		const ended = st.conv && st.conv.status === 'closed';
		menuBtn.hidden = ! st.conv || ended || !! preview;
		if ( ended ) {
			foot.appendChild( ratingBox() );
			return;
		}
		// before the first message (no form) and in an offline chat; channels() itself applies "only when offline"
		if ( ! st.conv || st.conv.offline ) {
			const more = channels();
			if ( more ) {
				foot.appendChild( more );
			}
		}
		foot.appendChild( composer() );
	};

	const renderChat = () => {
		st.view = 'chat';
		clear( body );
		clear( log );
		log.appendChild( greeting() );
		st.messages.forEach( ( m ) => log.appendChild( bubble( m ) ) );
		typingEl.hidden = true;
		log.appendChild( typingEl );
		body.appendChild( log );
		renderSeen();
		renderFoot();
		scrollDown();
	};

	const renderStart = () => {
		// the form also carries the privacy checkbox, so it shows whenever consent is needed
		if ( cfg.form || cfg.consent || st.online === false ) {
			renderForm();
		} else {
			st.messages = [];
			st.lastId = 0;
			renderChat();
		}
	};

	const askEnd = () => {
		toggleMenu( false );
		clear( foot );
		const yes = h( 'button', { type: 'button', class: 'allc_button' }, t.yes );
		const no = h( 'button', { type: 'button', class: 'allc_link', onclick: () => renderFoot() }, t.no );
		yes.addEventListener( 'click', async () => {
			yes.disabled = true;
			try {
				apply( await api.end( { after: st.lastId } ), false );
				renderFoot();
			} catch ( ex ) {
				renderFoot();
			}
		} );
		foot.appendChild( h( 'div', { class: 'allc_confirm' }, h( 'p', {}, t.endAsk ), h( 'div', { class: 'allc_row' }, yes, no ) ) );
		yes.focus();
	};

	const reset = () => {
		clearTimeout( st.timer );
		store.clearToken();
		st.conv = null;
		st.messages = [];
		st.lastId = 0;
		st.rated = false;
		st.unread = 0;
		if ( onUnread ) {
			onUnread( 0 );
		}
		menuBtn.hidden = true;
		renderStatus();
		renderStart();
	};

	const newChat = () => {
		reset();
		focusFirst();
	};

	const focusFirst = () => {
		// on a phone an input would pop up the keyboard over the panel, so focus goes to the close button there
		const target = ( ! isPhone() && panel.querySelector( '.allc_body input:not(.allc_hp), .allc_body select, .allc_body textarea, .allc_foot textarea' ) ) || closeBtn;
		if ( target ) {
			target.focus( { preventScroll: true } );
		}
	};

	// ---- start ----
	const init = async () => {
		if ( preview ) {
			st.online = preview.online;
			renderStatus();
			if ( preview.sample ) {
				st.conv = { status: 'open', agent: 'Sam', seen: 0 };
				st.messages = SAMPLE( t );
				renderChat();
			} else {
				renderStart();
			}
			return;
		}
		renderLoading();
		const status = refreshStatus();
		if ( store.token() ) {
			try {
				const data = await api.sync( { after: 0, open: isVisible(), page: currentPage() } );
				st.pageSent = true;
				apply( data, false );
			} catch ( e ) {
				if ( e.status === 404 ) {
					store.clearToken();
				}
			}
		}
		await status;
		if ( st.destroyed ) {
			return;
		}
		if ( st.conv ) {
			renderChat();
			schedule();
		} else {
			renderStart();
		}
	};
	init();

	return {
		open() {
			st.open = true;
			unlockSound();
			countUnread( false );
			if ( ! preview ) {
				refreshStatus();
				clearInterval( st.statusTimer );
				st.statusTimer = setInterval( () => ! document.hidden && refreshStatus(), 60000 );
			}
			if ( st.conv ) {
				st.delay = FAST;
				schedule( 0 );
			}
			scrollDown();
			if ( mode === 'floating' ) {
				// full screen on a phone: the page behind is out of reach
				panel.setAttribute( 'aria-modal', isPhone() ? 'true' : 'false' );
				setTimeout( focusFirst, 50 );
			}
		},
		close() {
			st.open = false;
			clearInterval( st.statusTimer );
			schedule();
		},
		destroy() {
			st.destroyed = true;
			clearTimeout( st.timer );
			clearInterval( st.statusTimer );
			document.removeEventListener( 'visibilitychange', onVisibility );
			panel.remove();
		},
	};
};
