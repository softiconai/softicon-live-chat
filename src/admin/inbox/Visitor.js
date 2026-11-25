import { __ } from '@wordpress/i18n';
import { ago, fullTime, device } from '../utils';

const Row = ( { label, children } ) =>
	children ? (
		<div className="allcInfoRow">
			<dt>{ label }</dt>
			<dd>{ children }</dd>
		</div>
	) : null;

const safeUrl = ( url ) => ( /^https?:\/\//i.test( url || '' ) ? url : '' );

export default function Visitor( { chat, now } ) {
	const pages = [ ...( chat.pages || [] ) ].reverse();
	return (
		<aside className="allcInfoCol" aria-label={ __( 'Visitor details', 'softicon-live-chat' ) }>
			<section className="allcInfoBox">
				<h3>{ __( 'Visitor', 'softicon-live-chat' ) }</h3>
				<dl>
					<Row label={ __( 'Name', 'softicon-live-chat' ) }>{ chat.name }</Row>
					<Row label={ __( 'Email', 'softicon-live-chat' ) }>{ chat.email && <a href={ `mailto:${ chat.email }` }>{ chat.email }</a> }</Row>
					<Row label={ __( 'Phone', 'softicon-live-chat' ) }>{ chat.phone && <a href={ `tel:${ chat.phone.replace( /[^0-9+]/g, '' ) }` }>{ chat.phone }</a> }</Row>
					{ chat.fields.map( ( f, i ) => (
						<Row key={ i } label={ f.label }>
							{ f.value }
						</Row>
					) ) }
					<Row label={ __( 'WordPress user', 'softicon-live-chat' ) }>{ chat.user && ( chat.user.url ? <a href={ chat.user.url }>{ chat.user.name }</a> : chat.user.name ) }</Row>
					<Row label={ __( 'Started', 'softicon-live-chat' ) }>{ fullTime( chat.created ) }</Row>
					<Row label={ __( 'Last active', 'softicon-live-chat' ) }>{ ago( chat.active, now ) }</Row>
					<Row label={ __( 'Device', 'softicon-live-chat' ) }>{ chat.device && <span title={ chat.device }>{ device( chat.device ) }</span> }</Row>
					<Row label={ __( 'IP address', 'softicon-live-chat' ) }>{ chat.ip }</Row>
					<Row label={ __( 'Came from', 'softicon-live-chat' ) }>{ safeUrl( chat.referrer ) && <a href={ chat.referrer } target="_blank" rel="noopener noreferrer">{ chat.referrer.replace( /^https?:\/\//, '' ) }</a> }</Row>
					<Row label={ __( 'Rating', 'softicon-live-chat' ) }>
						{ chat.rating !== 0 && (
							<>
								{ chat.rating > 0 ? '👍 ' + __( 'Good', 'softicon-live-chat' ) : '👎 ' + __( 'Bad', 'softicon-live-chat' ) }
								{ chat.ratingNote && <div className="allcInfoNote">{ chat.ratingNote }</div> }
							</>
						) }
					</Row>
				</dl>
			</section>

			{ safeUrl( chat.url ) && (
				<section className="allcInfoBox">
					<h3>{ __( 'Current page', 'softicon-live-chat' ) }</h3>
					<a className="allcPage" href={ chat.url } target="_blank" rel="noopener noreferrer">
						{ chat.title || chat.url }
					</a>
				</section>
			) }

			{ pages.length > 1 && (
				<section className="allcInfoBox">
					<h3>{ __( 'Pages visited', 'softicon-live-chat' ) }</h3>
					<ol className="allcPages">
						{ pages.filter( ( p ) => safeUrl( p.url ) ).map( ( p, i ) => (
							<li key={ i }>
								<a href={ p.url } target="_blank" rel="noopener noreferrer">
									{ p.title || p.url }
								</a>
								<span>{ ago( p.time, now ) }</span>
							</li>
						) ) }
					</ol>
				</section>
			) }

			{ chat.orders && chat.orders.length > 0 && (
				<section className="allcInfoBox">
					<h3>{ __( 'Recent orders', 'softicon-live-chat' ) }</h3>
					<ul className="allcOrders">
						{ chat.orders.map( ( o ) => (
							<li key={ o.number }>
								<a href={ o.url }>#{ o.number }</a>
								<span>{ o.status }</span>
								<span>{ o.total }</span>
								<span>{ fullTime( o.date ) }</span>
							</li>
						) ) }
					</ul>
				</section>
			) }
		</aside>
	);
}
