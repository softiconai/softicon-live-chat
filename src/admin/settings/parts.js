import { useState, useEffect } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { addQueryArgs } from '@wordpress/url';
import { __ } from '@wordpress/i18n';
import { Button, TextControl, TextareaControl, SelectControl, CheckboxControl, ToggleControl, Notice, Spinner } from '@wordpress/components';

const data = window.allcData || {};
const NS = '/softicon-live-chat/v1';

export const FIELD_TYPES = [
	{ value: 'name', label: __( 'Name', 'softicon-live-chat' ) },
	{ value: 'email', label: __( 'Email', 'softicon-live-chat' ) },
	{ value: 'phone', label: __( 'Phone', 'softicon-live-chat' ) },
	{ value: 'text', label: __( 'Short text', 'softicon-live-chat' ) },
	{ value: 'textarea', label: __( 'Long text', 'softicon-live-chat' ) },
	{ value: 'select', label: __( 'Dropdown', 'softicon-live-chat' ) },
	{ value: 'checkbox', label: __( 'Checkbox', 'softicon-live-chat' ) },
];

const move = ( list, from, to ) => {
	const next = [ ...list ];
	const [ item ] = next.splice( from, 1 );
	next.splice( to, 0, item );
	return next;
};

export function FieldsEditor( { fields, onChange } ) {
	const used = fields.map( ( f ) => f.type );
	const update = ( i, patch ) => onChange( fields.map( ( f, j ) => ( j === i ? { ...f, ...patch } : f ) ) );
	const add = ( type ) => {
		const id = [ 'name', 'email', 'phone' ].includes( type ) ? type : `f${ Date.now().toString( 36 ) }`;
		onChange( [ ...fields, { id, type, label: '', required: false, options: '' } ] );
	};
	const available = FIELD_TYPES.filter( ( t ) => ! [ 'name', 'email', 'phone' ].includes( t.value ) || ! used.includes( t.value ) );
	const [ next, setNext ] = useState( 'text' );
	const nextType = available.some( ( t ) => t.value === next ) ? next : available[ 0 ]?.value;

	return (
		<div className="allcFields">
			{ fields.length === 0 && <p className="allcMuted">{ __( 'No fields: visitors only write a message.', 'softicon-live-chat' ) }</p> }
			{ fields.map( ( f, i ) => (
				<div className="allcFieldRow" key={ f.id }>
					<div className="allcFieldType">{ FIELD_TYPES.find( ( t ) => t.value === f.type )?.label }</div>
					<TextControl
						__nextHasNoMarginBottom
						label={ __( 'Label', 'softicon-live-chat' ) }
						value={ f.label }
						placeholder={ FIELD_TYPES.find( ( t ) => t.value === f.type )?.label }
						onChange={ ( label ) => update( i, { label } ) }
					/>
					{ f.type === 'select' && (
						<TextareaControl
							__nextHasNoMarginBottom
							label={ __( 'Choices, one per line', 'softicon-live-chat' ) }
							value={ f.options }
							rows={ 3 }
							onChange={ ( options ) => update( i, { options } ) }
						/>
					) }
					<div className="allcFieldTools">
						<CheckboxControl __nextHasNoMarginBottom label={ __( 'Required', 'softicon-live-chat' ) } checked={ !! f.required } onChange={ ( required ) => update( i, { required } ) } />
						<Button icon="arrow-up-alt2" label={ __( 'Move up', 'softicon-live-chat' ) } disabled={ i === 0 } onClick={ () => onChange( move( fields, i, i - 1 ) ) } />
						<Button icon="arrow-down-alt2" label={ __( 'Move down', 'softicon-live-chat' ) } disabled={ i === fields.length - 1 } onClick={ () => onChange( move( fields, i, i + 1 ) ) } />
						<Button icon="trash" isDestructive label={ __( 'Remove', 'softicon-live-chat' ) } onClick={ () => onChange( fields.filter( ( _, j ) => j !== i ) ) } />
					</div>
				</div>
			) ) }
			{ fields.length < 12 && available.length > 0 && (
				<div className="allcAddRow">
					<SelectControl __nextHasNoMarginBottom label={ __( 'Add a field', 'softicon-live-chat' ) } value={ nextType } options={ available } onChange={ setNext } />
					<Button variant="secondary" icon="plus" onClick={ () => add( nextType ) }>
						{ __( 'Add', 'softicon-live-chat' ) }
					</Button>
				</div>
			) }
		</div>
	);
}

export const CHANNELS = [
	{ value: 'whatsapp', label: 'WhatsApp', help: __( 'Phone number with country code, for example +8801712345678', 'softicon-live-chat' ) },
	{ value: 'messenger', label: 'Messenger', help: __( 'Your Facebook page username, as in m.me/username', 'softicon-live-chat' ) },
	{ value: 'telegram', label: 'Telegram', help: __( 'Your Telegram username, without @', 'softicon-live-chat' ) },
	{ value: 'phone', label: __( 'Phone call', 'softicon-live-chat' ), help: __( 'Phone number with country code', 'softicon-live-chat' ) },
	{ value: 'email', label: __( 'Email', 'softicon-live-chat' ), help: __( 'Email address', 'softicon-live-chat' ) },
	{ value: 'link', label: __( 'Link', 'softicon-live-chat' ), help: __( 'Any web address, for example your contact page', 'softicon-live-chat' ) },
];

