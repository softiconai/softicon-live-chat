import { useState, useEffect } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import { Button, TextControl, TextareaControl, SelectControl, RadioControl, RangeControl, ColorPicker, Notice, Spinner, Dropdown, ColorIndicator } from '@wordpress/components';
import Preview from './Preview';
import { FieldsEditor, ChannelsEditor, HoursEditor, PagesPicker, LogoPicker, Agents, Toggle } from './parts';

const data = window.allcData || {};
const NS = '/softicon-live-chat/v1';

const Section = ( { title, help, children } ) => (
	<section className="allcSection">
		<h2>{ title }</h2>
		{ help && <p className="allcMuted">{ help }</p> }
		<div className="allcSectionBody">{ children }</div>
	</section>
);

const TABS = [
	{ name: 'general', label: __( 'General', 'softicon-live-chat' ) },
	{ name: 'look', label: __( 'Look', 'softicon-live-chat' ) },
	{ name: 'form', label: __( 'Form', 'softicon-live-chat' ) },
	{ name: 'channels', label: __( 'WhatsApp & more', 'softicon-live-chat' ) },
	{ name: 'display', label: __( 'Where to show', 'softicon-live-chat' ) },
	{ name: 'agents', label: __( 'Agents', 'softicon-live-chat' ) },
	{ name: 'emails', label: __( 'Emails', 'softicon-live-chat' ) },
	{ name: 'privacy', label: __( 'Privacy & spam', 'softicon-live-chat' ) },
];

const ICONS = [
	{ value: 'chat', label: __( 'Chat bubble', 'softicon-live-chat' ) },
	{ value: 'message', label: __( 'Two bubbles', 'softicon-live-chat' ) },
	{ value: 'help', label: __( 'Question mark', 'softicon-live-chat' ) },
	{ value: 'headset', label: __( 'Headset', 'softicon-live-chat' ) },
];

const readTab = () => {
	const m = /#tab=([a-z]+)/.exec( window.location.hash );
	return m && TABS.some( ( t ) => t.name === m[ 1 ] ) ? m[ 1 ] : 'general';
};

