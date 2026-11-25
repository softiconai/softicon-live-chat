<?php
/**
 * Plugin Name: Live Chat – Self-Hosted Chat Widget for Customer Support
 * Description: Live chat that runs on your own WordPress site. Visitors chat from a light widget, you answer from an inbox in wp-admin. No account, no trial, no external servers.
 * Version: 1.0.1
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * Author: softiconai
 * Author URI: https://profiles.wordpress.org/softiconai/
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: softicon-live-chat
 * Domain Path: /languages
 *
 * @package SoftIcon_Live_Chat
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'ALLC_PLUGIN_VERSION', '1.0.1' );
define( 'ALLC_PLUGIN_FILE', __FILE__ );
define( 'ALLC_PLUGIN_PATH', plugin_dir_path( __FILE__ ) );
define( 'ALLC_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

foreach ( array( 'settings', 'store', 'install', 'auth', 'presence', 'notify', 'rest-visitor', 'rest-agent', 'widget', 'admin', 'block', 'privacy', 'plugin' ) as $allc_file ) {
	require_once ALLC_PLUGIN_PATH . 'includes/class-' . $allc_file . '.php';
}

register_activation_hook( __FILE__, array( 'ALLC_Live_Chat\Install', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'ALLC_Live_Chat\Install', 'deactivate' ) );

ALLC_Live_Chat\Plugin::init();

// add-ons hook in here; on plugins_loaded, so an add-on that loads after this plugin is not too late
add_action(
	'plugins_loaded',
	function () {
		do_action( 'allc_loaded' );
	},
	5
);
