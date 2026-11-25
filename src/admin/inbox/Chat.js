import { useState, useRef, useEffect, useLayoutEffect } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import { Button, CheckboxControl, Dropdown, MenuGroup, MenuItem } from '@wordpress/components';
import { clockTime, fullTime, ago, visitorName, initials, hue } from '../utils';

const data = window.allcData || {};
const NS = '/softicon-live-chat/v1';
const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]])/gi;

// message text with clickable links; React escapes every text part
const Text = ( { body } ) => {
	const parts = [];
	let last = 0;
	body.replace( URL_RE, ( match, url, offset ) => {
		if ( offset > last ) {
			parts.push( body.slice( last, offset ) );
		}
		parts.push(
			<a key={ offset } href={ url.startsWith( 'www.' ) ? `https://${ url }` : url } target="_blank" rel="noopener noreferrer nofollow">
				{ url }
			</a>
		);
		last = offset + match.length;
		return match;
	} );
	parts.push( body.slice( last ) );
	return <>{ parts }</>;
};

function Message( { m, seen } ) {
	if ( m.type === 'system' ) {
		return (
			<div className="allcSys">
				{ m.body } <span className="allcMsgTime">{ clockTime( m.time ) }</span>
			</div>
		);
	}
	const mine = m.type === 'agent' || m.type === 'note';
	return (
		<div className={ `allcMsg ${ mine ? 'isMine' : 'isTheirs' } ${ m.type === 'note' ? 'isNote' : '' }` }>
			{ m.type === 'note' && <div className="allcMsgLabel">{ sprintf( /* translators: %s: agent name */ __( 'Note by %s · only agents see this', 'softicon-live-chat' ), m.name || '' ) }</div> }
			{ m.type === 'agent' && m.user !== data.me && <div className="allcMsgLabel">{ m.name }</div> }
			<div className="allcBubble" title={ fullTime( m.time ) }>
				<Text body={ m.body } />
			</div>
			<div className="allcMsgTime">
				{ clockTime( m.time ) }
				{ seen && ` · ${ __( 'Seen', 'softicon-live-chat' ) }` }
			</div>
		</div>
	);
}

