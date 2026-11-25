<?php
namespace ALLC_Live_Chat;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Who is online: an agent counts while their status is "online" and wp-admin was open in the last few
 * minutes (the inbox polls, other admin pages send Heartbeat). Business hours close the chat on top of that.
 */
class Presence {

	const OPTION = 'allc_presence';
	const ONLINE = 180;

	public static function status( $user_id ) {
		// a user option: on a network, "away" on one site is not away on the others
		return 'away' === get_user_option( 'allc_status', $user_id ) ? 'away' : 'online';
	}

	public static function set_status( $user_id, $status ) {
		update_user_option( $user_id, 'allc_status', 'away' === $status ? 'away' : 'online' );
	}

	public static function touch( $user_id ) {
		$seen = get_option( self::OPTION, array() );
		$seen = is_array( $seen ) ? $seen : array();
		// write at most every 20 seconds per agent
		if ( time() - ( $seen[ $user_id ] ?? 0 ) < 20 ) {
			return;
		}
		$seen[ $user_id ] = time();
		foreach ( $seen as $id => $time ) {
			if ( time() - $time > DAY_IN_SECONDS ) {
				unset( $seen[ $id ] );
			}
		}
		update_option( self::OPTION, $seen, false );
	}

	public static function online_agents() {
		$seen = get_option( self::OPTION, array() );
		$ids  = array();
		foreach ( is_array( $seen ) ? $seen : array() as $id => $time ) {
			if ( time() - $time <= self::ONLINE && 'online' === self::status( $id ) && user_can( $id, 'allc_answer_chats' ) ) {
				$ids[] = (int) $id;
			}
		}
		return $ids;
	}

	public static function in_hours() {
		$s = Settings::get();
		if ( empty( $s['hours_enabled'] ) ) {
			return true;
		}
		$day   = (int) wp_date( 'w' );
		$now   = wp_date( 'H:i' );
		$today = $s['hours'][ $day ] ?? null;
		// an overnight range (22:00–02:00) started yesterday
		$yesterday = $s['hours'][ ( $day + 6 ) % 7 ] ?? null;
		if ( $yesterday && $yesterday['on'] && $yesterday['from'] > $yesterday['to'] && $now < $yesterday['to'] ) {
			return true;
		}
		if ( ! $today || ! $today['on'] ) {
			return false;
		}
		// the same start and end time means the whole day
		if ( $today['from'] === $today['to'] ) {
			return true;
		}
		if ( $today['from'] <= $today['to'] ) {
			return $now >= $today['from'] && $now < $today['to'];
		}
		return $now >= $today['from'];
	}

	public static function is_open() {
		$availability = Settings::get( 'availability' );
		if ( 'offline' === $availability || ! self::in_hours() ) {
			$open = false;
		} elseif ( 'online' === $availability ) {
			$open = true;
		} else {
			$open = (bool) self::online_agents();
		}
		return (bool) apply_filters( 'allc_is_open', $open );
	}

	// at most one write every 3 seconds per conversation, however often it is called
	public static function set_typing( $conversation_id, $who ) {
		$key = 'allc_typing_' . $who . '_' . (int) $conversation_id;
		if ( time() - (int) get_transient( $key ) < 3 ) {
			return;
		}
		set_transient( $key, time(), 8 );
	}

	public static function clear_typing( $conversation_id, $who ) {
		delete_transient( 'allc_typing_' . $who . '_' . (int) $conversation_id );
	}

	public static function typing( $conversation_id, $who ) {
		return (bool) get_transient( 'allc_typing_' . $who . '_' . (int) $conversation_id );
	}
}
