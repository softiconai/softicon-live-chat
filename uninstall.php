<?php
/**
 * Removes the chats only when the site owner turned on "Delete all data when the plugin is deleted".
 *
 * @package SoftIcon_Live_Chat
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

require_once __DIR__ . '/includes/class-store.php';
require_once __DIR__ . '/includes/class-install.php';

function allc_uninstall_site() {
	global $wpdb;
	$settings = get_option( 'allc_settings' );
	ALLC_Live_Chat\Install::unschedule();
	if ( empty( $settings['delete_data'] ) ) {
		return;
	}
	ALLC_Live_Chat\Store::drop_tables();
	foreach ( array( 'allc_settings', 'allc_db_version', 'allc_presence', 'allc_canned' ) as $option ) {
		delete_option( $option );
	}
	delete_metadata( 'user', 0, $wpdb->get_blog_prefix() . 'allc_status', '', true );
	delete_metadata( 'user', 0, 'allc_status', '', true );
	foreach ( wp_roles()->role_objects as $role ) {
		$role->remove_cap( 'allc_answer_chats' );
		$role->remove_cap( 'allc_manage' );
	}
	// caps given (or denied) to single users, found in the stored capabilities
	$users = get_users(
		array(
			'meta_key'     => $wpdb->get_blog_prefix() . 'capabilities', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- runs once, on uninstall
			'meta_value'   => 'allc_', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value
			'meta_compare' => 'LIKE',
		)
	);
	foreach ( $users as $user ) {
		$user->remove_cap( 'allc_answer_chats' );
		$user->remove_cap( 'allc_manage' );
	}
	// rate-limit and typing transients that have not expired yet
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- one cleanup on uninstall, transients have no bulk API
	$wpdb->query( $wpdb->prepare( 'DELETE FROM %i WHERE option_name LIKE %s OR option_name LIKE %s', $wpdb->options, $wpdb->esc_like( '_transient_allc_' ) . '%', $wpdb->esc_like( '_transient_timeout_allc_' ) . '%' ) );
}

if ( is_multisite() ) {
	ALLC_Live_Chat\Install::each_site( 'allc_uninstall_site' );
} else {
	allc_uninstall_site();
}