export default function Chat( { chat, now, agents, canned, onReply, onAction, onBack } ) {
	const [ text, setText ] = useState( '' );
	const [ note, setNote ] = useState( false );
	const [ sending, setSending ] = useState( false );
	const [ pick, setPick ] = useState( 0 );
	const scroller = useRef();
	const input = useRef();
	const stick = useRef( true );
	const lastTyping = useRef( 0 );

	const messages = chat.messages || [];
	const lastAgent = [ ...messages ].reverse().find( ( m ) => m.type === 'agent' );
	const online = now - chat.active < 60 && chat.status !== 'closed';

	// stay at the bottom while the agent is there; keep the place while they read older messages
	useLayoutEffect( () => {
		const el = scroller.current;
		if ( el && stick.current ) {
			el.scrollTop = el.scrollHeight;
		}
	}, [ messages.length, chat.typing ] );

	useEffect( () => {
		if ( input.current ) {
			input.current.focus();
		}
	}, [] );

	const onScroll = () => {
		const el = scroller.current;
		stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
	};

	// "/" opens the saved replies, filtered by what follows it
	const query = text.startsWith( '/' ) && ! text.includes( ' ' ) && ! text.includes( '\n' ) ? text.slice( 1 ).toLowerCase() : null;
	const matches = query === null ? [] : canned.filter( ( c ) => c.shortcut.includes( query ) || c.text.toLowerCase().includes( query ) ).slice( 0, 8 );

	const applyCanned = ( item ) => {
		setText( item.text );
		setPick( 0 );
		if ( input.current ) {
			input.current.focus();
		}
	};

	const send = async () => {
		const body = text.trim();
		if ( ! body || sending ) {
			return;
		}
		setSending( true );
		stick.current = true;
		try {
			await onReply( body, note );
			setText( '' );
			setNote( false );
		} catch ( e ) {}
		setSending( false );
		if ( input.current ) {
			input.current.focus();
		}
	};

	const onKeyDown = ( e ) => {
		if ( matches.length ) {
			if ( e.key === 'ArrowDown' || e.key === 'ArrowUp' ) {
				e.preventDefault();
				setPick( ( p ) => ( p + ( e.key === 'ArrowDown' ? 1 : matches.length - 1 ) ) % matches.length );
				return;
			}
			if ( e.key === 'Enter' || e.key === 'Tab' ) {
				e.preventDefault();
				applyCanned( matches[ Math.min( pick, matches.length - 1 ) ] );
				return;
			}
		}
		if ( e.key === 'Enter' && ! e.shiftKey && ! e.nativeEvent.isComposing ) {
			e.preventDefault();
			send();
		}
	};

	const onChange = ( e ) => {
		setText( e.target.value );
		setPick( 0 );
		if ( ! note && chat.status !== 'closed' && Date.now() - lastTyping.current > 4000 ) {
			lastTyping.current = Date.now();
			apiFetch( { path: `${ NS }/agent/chats/${ chat.id }/typing`, method: 'POST' } ).catch( () => {} );
		}
	};

	const others = agents.filter( ( a ) => a.id !== chat.agent );
	const mineNow = chat.agent === data.me;
	const name = visitorName( chat );

	return (
		<div className="allcChat">
			<div className="allcChatHead">
				<Button className="allcBack" icon="arrow-left-alt2" label={ __( 'Back to the list', 'softicon-live-chat' ) } onClick={ onBack } />
				<span className="allcAvatar" style={ { '--allc-hue': hue( chat.id ) } } aria-hidden="true">
					{ initials( name ) }
					{ online && <span className="allcOnline" /> }
				</span>
				<div className="allcChatWho">
					<div className="allcChatName">{ name }</div>
					<div className="allcChatSub">
						{ chat.status === 'closed' && __( 'Closed', 'softicon-live-chat' ) }
						{ chat.status !== 'closed' && ( online ? __( 'On the site now', 'softicon-live-chat' ) : sprintf( /* translators: %s: time, like "5 min. ago" */ __( 'Last seen %s', 'softicon-live-chat' ), ago( chat.active, now ) ) ) }
						{ chat.agentName && ` · ${ sprintf( /* translators: %s: agent name */ __( 'Agent: %s', 'softicon-live-chat' ), chat.agentName ) }` }
					</div>
				</div>
				<div className="allcChatActions">
					{ chat.status !== 'closed' && ! mineNow && (
						<Button variant="primary" onClick={ () => onAction( 'assign', { agent: 0 } ) }>
							{ chat.status === 'waiting' ? __( 'Take chat', 'softicon-live-chat' ) : __( 'Take over', 'softicon-live-chat' ) }
						</Button>
					) }
					{ chat.status !== 'closed' ? (
						<Button variant="secondary" onClick={ () => onAction( 'close' ) }>
							{ __( 'End chat', 'softicon-live-chat' ) }
						</Button>
					) : (
						<Button variant="secondary" onClick={ () => onAction( 'reopen' ) }>
							{ __( 'Reopen', 'softicon-live-chat' ) }
						</Button>
					) }
					<Dropdown
						popoverProps={ { placement: 'bottom-end' } }
						renderToggle={ ( { isOpen, onToggle } ) => <Button icon="ellipsis" label={ __( 'More', 'softicon-live-chat' ) } onClick={ onToggle } aria-expanded={ isOpen } /> }
						renderContent={ ( { onClose } ) => (
							<>
								{ others.length > 0 && chat.status !== 'closed' && (
									<MenuGroup label={ __( 'Transfer to', 'softicon-live-chat' ) }>
										{ others.map( ( a ) => (
											<MenuItem
												key={ a.id }
												onClick={ () => {
													onAction( 'assign', { agent: a.id } );
													onClose();
												} }
											>
												{ a.name }
												{ a.online ? ` (${ __( 'online', 'softicon-live-chat' ) })` : '' }
											</MenuItem>
										) ) }
									</MenuGroup>
								) }
								{ data.canManage && (
									<MenuGroup>
										<MenuItem
											isDestructive
											onClick={ () => {
												onClose();
												// eslint-disable-next-line no-alert
												if ( window.confirm( __( 'Delete this chat and all its messages? This cannot be undone.', 'softicon-live-chat' ) ) ) {
													onAction( 'delete' );
												}
											} }
										>
											{ __( 'Delete chat', 'softicon-live-chat' ) }
										</MenuItem>
									</MenuGroup>
								) }
							</>
						) }
					/>
				</div>
			</div>

			<div className="allcMessages" ref={ scroller } onScroll={ onScroll } role="log" aria-live="polite">
				{ messages.map( ( m ) => (
					<Message key={ m.id } m={ m } seen={ lastAgent && m.id === lastAgent.id && chat.visitorSeen >= m.id } />
				) ) }
				{ chat.typing && <div className="allcTyping">{ sprintf( /* translators: %s: visitor name */ __( '%s is typing…', 'softicon-live-chat' ), name ) }</div> }
			</div>

			<div className={ `allcComposer ${ note ? 'isNote' : '' }` }>
				{ matches.length > 0 && (
					<ul className="allcCanned" role="listbox" aria-label={ __( 'Saved replies', 'softicon-live-chat' ) }>
						{ matches.map( ( item, i ) => (
							<li key={ item.shortcut } role="option" aria-selected={ i === pick }>
								<button type="button" className={ i === pick ? 'isActive' : '' } onMouseDown={ ( e ) => e.preventDefault() } onClick={ () => applyCanned( item ) }>
									<strong>/{ item.shortcut }</strong> <span>{ item.text }</span>
								</button>
							</li>
						) ) }
					</ul>
				) }
				<textarea
					ref={ input }
					value={ text }
					onChange={ onChange }
					onKeyDown={ onKeyDown }
					rows={ 3 }
					maxLength={ 2000 }
					placeholder={ note ? __( 'Write a note for other agents…', 'softicon-live-chat' ) : __( 'Write a reply… (type / for saved replies)', 'softicon-live-chat' ) }
					aria-label={ note ? __( 'Note', 'softicon-live-chat' ) : __( 'Reply', 'softicon-live-chat' ) }
				/>
				<div className="allcComposerBar">
					<CheckboxControl __nextHasNoMarginBottom className="allcNoteToggle" label={ __( 'Private note', 'softicon-live-chat' ) } checked={ note } onChange={ setNote } />
					<span className="allcHint">{ __( 'Enter to send · Shift+Enter for a new line', 'softicon-live-chat' ) }</span>
					<Button variant="primary" onClick={ send } isBusy={ sending } disabled={ ! text.trim() || sending }>
						{ note ? __( 'Add note', 'softicon-live-chat' ) : __( 'Send', 'softicon-live-chat' ) }
					</Button>
				</div>
			</div>
		</div>
	);
}
