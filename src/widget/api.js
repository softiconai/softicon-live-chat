import { store } from './storage';

// The visitor REST routes. No cookie or nonce: the X-ALLC-Client header plus our own token.
export const createApi = ( rest ) => {
	const call = async ( path, body ) => {
		const headers = { 'X-ALLC-Client': '1' };
		const token = store.token();
		if ( token ) {
			headers[ 'X-ALLC-Token' ] = token;
		}
		if ( body ) {
			headers[ 'Content-Type' ] = 'application/json';
		}
		const res = await fetch( rest + path, {
			method: body ? 'POST' : 'GET',
			headers,
			body: body ? JSON.stringify( body ) : undefined,
			credentials: 'same-origin',
			cache: 'no-store',
		} );
		let data = null;
		try {
			data = await res.json();
		} catch ( e ) {}
		if ( ! res.ok ) {
			const error = new Error( ( data && data.message ) || 'error' );
			error.status = res.status;
			error.code = data && data.code;
			error.field = data && data.data && data.data.field;
			throw error;
		}
		return data;
	};

	return {
		// POST: the answer names a logged-in visitor, and no CDN caches a POST
		status: () => call( 'status', {} ),
		start: ( body ) => call( 'start', body ),
		sync: ( body ) => call( 'sync', body ),
		send: ( body ) => call( 'send', body ),
		typing: () => call( 'typing', {} ),
		rate: ( body ) => call( 'rate', body ),
		end: ( body ) => call( 'end', body ),
	};
};
