import { registerBlockType } from '@wordpress/blocks';
import { InspectorControls, useBlockProps } from '@wordpress/block-editor';
import { PanelBody, RangeControl, ExternalLink } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { SVG, Path } from '@wordpress/primitives';
import metadata from './block.json';
import './editor.scss';

const icon = (
	<SVG viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<Path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" />
	</SVG>
);

// The editor shows a still picture of the chat; the live chat runs only on the published page.
const Edit = ( { attributes, setAttributes } ) => {
	const { height } = attributes;
	const settingsUrl = window.allcBlock?.settingsUrl;
	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Chat box', 'softicon-live-chat' ) }>
					<RangeControl
						label={ __( 'Height (px)', 'softicon-live-chat' ) }
						value={ height }
						min={ 320 }
						max={ 1000 }
						step={ 10 }
						onChange={ ( value ) => setAttributes( { height: value || 520 } ) }
					/>
					<p className="allcBlockHelp">
						{ __( 'Colors, texts, the form and business hours are set once for the whole site.', 'softicon-live-chat' ) }
						{ settingsUrl && <> <ExternalLink href={ settingsUrl }>{ __( 'Live Chat settings', 'softicon-live-chat' ) }</ExternalLink></> }
					</p>
					<p className="allcBlockHelp">{ __( 'On a page with this block, the corner chat button is hidden.', 'softicon-live-chat' ) }</p>
				</PanelBody>
			</InspectorControls>
			<div { ...useBlockProps() }>
				<div className="allcBlockPreview" style={ { height } }>
					<div className="allcBlockHead">
						{ icon }
						<span>{ __( 'Live Chat', 'softicon-live-chat' ) }</span>
					</div>
					<div className="allcBlockBody">
						<div className="allcBlockBubble">{ __( 'Hi! How can we help you today?', 'softicon-live-chat' ) }</div>
						<div className="allcBlockBubble allcBlockMine">{ __( 'Visitors chat with you here.', 'softicon-live-chat' ) }</div>
					</div>
					<div className="allcBlockNote">{ __( 'The live chat appears here on the published page.', 'softicon-live-chat' ) }</div>
				</div>
			</div>
		</>
	);
};

registerBlockType( metadata, {
	icon,
	edit: Edit,
	save: () => null,
} );
