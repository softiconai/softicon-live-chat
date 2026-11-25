// The panel chunk loads from the folder widget.js came from (found from the stylesheet URL in the config,
// so it also works when an optimizer moves or combines the script). Only a JSON <script> counts: post content
// can carry an element with this id, but kses never lets an author add a <script>.
const el = document.querySelector( 'script#allc-config[type="application/json"]' );
let base = '';
try {
	base = el ? JSON.parse( el.textContent ).css.replace( /widget\.css.*$/, '' ) : '';
} catch ( e ) {}
if ( base ) {
	// eslint-disable-next-line camelcase, no-undef, no-unused-vars
	__webpack_public_path__ = base;
}