export default function App() {
	const [ s, setS ] = useState( null );
	const [ saved, setSaved ] = useState( null );
	const [ pages, setPages ] = useState( [] );
	const [ logo, setLogo ] = useState( '' );
	const [ tab, setTab ] = useState( readTab() );
	const [ saving, setSaving ] = useState( false );
	const [ notice, setNotice ] = useState( null );
	const [ testing, setTesting ] = useState( false );

	const load = ( res ) => {
		setS( res.settings );
		setSaved( JSON.stringify( res.settings ) );
		setPages( res.pages );
		setLogo( res.logo || '' );
	};

	useEffect( () => {
		apiFetch( { path: `${ NS }/settings` } )
			.then( load )
			.catch( ( e ) => setNotice( { status: 'error', text: e.message } ) );
	}, [] );

	const dirty = s && saved !== JSON.stringify( s );

	useEffect( () => {
		const warn = ( e ) => {
			if ( dirty ) {
				e.preventDefault();
				e.returnValue = '';
			}
		};
		window.addEventListener( 'beforeunload', warn );
		return () => window.removeEventListener( 'beforeunload', warn );
	}, [ dirty ] );

	if ( ! s ) {
		return notice ? <Notice status="error" isDismissible={ false }>{ notice.text }</Notice> : <Spinner />;
	}

	const set = ( key ) => ( value ) => setS( { ...s, [ key ]: value } );

	const save = async () => {
		setSaving( true );
		setNotice( null );
		try {
			load( await apiFetch( { path: `${ NS }/settings`, method: 'POST', data: { settings: s } } ) );
			setNotice( { status: 'success', text: __( 'Settings saved. If your site uses a page cache, clear it so visitors get the new look.', 'softicon-live-chat' ) } );
		} catch ( e ) {
			setNotice( { status: 'error', text: e.message } );
		}
		setSaving( false );
	};

	const testEmail = async () => {
		setTesting( true );
		try {
			const res = await apiFetch( { path: `${ NS }/settings/test-email`, method: 'POST' } );
			setNotice(
				res.sent
					? { status: 'success', text: sprintf( /* translators: %s: email addresses */ __( 'Test email sent to %s. If it does not arrive in a few minutes, check the spam folder or set up an SMTP plugin.', 'softicon-live-chat' ), res.to ) }
					: { status: 'error', text: __( 'WordPress could not send the email. An SMTP plugin usually fixes this.', 'softicon-live-chat' ) }
			);
		} catch ( e ) {
			setNotice( { status: 'error', text: e.message } );
		}
		setTesting( false );
	};

	const pickTab = ( name ) => {
		setTab( name );
		window.history.replaceState( null, '', `#tab=${ name }` );
	};

	const showPreview = [ 'general', 'look', 'form', 'channels' ].includes( tab );

	return (
		<div className="allcSettings">
			<nav className="allcSettingsTabs" aria-label={ __( 'Settings sections', 'softicon-live-chat' ) }>
				{ TABS.map( ( t ) => (
					<button key={ t.name } type="button" className={ tab === t.name ? 'isActive' : '' } aria-current={ tab === t.name ? 'page' : undefined } onClick={ () => pickTab( t.name ) }>
						{ t.label }
					</button>
				) ) }
			</nav>

			{ notice && (
				<Notice status={ notice.status } onRemove={ () => setNotice( null ) }>
					{ notice.text }
				</Notice>
			) }

			<div className={ `allcSettingsBody ${ showPreview ? 'hasPreview' : '' }` }>
				<div className="allcSettingsMain">
					{ tab === 'general' && (
						<>
							<Section title={ __( 'Chat button', 'softicon-live-chat' ) }>
								<Toggle label={ __( 'Show the chat button on the site', 'softicon-live-chat' ) } help={ __( 'When off, the chat still works where you place the Live Chat block or the [softicon_live_chat] shortcode.', 'softicon-live-chat' ) } checked={ s.enabled } onChange={ set( 'enabled' ) } />
							</Section>
							<Section title={ __( 'When are you online?', 'softicon-live-chat' ) }>
								<RadioControl
									selected={ s.availability }
									onChange={ set( 'availability' ) }
									options={ [
										{ value: 'auto', label: __( 'Automatic: online while an agent has wp-admin open and is not set to Away', 'softicon-live-chat' ) },
										{ value: 'online', label: __( 'Always online: visitors can always start a live chat', 'softicon-live-chat' ) },
										{ value: 'offline', label: __( 'Always offline: visitors leave a message and you reply by email', 'softicon-live-chat' ) },
									] }
								/>
								<TextControl __nextHasNoMarginBottom label={ __( 'Reply time (optional)', 'softicon-live-chat' ) } help={ __( 'Shown under the title while you are online, for example "We usually reply in a few minutes".', 'softicon-live-chat' ) } value={ s.reply_time } onChange={ set( 'reply_time' ) } />
							</Section>
							<Section title={ __( 'Business hours', 'softicon-live-chat' ) } help={ sprintf( /* translators: %s: time zone */ __( 'Outside these hours the chat shows the offline form. Time zone: %s (Settings → General).', 'softicon-live-chat' ), data.timezone ) }>
								<Toggle label={ __( 'Use business hours', 'softicon-live-chat' ) } checked={ s.hours_enabled } onChange={ set( 'hours_enabled' ) } />
								{ s.hours_enabled && <HoursEditor hours={ s.hours } onChange={ set( 'hours' ) } /> }
							</Section>
						</>
					) }

					{ tab === 'look' && (
						<>
							<Section title={ __( 'Colors and place', 'softicon-live-chat' ) }>
								<div className="allcColorRow">
									<span>{ __( 'Main color', 'softicon-live-chat' ) }</span>
									<Dropdown
										renderToggle={ ( { isOpen, onToggle } ) => (
											<Button variant="secondary" onClick={ onToggle } aria-expanded={ isOpen }>
												<ColorIndicator colorValue={ s.color } /> { s.color }
											</Button>
										) }
										renderContent={ () => <ColorPicker color={ s.color } onChange={ set( 'color' ) } enableAlpha={ false } /> }
									/>
								</div>
								<SelectControl __nextHasNoMarginBottom label={ __( 'Corner', 'softicon-live-chat' ) } value={ s.position } onChange={ set( 'position' ) } options={ [ { value: 'right', label: __( 'Bottom right', 'softicon-live-chat' ) }, { value: 'left', label: __( 'Bottom left', 'softicon-live-chat' ) } ] } />
								<RangeControl __nextHasNoMarginBottom label={ __( 'Distance from the side (px)', 'softicon-live-chat' ) } value={ s.offset_x } min={ 0 } max={ 200 } onChange={ ( v ) => set( 'offset_x' )( v ?? 20 ) } />
								<RangeControl __nextHasNoMarginBottom label={ __( 'Distance from the bottom (px)', 'softicon-live-chat' ) } value={ s.offset_y } min={ 0 } max={ 200 } onChange={ ( v ) => set( 'offset_y' )( v ?? 20 ) } />
								<SelectControl __nextHasNoMarginBottom label={ __( 'Size', 'softicon-live-chat' ) } value={ s.size } onChange={ set( 'size' ) } options={ [ { value: 'normal', label: __( 'Normal', 'softicon-live-chat' ) }, { value: 'compact', label: __( 'Compact', 'softicon-live-chat' ) } ] } />
							</Section>
							<Section title={ __( 'Button', 'softicon-live-chat' ) }>
								<SelectControl __nextHasNoMarginBottom label={ __( 'Icon', 'softicon-live-chat' ) } value={ s.icon } onChange={ set( 'icon' ) } options={ ICONS } />
								<TextControl __nextHasNoMarginBottom label={ __( 'Text next to the icon (optional)', 'softicon-live-chat' ) } value={ s.launcher_text } help={ __( 'For example: Chat with us. Leave empty for an icon only.', 'softicon-live-chat' ) } onChange={ set( 'launcher_text' ) } />
							</Section>
							<Section title={ __( 'Chat window', 'softicon-live-chat' ) }>
								<TextControl __nextHasNoMarginBottom label={ __( 'Title', 'softicon-live-chat' ) } value={ s.title } placeholder={ data.defaultTexts.title } onChange={ set( 'title' ) } />
								<TextControl __nextHasNoMarginBottom label={ __( 'Subtitle (optional)', 'softicon-live-chat' ) } value={ s.subtitle } onChange={ set( 'subtitle' ) } />
								<TextareaControl __nextHasNoMarginBottom label={ __( 'Welcome message', 'softicon-live-chat' ) } value={ s.greeting } placeholder={ data.defaultTexts.greeting } rows={ 2 } onChange={ set( 'greeting' ) } />
								<div className="allcField">
									<span className="allcLabel">{ __( 'Logo or team photo', 'softicon-live-chat' ) }</span>
									<LogoPicker
										id={ s.logo_id }
										url={ logo }
										onChange={ ( id, url ) => {
											setLogo( url );
											set( 'logo_id' )( id );
										} }
									/>
								</div>
								<Toggle label={ __( 'Show the names of online agents', 'softicon-live-chat' ) } checked={ s.show_agents } onChange={ set( 'show_agents' ) } />
							</Section>
						</>
					) }

					{ tab === 'form' && (
						<>
							<Section title={ __( 'Before the chat', 'softicon-live-chat' ) } help={ __( 'What visitors fill in before their first message. When you are offline, an email field is always asked, so you can answer.', 'softicon-live-chat' ) }>
								<Toggle label={ __( 'Ask for details before the chat', 'softicon-live-chat' ) } checked={ s.form_enabled } onChange={ set( 'form_enabled' ) } />
								{ s.form_enabled && <FieldsEditor fields={ s.fields } onChange={ set( 'fields' ) } /> }
							</Section>
							<Section title={ __( 'Privacy notice', 'softicon-live-chat' ) }>
								<Toggle label={ __( 'Visitors must accept a privacy notice', 'softicon-live-chat' ) } checked={ s.consent } onChange={ set( 'consent' ) } />
								{ s.consent && <TextareaControl __nextHasNoMarginBottom label={ __( 'Notice text', 'softicon-live-chat' ) } help={ __( 'A web address in the text becomes a link.', 'softicon-live-chat' ) } value={ s.consent_text } placeholder={ data.defaultTexts.consent } rows={ 2 } onChange={ set( 'consent_text' ) } /> }
							</Section>
							<Section title={ __( 'When you are offline', 'softicon-live-chat' ) }>
								<TextareaControl __nextHasNoMarginBottom label={ __( 'Offline message', 'softicon-live-chat' ) } value={ s.offline_text } placeholder={ data.defaultTexts.offline } rows={ 2 } onChange={ set( 'offline_text' ) } />
							</Section>
						</>
					) }

					{ tab === 'channels' && (
						<Section title={ __( 'Other ways to reach you', 'softicon-live-chat' ) } help={ __( 'Buttons that open WhatsApp, Messenger, Telegram, a phone call or an email. They are plain links: nothing is sent to these services until a visitor clicks.', 'softicon-live-chat' ) }>
							<RadioControl
								selected={ s.channels_mode }
								onChange={ set( 'channels_mode' ) }
								options={ [
									{ value: 'offline', label: __( 'Show only when you are offline', 'softicon-live-chat' ) },
									{ value: 'always', label: __( 'Always show them on the start screen', 'softicon-live-chat' ) },
								] }
							/>
							<ChannelsEditor channels={ s.channels } onChange={ set( 'channels' ) } />
						</Section>
					) }

					{ tab === 'display' && (
						<>
							<Section title={ __( 'Pages', 'softicon-live-chat' ) }>
								<RadioControl
									selected={ s.display_rule }
									onChange={ set( 'display_rule' ) }
									options={ [
										{ value: 'all', label: __( 'On every page', 'softicon-live-chat' ) },
										{ value: 'only', label: __( 'Only on these pages', 'softicon-live-chat' ) },
										{ value: 'except', label: __( 'On every page except these', 'softicon-live-chat' ) },
									] }
								/>
								{ s.display_rule !== 'all' && <PagesPicker value={ s.display_pages } titles={ pages } onChange={ set( 'display_pages' ) } /> }
							</Section>
							<Section title={ __( 'Visitors and devices', 'softicon-live-chat' ) }>
								<SelectControl __nextHasNoMarginBottom label={ __( 'Devices', 'softicon-live-chat' ) } value={ s.display_devices } onChange={ set( 'display_devices' ) } options={ [ { value: 'all', label: __( 'Phones and computers', 'softicon-live-chat' ) }, { value: 'desktop', label: __( 'Computers only', 'softicon-live-chat' ) }, { value: 'mobile', label: __( 'Phones only', 'softicon-live-chat' ) } ] } />
								<SelectControl __nextHasNoMarginBottom label={ __( 'Visitors', 'softicon-live-chat' ) } value={ s.display_visitors } onChange={ set( 'display_visitors' ) } options={ [ { value: 'all', label: __( 'Everyone', 'softicon-live-chat' ) }, { value: 'guests', label: __( 'Only visitors who are not logged in', 'softicon-live-chat' ) }, { value: 'users', label: __( 'Only logged-in users', 'softicon-live-chat' ) } ] } />
							</Section>
							<Section title={ __( 'Open by itself', 'softicon-live-chat' ) } help={ __( 'Opens the chat window once per visit after this many seconds, on computers only. 0 keeps it closed until the visitor clicks.', 'softicon-live-chat' ) }>
								<RangeControl __nextHasNoMarginBottom label={ __( 'Seconds', 'softicon-live-chat' ) } value={ s.auto_open } min={ 0 } max={ 120 } onChange={ ( v ) => set( 'auto_open' )( v ?? 0 ) } />
							</Section>
							<Section title={ __( 'Chat inside a page', 'softicon-live-chat' ) }>
								<p>{ __( 'Add the Live Chat block in the editor, or the shortcode [softicon_live_chat] in any page builder. A link to #live-chat, or any element with the class allc-open, opens the chat.', 'softicon-live-chat' ) }</p>
							</Section>
						</>
					) }

					{ tab === 'agents' && (
						<Section title={ __( 'Who answers chats', 'softicon-live-chat' ) } help={ __( 'Administrators can always answer. Add other users here, no role editor needed.', 'softicon-live-chat' ) }>
							<Agents />
						</Section>
					) }

					{ tab === 'emails' && (
						<>
							<Section title={ __( 'Emails to you', 'softicon-live-chat' ) }>
								<TextControl __nextHasNoMarginBottom label={ __( 'Send to', 'softicon-live-chat' ) } help={ sprintf( /* translators: %s: admin email */ __( 'Up to 5 addresses, separated by commas. Empty means %s.', 'softicon-live-chat' ), data.adminEmail ) } value={ s.email_to } onChange={ set( 'email_to' ) } />
								<RadioControl
									label={ __( 'Email me about new chats', 'softicon-live-chat' ) }
									selected={ s.email_new }
									onChange={ set( 'email_new' ) }
									options={ [
										{ value: 'offline', label: __( 'When nobody is online, or nobody answers within 2 minutes', 'softicon-live-chat' ) },
										{ value: 'always', label: __( 'For every new chat', 'softicon-live-chat' ) },
										{ value: 'never', label: __( 'Never', 'softicon-live-chat' ) },
									] }
								/>
								<Button variant="secondary" onClick={ testEmail } isBusy={ testing } disabled={ testing || dirty }>
									{ __( 'Send a test email', 'softicon-live-chat' ) }
								</Button>
								{ dirty && <p className="allcMuted">{ __( 'Save first, then send the test.', 'softicon-live-chat' ) }</p> }
							</Section>
							<Section title={ __( 'Emails to visitors', 'softicon-live-chat' ) }>
								<Toggle label={ __( 'Email your reply when the visitor has left the site', 'softicon-live-chat' ) } help={ __( 'Only when the visitor gave an email address. At most one email every 15 minutes per chat.', 'softicon-live-chat' ) } checked={ s.email_replies } onChange={ set( 'email_replies' ) } />
								<Toggle label={ __( 'Let visitors ask for a copy of the chat', 'softicon-live-chat' ) } checked={ s.transcript } onChange={ set( 'transcript' ) } />
							</Section>
						</>
					) }

					{ tab === 'privacy' && (
						<>
							<Section title={ __( 'After the chat', 'softicon-live-chat' ) }>
								<Toggle label={ __( 'Ask visitors to rate the chat', 'softicon-live-chat' ) } checked={ s.rating } onChange={ set( 'rating' ) } />
							</Section>
							<Section title={ __( 'Privacy', 'softicon-live-chat' ) } help={ __( 'Chats are stored only in your own database. Tools → Export/Erase Personal Data finds them by email.', 'softicon-live-chat' ) }>
								<Toggle label={ __( 'Store visitors\' IP addresses', 'softicon-live-chat' ) } checked={ s.store_ip } onChange={ set( 'store_ip' ) } />
								<RangeControl __nextHasNoMarginBottom label={ __( 'Delete chats with no activity for this many days (0 = keep them)', 'softicon-live-chat' ) } value={ s.retention_days } min={ 0 } max={ 730 } onChange={ ( v ) => set( 'retention_days' )( v ?? 0 ) } />
								<Toggle label={ __( 'Delete all chats and settings when the plugin is deleted', 'softicon-live-chat' ) } checked={ s.delete_data } onChange={ set( 'delete_data' ) } />
							</Section>
							<Section title={ __( 'Block list', 'softicon-live-chat' ) } help={ __( 'One per line: an email (name@example.com), a whole domain (@example.com), an IP address, or the start of one ending with a dot (192.168.).', 'softicon-live-chat' ) }>
								<TextareaControl __nextHasNoMarginBottom label={ __( 'Blocked visitors', 'softicon-live-chat' ) } hideLabelFromVision value={ s.block_list } rows={ 5 } onChange={ set( 'block_list' ) } />
							</Section>
						</>
					) }
				</div>

				{ showPreview && <Preview settings={ s } logo={ logo } /> }
			</div>

			<div className="allcSaveBar">
				<Button variant="primary" onClick={ save } isBusy={ saving } disabled={ saving || ! dirty }>
					{ dirty ? __( 'Save changes', 'softicon-live-chat' ) : __( 'Saved', 'softicon-live-chat' ) }
				</Button>
				{ dirty && (
					<Button variant="tertiary" onClick={ () => setS( JSON.parse( saved ) ) }>
						{ __( 'Undo changes', 'softicon-live-chat' ) }
					</Button>
				) }
			</div>
		</div>
	);
}
