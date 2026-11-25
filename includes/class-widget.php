<?php
namespace ALLC_Live_Chat;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The visitor widget. The page carries only the public config (the same for every visitor, so page caches are
 * safe) and one small deferred script; online status and the chat itself come from the REST routes.
 */
class Widget {

	const HANDLE = 'softicon-live-chat-widget';

	private static $floating = false;
	private static $printed  = false;

	public static function init() {
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue' ) );
		add_action( 'wp_footer', array( __CLASS__, 'print_config' ), 5 );
	}

	public static function asset( $name ) {
		$file  = ALLC_PLUGIN_PATH . 'build/' . $name . '.asset.php';
		$asset = file_exists( $file ) ? require $file : array();
		return wp_parse_args(
			is_array( $asset ) ? $asset : array(),
			array(
				'dependencies' => array(),
				'version'      => ALLC_PLUGIN_VERSION,
			)
		);
	}

	private static function register() {
		if ( ! wp_script_is( self::HANDLE, 'registered' ) ) {
			wp_register_script(
				self::HANDLE,
				ALLC_PLUGIN_URL . 'build/widget.js',
				array(),
				self::asset( 'widget' )['version'],
				array(
					'in_footer' => true,
					'strategy'  => 'defer',
				)
			);
		}
		wp_enqueue_script( self::HANDLE );
	}

	private static function page_id() {
		if ( is_front_page() && 'page' === get_option( 'show_on_front' ) ) {
			return (int) get_option( 'page_on_front' );
		}
		if ( is_home() ) {
			return (int) get_option( 'page_for_posts' );
		}
		// the WooCommerce Shop is a page in the picker, but an archive when shown
		if ( function_exists( 'is_shop' ) && function_exists( 'wc_get_page_id' ) && is_shop() ) {
			return (int) wc_get_page_id( 'shop' );
		}
		return is_singular() ? (int) get_queried_object_id() : 0;
	}

	public static function should_show() {
		$s    = Settings::get();
		$show = (bool) $s['enabled'];
		if ( $show && 'guests' === $s['display_visitors'] && is_user_logged_in() ) {
			$show = false;
		}
		if ( $show && 'users' === $s['display_visitors'] && ! is_user_logged_in() ) {
			$show = false;
		}
		if ( $show && 'all' !== $s['display_rule'] ) {
			$id    = self::page_id();
			$match = $id && in_array( $id, $s['display_pages'], true );
			$show  = 'only' === $s['display_rule'] ? $match : ! $match;
		}
		return (bool) apply_filters( 'allc_show_widget', $show );
	}

	public static function enqueue() {
		if ( self::should_show() ) {
			self::$floating = true;
			self::register();
		}
	}

	// the chat inside a page (block and shortcode)
	public static function inline( $height = 520 ) {
		self::register();
		$height = max( 320, min( 1000, (int) $height ) );
		// display:block here: the shadow root's :host { all: initial } would make the box inline and drop the height
		return '<div class="allc_inline" data-allc-inline style="display:block;height:' . esc_attr( $height ) . 'px"><noscript>' . esc_html__( 'Please turn on JavaScript to chat with us.', 'softicon-live-chat' ) . '</noscript></div>';
	}

	public static function fields() {
		$s = Settings::get();
		if ( ! $s['form_enabled'] ) {
			return array();
		}
		$labels = array(
			'name'  => __( 'Name', 'softicon-live-chat' ),
			'email' => __( 'Email', 'softicon-live-chat' ),
			'phone' => __( 'Phone', 'softicon-live-chat' ),
		);
		$out    = array();
		foreach ( $s['fields'] as $field ) {
			$out[] = array(
				'id'       => $field['id'],
				'type'     => $field['type'],
				'label'    => '' !== $field['label'] ? $field['label'] : ( $labels[ $field['type'] ] ?? $field['id'] ),
				'required' => (bool) $field['required'],
				'options'  => 'select' === $field['type'] ? array_values( array_filter( array_map( 'trim', preg_split( '/\r\n|\r|\n/', $field['options'] ) ) ) ) : array(),
			);
		}
		return $out;
	}

	public static function config() {
		$s        = Settings::get();
		$channels = array();
		foreach ( $s['channels'] as $channel ) {
			$channels[] = array(
				'type'  => $channel['type'],
				'label' => $channel['label'],
				'url'   => Settings::channel_url( $channel ),
			);
		}
		return apply_filters(
			'allc_widget_config',
			array(
				'rest'         => esc_url_raw( rest_url( 'softicon-live-chat/v1/' ) ),
				'css'          => ALLC_PLUGIN_URL . 'build/widget.css?ver=' . rawurlencode( self::asset( 'widget' )['version'] ),
				'floating'     => self::$floating,
				'color'        => $s['color'],
				'position'     => $s['position'],
				'offsetX'      => (int) $s['offset_x'],
				'offsetY'      => (int) $s['offset_y'],
				'size'         => $s['size'],
				'icon'         => $s['icon'],
				'logo'         => $s['logo_id'] ? (string) wp_get_attachment_image_url( $s['logo_id'], 'thumbnail' ) : '',
				'form'         => (bool) $s['form_enabled'],
				'fields'       => self::fields(),
				'consent'      => (bool) $s['consent'],
				'channels'     => $channels,
				'channelsMode' => $s['channels_mode'],
				'devices'      => $s['display_devices'],
				'autoOpen'     => (int) $s['auto_open'],
				'rating'       => (bool) $s['rating'],
				'transcript'   => (bool) $s['transcript'],
				'locale'       => str_replace( '_', '-', determine_locale() ),
				'texts'        => Settings::texts(),
			)
		);
	}

	public static function print_config() {
		if ( self::$printed || ! wp_script_is( self::HANDLE, 'enqueued' ) ) {
			return;
		}
		self::$printed = true;
		wp_print_inline_script_tag(
			wp_json_encode( self::config(), JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ),
			array(
				'type' => 'application/json',
				'id'   => 'allc-config',
			)
		);
	}
}
