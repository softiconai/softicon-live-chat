import { useState, useEffect, useRef, useCallback } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { addQueryArgs } from '@wordpress/url';
import { __, _n, sprintf } from '@wordpress/i18n';
import { Button, ExternalLink, Notice, Spinner } from '@wordpress/components';
import { chime } from '../sound';
import ChatList from './ChatList';
import Chat from './Chat';
import Visitor from './Visitor';
import Canned from './Canned';

export const NS = '/softicon-live-chat/v1';
const data = window.allcData || {};
const FAST = 3000;
const SLOW = 15000;
const baseTitle = document.title;

const chatFromHash = () => {
	const m = /#\/chat\/(\d+)/.exec( window.location.hash );
	return m ? Number( m[ 1 ] ) : 0;
};

// messages by id, in order, without duplicates
const merge = ( list = [], incoming = [] ) => {
	const byId = new Map( list.map( ( m ) => [ m.id, m ] ) );
	incoming.forEach( ( m ) => byId.set( m.id, m ) );
	return [ ...byId.values() ].sort( ( a, b ) => a.id - b.id );
};

const readSound = () => {
	try {
		return window.localStorage.getItem( 'allc_sound' ) !== '0';
	} catch ( e ) {
		return true;
	}
};

export default function Inbox() {
	const [ view, setView ] = useState( 'open' );
	const [ search, setSearch ] = useState( '' );
	const [ list, setList ] = useState( { items: [], total: 0 } );
	const [ counts, setCounts ] = useState( { waiting: 0, mine: 0, open: 0, unread: 0 } );
	const [ selected, setSelected ] = useState( chatFromHash() );
	const [ chat, setChat ] = useState( null );
	const [ status, setStatus ] = useState( 'online' );
	const [ loaded, setLoaded ] = useState( false );
	const [ error, setError ] = useState( '' );
	const [ sound, setSound ] = useState( readSound() );
	const [ permission, setPermission ] = useState( window.Notification ? window.Notification.permission : 'unsupported' );
	const [ canned, setCanned ] = useState( [] );
	const [ agents, setAgents ] = useState( [] );
	const [ cannedOpen, setCannedOpen ] = useState( false );
	const [ now, setNow ] = useState( Date.now() / 1000 );

	const ref = useRef( { busy: false, timer: 0, lastId: 0, chatId: 0, prevWaiting: null, prevUnread: null } );
	Object.assign( ref.current, { view, search, selected, sound } );

	const sync = useCallback( async () => {
		const r = ref.current;
		if ( r.busy ) {
			return;
		}
		r.busy = true;
		const chatId = r.selected;
		const after = chatId && r.chatId === chatId ? r.lastId : 0;
		try {
			const res = await apiFetch( {
				path: addQueryArgs( `${ NS }/agent/sync`, {
					view: r.view,
					search: r.search || undefined,
					chat: chatId || undefined,
					after,
					read: chatId && ! document.hidden && document.hasFocus() ? 1 : 0,
				} ),
			} );
			setError( '' );
			setLoaded( true );
			setNow( res.now );
			setCounts( res.counts );
			setList( res.list );
			setStatus( res.status );
			if ( window.allcNotify ) {
				window.allcNotify.update( res.counts );
			}

			const waiting = res.counts.waiting;
			const unread = res.counts.unread;
			if ( r.prevWaiting !== null && ( waiting > r.prevWaiting || unread > r.prevUnread ) ) {
				if ( r.sound ) {
					chime();
				}
				if ( ( document.hidden || ! document.hasFocus() ) && window.Notification && window.Notification.permission === 'granted' ) {
					// eslint-disable-next-line no-new
					new window.Notification( __( 'Live Chat', 'softicon-live-chat' ), {
						body: waiting > r.prevWaiting ? __( 'A new visitor is waiting for an answer.', 'softicon-live-chat' ) : __( 'New message from a visitor.', 'softicon-live-chat' ),
						tag: 'allc-inbox',
					} );
				}
			}
			r.prevWaiting = waiting;
			r.prevUnread = unread;
			document.title = ( waiting + unread ? `(${ waiting + unread }) ` : '' ) + baseTitle;

			if ( res.chat && res.chat.id === r.selected ) {
				const msgs = res.chat.messages;
				if ( after === 0 || r.chatId !== res.chat.id ) {
					r.chatId = res.chat.id;
					setChat( res.chat );
				} else {
					setChat( ( prev ) => ( prev && prev.id === res.chat.id ? { ...prev, ...res.chat, orders: prev.orders, messages: merge( prev.messages, msgs ) } : res.chat ) );
				}
				if ( msgs.length ) {
					r.lastId = Math.max( after, msgs[ msgs.length - 1 ].id );
				}
			} else if ( chatId && ! res.chat && chatId === r.selected ) {
				setChat( null );
				setSelected( 0 );
			}
		} catch ( e ) {
			setError( e.message || __( 'Could not reach the server. Retrying…', 'softicon-live-chat' ) );
		}
		r.busy = false;
	}, [] );

	const kick = useCallback(
		( delay = 0 ) => {
			const r = ref.current;
			clearTimeout( r.timer );
			r.timer = setTimeout( async () => {
				await sync();
				kick( document.hidden ? SLOW : FAST );
			}, delay );
		},
		[ sync ]
	);

	useEffect( () => {
		const r = ref.current;
		const onVisible = () => ! document.hidden && kick( 0 );
		document.addEventListener( 'visibilitychange', onVisible );
		window.addEventListener( 'focus', onVisible );
		apiFetch( { path: `${ NS }/agent/canned` } ).then( setCanned ).catch( () => {} );
		apiFetch( { path: `${ NS }/agent/agents` } ).then( setAgents ).catch( () => {} );
		return () => {
			clearTimeout( r.timer );
			document.removeEventListener( 'visibilitychange', onVisible );
			window.removeEventListener( 'focus', onVisible );
		};
	}, [ kick ] );

	// a new list or chat: load now (search waits for typing to pause)
	useEffect( () => {
		kick( search ? 300 : 0 );
	}, [ view, search, kick ] );

	useEffect( () => {
		const r = ref.current;
		if ( r.chatId !== selected ) {
			r.lastId = 0;
			r.chatId = 0;
			setChat( null );
		}
		const hash = selected ? `#/chat/${ selected }` : ' ';
		window.history.replaceState( null, '', window.location.pathname + window.location.search + hash.trim() );
		kick( 0 );
	}, [ selected, kick ] );

	useEffect( () => {
		const onHash = () => setSelected( chatFromHash() );
		window.addEventListener( 'hashchange', onHash );
		return () => window.removeEventListener( 'hashchange', onHash );
	}, [] );

	const post = async ( path, body = {} ) => {
		try {
			const res = await apiFetch( { path: `${ NS }${ path }`, method: 'POST', data: body } );
			kick( 0 );
			return res;
		} catch ( e ) {
			setError( e.message );
			throw e;
		}
	};

	const reply = async ( text, note ) => {
		const id = chat.id;
		const message = await post( `/agent/chats/${ id }/reply`, { message: text, note } );
		setChat( ( prev ) => ( prev && prev.id === id ? { ...prev, messages: merge( prev.messages, [ message ] ) } : prev ) );
	};

	const action = async ( name, body = {} ) => {
		if ( name === 'delete' ) {
			await apiFetch( { path: `${ NS }/agent/chats/${ chat.id }`, method: 'DELETE' } ).catch( ( e ) => setError( e.message ) );
			setSelected( 0 );
			kick( 0 );
			return;
		}
		await post( `/agent/chats/${ chat.id }/${ name }`, body );
	};

	const toggleStatus = async () => {
		const next = status === 'online' ? 'away' : 'online';
		setStatus( next );
		await post( '/agent/status', { status: next } ).catch( () => {} );
	};

	const toggleSound = () => {
		const next = ! sound;
		setSound( next );
		try {
			window.localStorage.setItem( 'allc_sound', next ? '1' : '0' );
		} catch ( e ) {}
		if ( next ) {
			chime();
		}
	};

	const askPermission = () => {
		window.Notification.requestPermission().then( setPermission );
	};

	return (
		<div className={ `allcInbox ${ selected ? 'allcHasChat' : '' }` }>
			<div className="allcTop">
				<h2 className="allcTopTitle">{ __( 'Live Chat', 'softicon-live-chat' ) }</h2>
				<button type="button" className={ `allcStatusBtn allcIs_${ status }` } onClick={ toggleStatus } aria-pressed={ status === 'online' }>
					<span className="allcStatusDot" />
					{ status === 'online' ? __( 'Online', 'softicon-live-chat' ) : __( 'Away', 'softicon-live-chat' ) }
				</button>
				<div className="allcTopTools">
					<Button variant="tertiary" onClick={ toggleSound } aria-pressed={ sound } icon={ sound ? 'controls-volumeon' : 'controls-volumeoff' }>
						{ sound ? __( 'Sound on', 'softicon-live-chat' ) : __( 'Sound off', 'softicon-live-chat' ) }
					</Button>
					{ permission === 'default' && (
						<Button variant="tertiary" icon="bell" onClick={ askPermission }>
							{ __( 'Turn on desktop notifications', 'softicon-live-chat' ) }
						</Button>
					) }
					<Button variant="tertiary" icon="text" onClick={ () => setCannedOpen( true ) }>
						{ __( 'Saved replies', 'softicon-live-chat' ) }
					</Button>
					{ data.canManage && (
						<Button variant="tertiary" icon="admin-generic" href={ data.settingsUrl }>
							{ __( 'Settings', 'softicon-live-chat' ) }
						</Button>
					) }
				</div>
			</div>
			{ status === 'away' && (
				<Notice status="warning" isDismissible={ false }>
					{ __( 'You are away. If no other agent is online, visitors see the offline form and their messages reach you by email.', 'softicon-live-chat' ) }
				</Notice>
			) }
			{ error && (
				<Notice status="error" isDismissible={ false }>
					{ error }
				</Notice>
			) }
			{ ! loaded ? (
				<div className="allcLoading">
					<Spinner />
				</div>
			) : (
				<div className="allcCols">
					<ChatList view={ view } setView={ setView } search={ search } setSearch={ setSearch } list={ list } counts={ counts } selected={ selected } onSelect={ setSelected } now={ now } />
					<div className="allcChatCol">
						{ chat ? (
							<Chat key={ chat.id } chat={ chat } now={ now } agents={ agents } canned={ canned } onReply={ reply } onAction={ action } onBack={ () => setSelected( 0 ) } />
						) : (
							<div className="allcEmpty">
								{ selected ? (
									<Spinner />
								) : (
									<>
										<span className="dashicons dashicons-format-chat" aria-hidden="true" />
										<p>{ counts.waiting ? sprintf( /* translators: %d: number of chats */ _n( '%d visitor is waiting. Pick a chat on the left.', '%d visitors are waiting. Pick a chat on the left.', counts.waiting, 'softicon-live-chat' ), counts.waiting ) : __( 'Pick a chat on the left. New chats show up here by themselves.', 'softicon-live-chat' ) }</p>
										{ data.videoUrl && <ExternalLink className="allcVideo" href={ data.videoUrl }>{ __( 'Video: how to answer chats', 'softicon-live-chat' ) }</ExternalLink> }
									</>
								) }
							</div>
						) }
					</div>
					{ chat && <Visitor chat={ chat } now={ now } /> }
				</div>
			) }
			{ cannedOpen && <Canned items={ canned } onClose={ () => setCannedOpen( false ) } onSaved={ setCanned } /> }
		</div>
	);
}