export function ChannelsEditor( { channels, onChange } ) {
	const update = ( i, patch ) => onChange( channels.map( ( c, j ) => ( j === i ? { ...c, ...patch } : c ) ) );
	return (
		<div className="allcChannelsEdit">
			{ channels.length === 0 && <p className="allcMuted">{ __( 'No buttons yet.', 'softicon-live-chat' ) }</p> }
			{ channels.map( ( c, i ) => {
				const meta = CHANNELS.find( ( x ) => x.value === c.type ) || CHANNELS[ 0 ];
				return (
					<div className="allcChannelRow" key={ i }>
						<SelectControl __nextHasNoMarginBottom label={ __( 'Type', 'softicon-live-chat' ) } value={ c.type } options={ CHANNELS } onChange={ ( type ) => update( i, { type } ) } />
						<TextControl __nextHasNoMarginBottom label={ meta.label } help={ meta.help } value={ c.value } onChange={ ( value ) => update( i, { value } ) } />
						<TextControl __nextHasNoMarginBottom label={ __( 'Button text (optional)', 'softicon-live-chat' ) } value={ c.label } placeholder={ meta.label } onChange={ ( label ) => update( i, { label } ) } />
						<Button icon="trash" isDestructive label={ __( 'Remove', 'softicon-live-chat' ) } onClick={ () => onChange( channels.filter( ( _, j ) => j !== i ) ) } />
					</div>
				);
			} ) }
			{ channels.length < 8 && (
				<Button variant="secondary" icon="plus" onClick={ () => onChange( [ ...channels, { type: 'whatsapp', label: '', value: '' } ] ) }>
					{ __( 'Add a button', 'softicon-live-chat' ) }
				</Button>
			) }
		</div>
	);
}

export function HoursEditor( { hours, onChange } ) {
	const dayName = new Intl.DateTimeFormat( data.locale, { weekday: 'long' } );
	// Monday first, as most of the world reads a week
	const order = [ 1, 2, 3, 4, 5, 6, 0 ];
	const update = ( day, patch ) => onChange( hours.map( ( h, i ) => ( i === day ? { ...h, ...patch } : h ) ) );
	return (
		<table className="allcHours">
			<tbody>
				{ order.map( ( day ) => {
					const h = hours[ day ];
					return (
						<tr key={ day }>
							<th scope="row">
								<CheckboxControl __nextHasNoMarginBottom label={ dayName.format( new Date( 2024, 0, 7 + day ) ) } checked={ !! h.on } onChange={ ( on ) => update( day, { on } ) } />
							</th>
							<td>
								<input type="time" value={ h.from } disabled={ ! h.on } aria-label={ __( 'From', 'softicon-live-chat' ) } onChange={ ( e ) => update( day, { from: e.target.value } ) } />
								<span aria-hidden="true">–</span>
								<input type="time" value={ h.to } disabled={ ! h.on } aria-label={ __( 'To', 'softicon-live-chat' ) } onChange={ ( e ) => update( day, { to: e.target.value } ) } />
							</td>
						</tr>
					);
				} ) }
			</tbody>
		</table>
	);
}

export function PagesPicker( { value, titles, onChange } ) {
	const [ search, setSearch ] = useState( '' );
	const [ results, setResults ] = useState( [] );
	const [ names, setNames ] = useState( () => Object.fromEntries( titles.map( ( p ) => [ p.id, p.title ] ) ) );

	useEffect( () => {
		if ( search.trim().length < 2 ) {
			setResults( [] );
			return;
		}
		const timer = setTimeout( () => {
			apiFetch( { path: addQueryArgs( '/wp/v2/search', { search, type: 'post', per_page: 10 } ) } )
				.then( setResults )
				.catch( () => setResults( [] ) );
		}, 300 );
		return () => clearTimeout( timer );
	}, [ search ] );

	const add = ( item ) => {
		setNames( { ...names, [ item.id ]: item.title } );
		if ( ! value.includes( item.id ) ) {
			onChange( [ ...value, item.id ] );
		}
		setSearch( '' );
	};

	return (
		<div className="allcPages">
			<div className="allcChips">
				{ value.map( ( id ) => (
					<span className="allcChip" key={ id }>
						{ names[ id ] || `#${ id }` }
						<Button icon="no-alt" size="small" label={ __( 'Remove', 'softicon-live-chat' ) } onClick={ () => onChange( value.filter( ( v ) => v !== id ) ) } />
					</span>
				) ) }
			</div>
			<TextControl __nextHasNoMarginBottom label={ __( 'Find a page or post', 'softicon-live-chat' ) } value={ search } onChange={ setSearch } placeholder={ __( 'Type at least 2 letters', 'softicon-live-chat' ) } />
			{ results.length > 0 && (
				<ul className="allcResults">
					{ results.map( ( item ) => (
						<li key={ item.id }>
							<button type="button" onClick={ () => add( item ) }>
								{ item.title || `#${ item.id }` } <span>{ item.subtype }</span>
							</button>
						</li>
					) ) }
				</ul>
			) }
		</div>
	);
}

