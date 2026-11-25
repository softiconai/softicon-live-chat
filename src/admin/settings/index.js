import { createRoot } from '@wordpress/element';
import App from './App';
import './settings.scss';

const el = document.getElementById( 'allc-settings' );
if ( el ) {
	createRoot( el ).render( <App /> );
}
