<?php
namespace ALLC_Live_Chat;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Admin {

	const SLUG     = 'softicon-live-chat';
	const SETTINGS = 'softicon-live-chat-settings';

	// YouTube tutorials, opened only when the user clicks
	const VIDEO_WALKTHROUGH = 'https://www.youtube.com/watch?v=Ut1rL5HBLqM';
	const VIDEO_SETTINGS    = 'https://www.youtube.com/watch?v=VLPyIS-lNDc';

	private static $hooks = array();

	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue' ) );
		add_filter( 'heartbeat_received', array( __CLASS__, 'heartbeat' ), 10, 2 );
		add_action( 'admin_bar_menu', array( __CLASS__, 'admin_bar' ), 80 );
		add_filter( 'plugin_action_links_' . plugin_basename( ALLC_PLUGIN_FILE ), array( __CLASS__, 'links' ) );
		add_filter( 'plugin_row_meta', array( __CLASS__, 'row_meta' ), 10, 2 );
	}

	// the menu bubble and the admin bar share one query per page
	private static function counts() {
		static $counts = null;
		if ( null === $counts ) {
			$counts = Store::counts( get_current_user_id() );
		}
		return $counts;
	}

	private static function bubble( $count ) {
		return sprintf( ' <span class="awaiting-mod allcCount count-%1$d"><span class="pending-count">%1$d</span></span>', (int) $count );
	}

	public static function menu() {
		$counts = current_user_can( 'allc_answer_chats' ) ? self::counts() : array( 'waiting' => 0 );
		$title  = __( 'Live Chat', 'softicon-live-chat' );

		add_menu_page( $title, $title . self::bubble( $counts['waiting'] ), 'allc_answer_chats', self::SLUG, array( __CLASS__, 'inbox_page' ), 'dashicons-format-chat', 26 );
		self::$hooks['inbox']    = add_submenu_page( self::SLUG, __( 'Live Chat Inbox', 'softicon-live-chat' ), __( 'Inbox', 'softicon-live-chat' ), 'allc_answer_chats', self::SLUG, array( __CLASS__, 'inbox_page' ) );
		self::$hooks['settings'] = add_submenu_page( self::SLUG, __( 'Live Chat Settings', 'softicon-live-chat' ), __( 'Settings', 'softicon-live-chat' ), 'allc_manage', self::SETTINGS, array( __CLASS__, 'settings_page' ) );
	}

	public static function inbox_page() {
		echo '<div class="wrap allcWrap"><h1 class="screen-reader-text">' . esc_html__( 'Live Chat Inbox', 'softicon-live-chat' ) . '</h1><div id="allc-inbox"></div></div>';
	}

	public static function settings_page() {
		printf(
			'<div class="wrap allcWrap"><h1 class="wp-heading-inline">%1$s</h1> <a href="%2$s" class="page-title-action" target="_blank" rel="noopener noreferrer">%3$s<span class="screen-reader-text"> %4$s</span></a><hr class="wp-header-end"><div id="allc-settings"></div></div>',
			esc_html__( 'Live Chat Settings', 'softicon-live-chat' ),
			esc_url( self::VIDEO_SETTINGS ),
			esc_html__( 'Video: every setting explained', 'softicon-live-chat' ),
			esc_html__( '(opens in a new tab)', 'softicon-live-chat' )
		);
	}

	private static function app( $name, $data, $extra_deps = array() ) {
		$asset  = Widget::asset( $name );
		$handle = 'softicon-live-chat-' . $name;
		wp_enqueue_script( $handle, ALLC_PLUGIN_URL . 'build/' . $name . '.js', array_merge( $asset['dependencies'], $extra_deps ), $asset['version'], true );
		if ( file_exists( ALLC_PLUGIN_PATH . 'build/' . $name . '.css' ) ) {
			// the notify app runs on every admin page and needs only its own few lines of CSS
			wp_enqueue_style( $handle, ALLC_PLUGIN_URL . 'build/' . $name . '.css', 'notify' === $name ? array() : array( 'wp-components' ), $asset['version'] );
		}
		wp_set_script_translations( $handle, 'softicon-live-chat', ALLC_PLUGIN_PATH . 'languages' );
		wp_add_inline_script( $handle, 'window.allcData = ' . wp_json_encode( $data ) . ';', 'before' );
	}

	public static function enqueue( $hook ) {
		if ( ! current_user_can( 'allc_answer_chats' ) ) {
			return;
		}
		$user   = wp_get_current_user();
		$common = array(
			'me'          => (int) $user->ID,
			'name'        => $user->display_name,
			'canManage'   => current_user_can( 'allc_manage' ),
			'inboxUrl'    => admin_url( 'admin.php?page=' . self::SLUG ),
			'settingsUrl' => admin_url( 'admin.php?page=' . self::SETTINGS ),
			'locale'      => str_replace( '_', '-', get_user_locale() ),
			'widgetCss'   => ALLC_PLUGIN_URL . 'build/widget.css?ver=' . rawurlencode( Widget::asset( 'widget' )['version'] ),
		);

		// counts, sound and the admin bar number on every admin page
		self::app( 'notify', $common, array( 'heartbeat' ) );

		if ( ( self::$hooks['inbox'] ?? '' ) === $hook ) {
			// the walkthrough's inbox chapter starts at 2:00
			self::app( 'inbox', array_merge( $common, array( 'videoUrl' => self::VIDEO_WALKTHROUGH . '&t=120s' ) ) );
		} elseif ( ( self::$hooks['settings'] ?? '' ) === $hook && current_user_can( 'allc_manage' ) ) {
			wp_enqueue_media();
			self::app(
				'settings',
				array_merge(
					$common,
					array(
						'defaults'     => Settings::defaults(),
						'texts'        => Settings::texts(),
						'defaultTexts' => Settings::default_texts(),
						'adminEmail'   => get_option( 'admin_email' ),
						'timezone'     => wp_timezone_string(),
					)
				)
			);
		}
	}

	public static function heartbeat( $response, $data ) {
		if ( ! empty( $data['allc'] ) && current_user_can( 'allc_answer_chats' ) ) {
			$me = get_current_user_id();
			Presence::touch( $me );
			$response['allc'] = array_merge( Store::counts( $me ), array( 'status' => Presence::status( $me ) ) );
		}
		return $response;
	}

	public static function admin_bar( $bar ) {
		if ( ! is_admin() || ! current_user_can( 'allc_answer_chats' ) ) {
			return;
		}
		$counts = self::counts();
		$count  = $counts['waiting'] + $counts['unread'];
		$bar->add_node(
			array(
				'id'    => 'allc',
				'title' => '<span class="ab-icon" aria-hidden="true"></span><span class="ab-label allcBarCount" data-count="' . esc_attr( $count ) . '">' . esc_html( $count ) . '</span><span class="screen-reader-text">' . esc_html__( 'Live Chat', 'softicon-live-chat' ) . '</span>',
				'href'  => admin_url( 'admin.php?page=' . self::SLUG ),
				'meta'  => array( 'title' => __( 'Live Chat', 'softicon-live-chat' ) ),
			)
		);
	}

	public static function links( $links ) {
		if ( current_user_can( 'allc_manage' ) ) {
			array_unshift( $links, '<a href="' . esc_url( admin_url( 'admin.php?page=' . self::SETTINGS ) ) . '">' . esc_html__( 'Settings', 'softicon-live-chat' ) . '</a>' );
		}
		return $links;
	}

	public static function row_meta( $meta, $file ) {
		if ( plugin_basename( ALLC_PLUGIN_FILE ) === $file ) {
			$meta[] = sprintf(
				'<a href="%1$s" target="_blank" rel="noopener noreferrer">%2$s<span class="screen-reader-text"> %3$s</span></a>',
				esc_url( self::VIDEO_WALKTHROUGH ),
				esc_html__( 'Video tutorial', 'softicon-live-chat' ),
				esc_html__( '(opens in a new tab)', 'softicon-live-chat' )
			);
		}
		return $meta;
	}
}
