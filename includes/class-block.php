<?php
namespace ALLC_Live_Chat;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Block {

	public static function init() {
		add_action( 'init', array( __CLASS__, 'register' ) );
		add_shortcode( 'softicon_live_chat', array( __CLASS__, 'shortcode' ) );
		add_action( 'enqueue_block_editor_assets', array( __CLASS__, 'editor_data' ) );
	}

	public static function editor_data() {
		if ( current_user_can( 'allc_manage' ) ) {
			wp_add_inline_script(
				generate_block_asset_handle( 'softicon/live-chat', 'editorScript' ),
				'window.allcBlock = ' . wp_json_encode( array( 'settingsUrl' => admin_url( 'admin.php?page=' . Admin::SETTINGS ) ) ) . ';',
				'before'
			);
		}
	}

	public static function register() {
		if ( file_exists( ALLC_PLUGIN_PATH . 'build/block/block.json' ) ) {
			register_block_type( ALLC_PLUGIN_PATH . 'build/block' );
		}
	}

	public static function shortcode( $atts ) {
		$atts = shortcode_atts( array( 'height' => 520 ), $atts, 'softicon_live_chat' );
		return Widget::inline( (int) $atts['height'] );
	}
}
