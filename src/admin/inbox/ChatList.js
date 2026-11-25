import { __ } from '@wordpress/i18n';
import { SearchControl } from '@wordpress/components';
import { ago, visitorName, initials, hue } from '../utils';

const data = window.allcData || {};

export default function ChatList( { view, setView, search, setSearch, list, counts, selected, onSelect, now } ) {
	const tabs = [
		{ name: 'waiting', label: __( 'Waiting', 'softicon-live-chat' ), count: counts.waiting },
		{ name: 'mine', label: __( 'Mine', 'softicon-live-chat' ), count: counts.mine },
		{ name: 'open', label: __( 'Open', 'softicon-live-chat' ), count: counts.open },
		{ name: 'closed', label: __( 'Closed', 'softicon-live-chat' ) },
	];

	return (
		<div className="allcListCol">
			<div className="allcTabs" role="tablist" aria-label={ __( 'Chats', 'softicon-live-chat' ) }>
				{ tabs.map( ( tab ) => (
					<button key={ tab.name } type="button" role="tab" aria-selected={ view === tab.name } className={ `allcTab ${ view === tab.name ? 'isActive' : '' }` } onClick={ () => setView( tab.name ) }>
						{ tab.label }
						{ tab.count > 0 && <span className={ `allcTabCount ${ tab.name === 'waiting' ? 'isHot' : '' }` }>{ tab.count }</span> }
					</button>
				) ) }
			</div>
			<div className="allcSearch">
				<SearchControl __nextHasNoMarginBottom value={ search } onChange={ setSearch } label={ __( 'Search chats', 'softicon-live-chat' ) } placeholder={ __( 'Name, email, phone or #', 'softicon-live-chat' ) } />
			</div>
			<ul className="allcList">
				{ list.items.length === 0 && <li className="allcListEmpty">{ search ? __( 'No chats found.', 'softicon-live-chat' ) : __( 'No chats here yet.', 'softicon-live-chat' ) }</li> }
				{ list.items.map( ( item ) => {
					const online = now - item.active < 60 && item.status !== 'closed';
					let snippet = item.last ? item.last.body : '';
					if ( item.last && item.last.type === 'agent' ) {
						snippet = `${ __( 'You:', 'softicon-live-chat' ) } ${ snippet }`;
					}
					return (
						<li key={ item.id }>
							<button type="button" className={ `allcItem ${ selected === item.id ? 'isActive' : '' } ${ item.unread ? 'isUnread' : '' }` } onClick={ () => onSelect( item.id ) }>
								<span className="allcAvatar" style={ { '--allc-hue': hue( item.id ) } } aria-hidden="true">
									{ initials( visitorName( item ) ) }
									{ online && <span className="allcOnline" /> }
								</span>
								<span className="allcItemMain">
									<span className="allcItemTop">
										<span className="allcItemName">{ visitorName( item ) }</span>
										<span className="allcItemTime">{ ago( item.updated, now ) }</span>
									</span>
									<span className="allcItemSnippet">{ snippet }</span>
									<span className="allcItemTags">
										{ item.status === 'waiting' && <span className="allcTag isWaiting">{ __( 'Waiting', 'softicon-live-chat' ) }</span> }
										{ item.offline && <span className="allcTag">{ __( 'Offline message', 'softicon-live-chat' ) }</span> }
										{ item.status === 'open' && item.agent && item.agent !== data.me && view !== 'mine' && <span className="allcTag">{ __( 'Other agent', 'softicon-live-chat' ) }</span> }
									</span>
								</span>
								{ item.unread > 0 && (
									<span className="allcUnread">
										{ item.unread }
										<span className="screen-reader-text">{ __( 'unread', 'softicon-live-chat' ) }</span>
									</span>
								) }
							</button>
						</li>
					);
				} ) }
				{ list.total > list.items.length && <li className="allcListEmpty">{ __( 'Showing the latest 30 chats. Search to find older ones.', 'softicon-live-chat' ) }</li> }
			</ul>
		</div>
	);
}
