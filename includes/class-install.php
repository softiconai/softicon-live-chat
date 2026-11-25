<?php
namespace ALLC_Live_Chat;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Install {

	// 2: transcript_at
	const DB_VERSION = '2';

	public static function activate( $network_wide = false ) {
		if ( is_multisite() && $network_wide ) {
			self::each_site( array( __CLASS__, 'install' ) );
			return;
		}
		self::install();
	}

	public static function deactivate( $network_wide = false ) {
		if ( is_multisite() && $network_wide ) {
			self::each_site( array( __CLASS__, 'unschedule' ) );
			return;
		}
		self::unschedule();
	}

	public static function unschedule() {
		wp_clear_scheduled_hook( 'allc_daily' );
		wp_unschedule_hook( 'allc_remind' );
	}

	// every site of the network, in pages of 100
	public static function each_site( $callback ) {
		$offset = 0;
		do {
			$sites = get_sites(
				array(
					'fields' => 'ids',
					'number' => 100,
					'offset' => $offset,
				)
			);
			$found = count( $sites );
			foreach ( $sites as $site_id ) {
				switch_to_blog( $site_id );
				call_user_func( $callback );
				restore_current_blog();
			}
			$offset += 100;
		} while ( 100 === $found );
	}

	// sites added later on a network, and updates that change the tables
	public static function maybe_upgrade() {
		if ( get_option( 'allc_db_version' ) !== self::DB_VERSION ) {
			self::install();
		}
	}

	public static function install() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$collate       = $wpdb->get_charset_collate();
		$conversations = Store::table( 'conversations' );
		$messages      = Store::table( 'messages' );

		dbDelta(
			"CREATE TABLE {$conversations} (
id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
token_hash char(64) NOT NULL DEFAULT '',
status varchar(20) NOT NULL DEFAULT 'waiting',
agent_id bigint(20) unsigned NOT NULL DEFAULT 0,
user_id bigint(20) unsigned NOT NULL DEFAULT 0,
name varchar(191) NOT NULL DEFAULT '',
email varchar(191) NOT NULL DEFAULT '',
phone varchar(64) NOT NULL DEFAULT '',
fields longtext NULL,
current_url text NULL,
current_title text NULL,
pages longtext NULL,
referrer text NULL,
device varchar(255) NOT NULL DEFAULT '',
ip varchar(64) NOT NULL DEFAULT '',
offline tinyint(1) NOT NULL DEFAULT 0,
notified tinyint(1) NOT NULL DEFAULT 0,
rating smallint(6) NOT NULL DEFAULT 0,
rating_note text NULL,
last_message_id bigint(20) unsigned NOT NULL DEFAULT 0,
unread_agent int(11) unsigned NOT NULL DEFAULT 0,
visitor_seen bigint(20) unsigned NOT NULL DEFAULT 0,
agent_seen bigint(20) unsigned NOT NULL DEFAULT 0,
visitor_active_at datetime NULL,
visitor_emailed_at datetime NULL,
transcript_at datetime NULL,
created_at datetime NOT NULL,
updated_at datetime NOT NULL,
closed_at datetime NULL,
PRIMARY KEY  (id),
KEY token_hash (token_hash),
KEY status_updated (status,updated_at),
KEY agent_id (agent_id),
KEY email (email),
KEY updated_at (updated_at)
) {$collate};"
		);

		dbDelta(
			"CREATE TABLE {$messages} (
id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
conversation_id bigint(20) unsigned NOT NULL,
type varchar(10) NOT NULL DEFAULT 'visitor',
user_id bigint(20) unsigned NOT NULL DEFAULT 0,
body longtext NOT NULL,
created_at datetime NOT NULL,
PRIMARY KEY  (id),
KEY conversation (conversation_id,id)
) {$collate};"
		);

		update_option( 'allc_db_version', self::DB_VERSION, true );

		$admin = get_role( 'administrator' );
		if ( $admin ) {
			$admin->add_cap( 'allc_answer_chats' );
			$admin->add_cap( 'allc_manage' );
		}

		if ( ! wp_next_scheduled( 'allc_daily' ) ) {
			wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', 'allc_daily' );
		}
	}
}
