<?php
namespace ALLC_Live_Chat;

// The plugin's own tables; nothing here fits the WordPress object cache, every query is prepared.
// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Store {

	const MAX_MESSAGES = 300;

	private static $names = array();

	public static function table( $name ) {
		global $wpdb;
		return $wpdb->prefix . 'allc_' . $name;
	}

	public static function now() {
		return gmdate( 'Y-m-d H:i:s' );
	}

	public static function time( $mysql ) {
		return $mysql ? (int) strtotime( $mysql . ' UTC' ) : 0;
	}

	public static function insert_conversation( array $data ) {
		global $wpdb;
		$now  = self::now();
		$data = array_merge(
			array(
				'status'            => 'waiting',
				'created_at'        => $now,
				'updated_at'        => $now,
				'visitor_active_at' => $now,
			),
			$data
		);
		$wpdb->insert( self::table( 'conversations' ), $data );
		return (int) $wpdb->insert_id;
	}

	public static function conversation( $id ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM %i WHERE id = %d', self::table( 'conversations' ), $id ) );
	}

	public static function by_hash( $hash ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM %i WHERE token_hash = %s LIMIT 1', self::table( 'conversations' ), $hash ) );
	}

	public static function update( $id, array $data ) {
		global $wpdb;
		return $wpdb->update( self::table( 'conversations' ), $data, array( 'id' => (int) $id ) );
	}

	public static function add_message( $conversation_id, $type, $body, $user_id = 0 ) {
		global $wpdb;
		$now = self::now();
		$wpdb->insert(
			self::table( 'messages' ),
			array(
				'conversation_id' => (int) $conversation_id,
				'type'            => $type,
				'user_id'         => (int) $user_id,
				'body'            => $body,
				'created_at'      => $now,
			)
		);
		$id = (int) $wpdb->insert_id;
		if ( 'note' !== $type ) {
			$wpdb->query(
				$wpdb->prepare(
					'UPDATE %i SET last_message_id = %d, updated_at = %s, unread_agent = unread_agent + %d WHERE id = %d',
					self::table( 'conversations' ),
					$id,
					$now,
					'visitor' === $type ? 1 : 0,
					$conversation_id
				)
			);
		} else {
			self::update( $conversation_id, array( 'updated_at' => $now ) );
		}
		return (object) array(
			'id'              => $id,
			'conversation_id' => (int) $conversation_id,
			'type'            => $type,
			'user_id'         => (int) $user_id,
			'body'            => $body,
			'created_at'      => $now,
		);
	}

	// true when the visitor already sent $max messages within $seconds; reads the conversation's own rows only, writes nothing
	public static function flooding( $conversation_id, $max, $seconds ) {
		global $wpdb;
		$nth = $wpdb->get_var( $wpdb->prepare( 'SELECT created_at FROM %i WHERE conversation_id = %d AND type = %s ORDER BY id DESC LIMIT 1 OFFSET %d', self::table( 'messages' ), $conversation_id, 'visitor', $max - 1 ) );
		return $nth && time() - self::time( $nth ) < $seconds;
	}

	public static function messages( $conversation_id, $after = 0, $notes = false ) {
		global $wpdb;
		$table = self::table( 'messages' );
		// visitors never get notes; no message has an empty type, so '' keeps them all
		$skip = $notes ? '' : 'note';
		if ( $after > 0 ) {
			$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM %i WHERE conversation_id = %d AND id > %d AND type <> %s ORDER BY id ASC LIMIT %d', $table, $conversation_id, $after, $skip, self::MAX_MESSAGES ) );
		} else {
			$rows = array_reverse( $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM %i WHERE conversation_id = %d AND type <> %s ORDER BY id DESC LIMIT %d', $table, $conversation_id, $skip, self::MAX_MESSAGES ) ) );
		}
		return $rows ? $rows : array();
	}

	// every message of a chat (notes left out), oldest first, read in pages; for the export and the transcript
	public static function all_messages( $conversation_id ) {
		global $wpdb;
		$all   = array();
		$after = 0;
		do {
			$page  = $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM %i WHERE conversation_id = %d AND id > %d AND type <> %s ORDER BY id ASC LIMIT %d', self::table( 'messages' ), $conversation_id, $after, 'note', self::MAX_MESSAGES ) );
			$all   = array_merge( $all, $page );
			$after = $page ? (int) end( $page )->id : 0;
			$found = count( $page );
		} while ( self::MAX_MESSAGES === $found );
		return $all;
	}

	public static function agent_name( $user_id ) {
		$user_id = (int) $user_id;
		if ( ! isset( self::$names[ $user_id ] ) ) {
			$user                    = $user_id ? get_userdata( $user_id ) : false;
			self::$names[ $user_id ] = $user ? $user->display_name : '';
		}
		return self::$names[ $user_id ];
	}

	public static function message_out( $message, $for_agent = false ) {
		$out = array(
			'id'   => (int) $message->id,
			'type' => $message->type,
			'body' => $message->body,
			'time' => self::time( $message->created_at ),
		);
		if ( in_array( $message->type, array( 'agent', 'note' ), true ) ) {
			$out['name'] = self::agent_name( $message->user_id );
		}
		if ( $for_agent ) {
			$out['user'] = (int) $message->user_id;
		}
		return $out;
	}

	// conditions on the conversations table, aliased "c" in query()
	private static function where( $view, $agent_id, $search ) {
		global $wpdb;
		switch ( $view ) {
			case 'waiting':
				$where = "c.status = 'waiting'";
				break;
			case 'mine':
				$where = $wpdb->prepare( "c.status = 'open' AND c.agent_id = %d", $agent_id );
				break;
			case 'closed':
				$where = "c.status = 'closed'";
				break;
			default:
				$where = "c.status IN ('waiting','open')";
		}
		if ( '' !== $search ) {
			$like   = '%' . $wpdb->esc_like( $search ) . '%';
			$where .= $wpdb->prepare( ' AND (c.name LIKE %s OR c.email LIKE %s OR c.phone LIKE %s OR c.id = %d)', $like, $like, $like, absint( $search ) );
		}
		return $where;
	}

	public static function query( $view, $agent_id, $search = '', $page = 1, $per_page = 30 ) {
		global $wpdb;
		$table = self::table( 'conversations' );
		$where = self::where( $view, $agent_id, $search );
		$page  = max( 1, (int) $page );
		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- $where is built only from fixed strings and $wpdb->prepare() in where()
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT c.*, m.type AS last_type, m.body AS last_body FROM %i c LEFT JOIN %i m ON m.id = c.last_message_id WHERE {$where} ORDER BY c.updated_at DESC, c.id DESC LIMIT %d OFFSET %d",
				$table,
				self::table( 'messages' ),
				$per_page,
				( $page - 1 ) * $per_page
			)
		);
		$total = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM %i c WHERE {$where}", $table ) );
		// phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter

		$items = array();
		foreach ( $rows as $row ) {
			$items[] = array(
				'id'      => (int) $row->id,
				'status'  => $row->status,
				'name'    => $row->name,
				'email'   => $row->email,
				'agent'   => (int) $row->agent_id,
				'unread'  => (int) $row->unread_agent,
				'offline' => (bool) $row->offline,
				'updated' => self::time( $row->updated_at ),
				'active'  => self::time( $row->visitor_active_at ),
				'last'    => null !== $row->last_type ? array(
					'type' => $row->last_type,
					'body' => mb_substr( (string) $row->last_body, 0, 120 ),
				) : null,
			);
		}
		return array(
			'items' => $items,
			'total' => $total,
		);
	}

	public static function counts( $agent_id ) {
		global $wpdb;
		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT
					SUM(status = 'waiting') AS waiting,
					SUM(status = 'open' AND agent_id = %d) AS mine,
					SUM(status IN ('waiting','open')) AS open,
					SUM(CASE WHEN status = 'waiting' OR (status = 'open' AND agent_id = %d) THEN unread_agent ELSE 0 END) AS unread
				FROM %i WHERE status IN ('waiting','open')",
				$agent_id,
				$agent_id,
				self::table( 'conversations' )
			)
		);
		return array(
			'waiting' => (int) ( $row->waiting ?? 0 ),
			'mine'    => (int) ( $row->mine ?? 0 ),
			'open'    => (int) ( $row->open ?? 0 ),
			'unread'  => (int) ( $row->unread ?? 0 ),
		);
	}

	public static function delete( $id ) {
		global $wpdb;
		$wpdb->delete( self::table( 'messages' ), array( 'conversation_id' => (int) $id ) );
		return (bool) $wpdb->delete( self::table( 'conversations' ), array( 'id' => (int) $id ) );
	}

	public static function by_email( $email, $limit, $offset ) {
		global $wpdb;
		return $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM %i WHERE email = %s ORDER BY id ASC LIMIT %d OFFSET %d', self::table( 'conversations' ), $email, $limit, $offset ) );
	}

	// chats with no activity since $date, whatever their status (an abandoned waiting chat too)
	public static function idle_before( $date, $limit ) {
		global $wpdb;
		return array_map( 'intval', $wpdb->get_col( $wpdb->prepare( 'SELECT id FROM %i WHERE updated_at < %s LIMIT %d', self::table( 'conversations' ), $date, $limit ) ) );
	}

	public static function delete_many( array $ids ) {
		global $wpdb;
		$ids = array_map( 'intval', $ids );
		if ( ! $ids ) {
			return;
		}
		$in = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
		// phpcs:disable WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare,WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $in holds only %d placeholders
		$wpdb->query( $wpdb->prepare( "DELETE FROM %i WHERE conversation_id IN ($in)", array_merge( array( self::table( 'messages' ) ), $ids ) ) );
		$wpdb->query( $wpdb->prepare( "DELETE FROM %i WHERE id IN ($in)", array_merge( array( self::table( 'conversations' ) ), $ids ) ) );
		// phpcs:enable WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare,WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	}

	// marks the "new chat" email as sent; true only for the one request that changed it, so it goes once
	public static function claim_notify( $id ) {
		global $wpdb;
		return 1 === (int) $wpdb->query( $wpdb->prepare( 'UPDATE %i SET notified = 1 WHERE id = %d AND notified = 0', self::table( 'conversations' ), $id ) );
	}

	// the transcript of a chat goes once: true only for the one request that set the time
	public static function claim_transcript( $id ) {
		global $wpdb;
		return 1 === (int) $wpdb->query( $wpdb->prepare( 'UPDATE %i SET transcript_at = %s WHERE id = %d AND transcript_at IS NULL', self::table( 'conversations' ), self::now(), $id ) );
	}

	public static function has_agent_message( $conversation_id ) {
		global $wpdb;
		return (bool) $wpdb->get_var( $wpdb->prepare( 'SELECT id FROM %i WHERE conversation_id = %d AND type = %s LIMIT 1', self::table( 'messages' ), $conversation_id, 'agent' ) );
	}

	public static function drop_tables() {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.SchemaChange -- uninstall, the user asked for it
		$wpdb->query( $wpdb->prepare( 'DROP TABLE IF EXISTS %i, %i', self::table( 'messages' ), self::table( 'conversations' ) ) );
	}
}
