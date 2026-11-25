import { createRoot } from '@wordpress/element';
import Inbox from './Inbox';
import './inbox.scss';

const el = document.getElementById( 'allc-inbox' );
if ( el ) {
	createRoot( el ).render( <Inbox /> );
}