export function LogoPicker( { id, url, onChange } ) {
	const open = () => {
		const frame = window.wp.media( {
			title: __( 'Chat logo', 'softicon-live-chat' ),
			library: { type: 'image' },
			multiple: false,
		} );
		frame.on( 'select', () => {
			const att = frame.state().get( 'selection' ).first().toJSON();
			onChange( att.id, ( att.sizes && att.sizes.thumbnail && att.sizes.thumbnail.url ) || att.url );
		} );
		frame.open();
	};
	return (
		<div className="allcLogo">
			{ url && <img src={ url } alt="" /> }
			<Button variant="secondary" onClick={ open } disabled={ ! window.wp || ! window.wp.media }>
				{ id ? __( 'Change image', 'softicon-live-chat' ) : __( 'Choose image', 'softicon-live-chat' ) }
			</Button>
			{ id > 0 && (
				<Button variant="tertiary" isDestructive onClick={ () => onChange( 0, '' ) }>
					{ __( 'Remove', 'softicon-live-chat' ) }
				</Button>
			) }
		</div>
	);
}

export function Agents() {
	const [ agents, setAgents ] = useState( null );
	const [ search, setSearch ] = useState( '' );
	const [ results, setResults ] = useState( [] );
	const [ error, setError ] = useState( '' );

	useEffect( () => {
		apiFetch( { path: `${ NS }/settings/users` } )
			.then( setAgents )
			.catch( ( e ) => setError( e.message ) );
	}, [] );

	useEffect( () => {
		if ( search.trim().length < 2 ) {
			setResults( [] );
			return;
		}
		const timer = setTimeout( () => {
			apiFetch( { path: addQueryArgs( `${ NS }/settings/users`, { search } ) } )
				.then( setResults )
				.catch( () => setResults( [] ) );
		}, 300 );
		return () => clearTimeout( timer );
	}, [ search ] );

	const set = async ( user, agent ) => {
		setError( '' );
		try {
			const saved = await apiFetch( { path: `${ NS }/settings/agents`, method: 'POST', data: { user: user.id, agent } } );
			setAgents( ( list ) => ( agent ? [ ...list.filter( ( u ) => u.id !== saved.id ), saved ] : list.filter( ( u ) => u.id !== saved.id ) ) );
			setResults( ( list ) => list.map( ( u ) => ( u.id === saved.id ? saved : u ) ) );
		} catch ( e ) {
			setError( e.message );
		}
	};

	if ( ! agents ) {
		return error ? <Notice status="error" isDismissible={ false }>{ error }</Notice> : <Spinner />;
	}

	return (
		<div className="allcAgents">
			{ error && (
				<Notice status="error" isDismissible={ false }>
					{ error }
				</Notice>
			) }
			<ul className="allcAgentList">
				{ agents.map( ( u ) => (
					<li key={ u.id }>
						<span>
							<strong>{ u.name }</strong> <span className="allcMuted">{ u.email }</span>
						</span>
						{ u.locked ? (
							<span className="allcMuted">{ __( 'Always (can change settings)', 'softicon-live-chat' ) }</span>
						) : (
							<Button variant="tertiary" isDestructive onClick={ () => set( u, false ) }>
								{ __( 'Remove', 'softicon-live-chat' ) }
							</Button>
						) }
					</li>
				) ) }
			</ul>
			<TextControl __nextHasNoMarginBottom label={ __( 'Add an agent', 'softicon-live-chat' ) } help={ __( 'Search users by name, username or email. Agents can answer chats but not change these settings.', 'softicon-live-chat' ) } value={ search } onChange={ setSearch } />
			{ results.length > 0 && (
				<ul className="allcAgentList">
					{ results.map( ( u ) => (
						<li key={ u.id }>
							<span>
								<strong>{ u.name }</strong> <span className="allcMuted">{ u.email }</span>
							</span>
							{ u.agent ? (
								<span className="allcMuted">{ __( 'Agent', 'softicon-live-chat' ) }</span>
							) : (
								<Button variant="secondary" onClick={ () => set( u, true ) }>
									{ __( 'Make agent', 'softicon-live-chat' ) }
								</Button>
							) }
						</li>
					) ) }
				</ul>
			) }
		</div>
	);
}

export const Toggle = ( props ) => <ToggleControl __nextHasNoMarginBottom { ...props } />;
