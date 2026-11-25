<?php
namespace ALLC_Live_Chat;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Plugin {

	public static function init() {
		add_action( 'plugins_loaded', array( Install::class, 'maybe_upgrade' ) );
		add_action( 'allc_remind', array( Notify::class, 'remind' ) );
		Rest_Visitor::init();
		Rest_Agent::init();
		Widget::init();
		Block::init();
		Privacy::init();
		// admin-ajax (Heartbeat) counts as admin too
		if ( is_admin() ) {
			Admin::init();
		}
	}
}
