import { useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { Modal, Button, TextControl, TextareaControl, Notice } from '@wordpress/components';

// Saved replies: type "/" and the shortcut in a reply to insert one. Shared by all agents.
export default function Canned( { items, onClose, onSaved } ) {
	const [ list, setList ] = useState( items.length ? items : [ { shortcut: '', text: '' } ] );
	const [ saving, setSaving ] = useState( false );
	const [ error, setError ] = useState( '' );

	const change = ( index, key, value ) => setList( list.map( ( item, i ) => ( i === index ? { ...item, [ key ]: value } : item ) ) );

	const save = async () => {
		setSaving( true );
		setError( '' );
		try {
			const saved = await apiFetch( { path: '/softicon-live-chat/v1/agent/canned', method: 'POST', data: { items: list } } );
			onSaved( saved );
			onClose();
		} catch ( e ) {
			setError( e.message );
			setSaving( false );
		}
	};

	return (
		<Modal title={ __( 'Saved replies', 'softicon-live-chat' ) } onRequestClose={ onClose } className="allcCannedModal" size="medium">
			<p className="allcHelpText">{ __( 'In a reply, type / and the shortcut (for example /hours) to insert the text. All agents share these.', 'softicon-live-chat' ) }</p>
			{ error && (
				<Notice status="error" isDismissible={ false }>
					{ error }
				</Notice>
			) }
			{ list.map( ( item, i ) => (
				<div className="allcCannedRow" key={ i }>
					<TextControl __nextHasNoMarginBottom label={ __( 'Shortcut', 'softicon-live-chat' ) } value={ item.shortcut } onChange={ ( v ) => change( i, 'shortcut', v.replace( /[^A-Za-z0-9_-]/g, '' ).toLowerCase() ) } placeholder="hours" />
					<TextareaControl __nextHasNoMarginBottom label={ __( 'Text', 'softicon-live-chat' ) } value={ item.text } onChange={ ( v ) => change( i, 'text', v ) } rows={ 2 } />
					<Button icon="trash" label={ __( 'Remove', 'softicon-live-chat' ) } isDestructive onClick={ () => setList( list.filter( ( _, j ) => j !== i ) ) } />
				</div>
			) ) }
			<div className="allcModalBar">
				<Button variant="secondary" icon="plus" onClick={ () => setList( [ ...list, { shortcut: '', text: '' } ] ) } disabled={ list.length >= 200 }>
					{ __( 'Add a reply', 'softicon-live-chat' ) }
				</Button>
				<Button variant="primary" onClick={ save } isBusy={ saving } disabled={ saving }>
					{ __( 'Save', 'softicon-live-chat' ) }
				</Button>
			</div>
		</Modal>
	);
}
