<?php
namespace ALLC_Live_Chat;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Rest_Agent {

	const NS = 'softicon-live-chat/v1';

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
	}

	public static function can_answer() {
		return current_user_can( 'allc_answer_chats' );
	}

	public static function can_manage() {
		return current_user_can( 'allc_manage' );
	}

	public static function routes() {
		$answer = array( __CLASS__, 'can_answer' );
		$manage = array( __CLASS__, 'can_manage' );
		$id     = array(
			'id' => array(
				'type'     => 'integer',
				'required' => true,
			),
		);

		$routes = array(
			array( '/agent/sync', 'GET', 'sync', $answer ),
			array( '/agent/status', 'POST', 'set_status', $answer ),
			array( '/agent/agents', 'GET', 'agents', $answer ),
			array( '/agent/canned', 'GET', 'canned', $answer ),
			array( '/agent/canned', 'POST', 'save_canned', $answer ),
			array( '/agent/chats/(?P<id>\d+)/reply', 'POST', 'reply', $answer, $id ),
			array( '/agent/chats/(?P<id>\d+)/typing', 'POST', 'typing', $answer, $id ),
			array( '/agent/chats/(?P<id>\d+)/assign', 'POST', 'assign', $answer, $id ),
			array( '/agent/chats/(?P<id>\d+)/close', 'POST', 'close', $answer, $id ),
			array( '/agent/chats/(?P<id>\d+)/reopen', 'POST', 'reopen', $answer, $id ),
			array( '/agent/chats/(?P<id>\d+)', 'DELETE', 'delete', $manage, $id ),
			array( '/settings', 'GET', 'settings', $manage ),
			array( '/settings', 'POST', 'save_settings', $manage ),
			array( '/settings/test-email', 'POST', 'test_email', $manage ),
			array( '/settings/users', 'GET', 'users', $manage ),
			array( '/settings/agents', 'POST', 'set_agent', $manage ),
		);
		foreach ( apply_filters( 'allc_rest_routes', $routes ) as $route ) {
			register_rest_route(
				self::NS,
				$route[0],
				array(
					'methods'             => $route[1],
					'callback'            => is_string( $route[2] ) && method_exists( __CLASS__, $route[2] ) ? array( __CLASS__, $route[2] ) : $route[2],
					'permission_callback' => $route[3] ?? $manage,
					'args'                => $route[4] ?? array(),
				)
			);
		}
	}

	private static function chat( \WP_REST_Request $request ) {
		$conversation = Store::conversation( (int) $request['id'] );
		return $conversation ? $conversation : new \WP_Error( 'allc_not_found', __( 'Chat not found.', 'softicon-live-chat' ), array( 'status' => 404 ) );
	}

	private static function name( $user_id ) {
		$name = Store::agent_name( $user_id );
		return '' !== $name ? $name : __( 'An agent', 'softicon-live-chat' );
	}

	private static function details( $conversation, $after ) {
		$fields = json_decode( (string) $conversation->fields, true );
		$pages  = json_decode( (string) $conversation->pages, true );
		$user   = $conversation->user_id ? get_userdata( $conversation->user_id ) : false;
		$out    = array(
			'id'          => (int) $conversation->id,
			'status'      => $conversation->status,
			'name'        => $conversation->name,
			'email'       => $conversation->email,
			'phone'       => $conversation->phone,
			'fields'      => is_array( $fields ) ? $fields : array(),
			'url'         => (string) $conversation->current_url,
			'title'       => (string) $conversation->current_title,
			'pages'       => is_array( $pages ) ? $pages : array(),
			'referrer'    => (string) $conversation->referrer,
			'device'      => $conversation->device,
			'ip'          => $conversation->ip,
			'offline'     => (bool) $conversation->offline,
			'rating'      => (int) $conversation->rating,
			'ratingNote'  => (string) $conversation->rating_note,
			'agent'       => (int) $conversation->agent_id,
			'agentName'   => $conversation->agent_id ? Store::agent_name( $conversation->agent_id ) : '',
			'created'     => Store::time( $conversation->created_at ),
			'active'      => Store::time( $conversation->visitor_active_at ),
			'visitorSeen' => (int) $conversation->visitor_seen,
			'typing'      => Presence::typing( $conversation->id, 'visitor' ),
			'user'        => $user ? array(
				'id'   => $user->ID,
				'name' => $user->display_name,
				'url'  => current_user_can( 'edit_user', $user->ID ) ? get_edit_user_link( $user->ID ) : '',
			) : null,
			'messages'    => array_map(
				function ( $message ) {
					return Store::message_out( $message, true );
				},
				Store::messages( $conversation->id, $after, true )
			),
		);
		if ( 0 === $after ) {
			$out['orders'] = self::orders( $conversation );
		}
		return $out;
	}

	private static function orders( $conversation ) {
		if ( ! $conversation->user_id || ! function_exists( 'wc_get_orders' ) || ! ( current_user_can( 'edit_shop_orders' ) || current_user_can( 'manage_woocommerce' ) ) ) {
			return array();
		}
		$out = array();
		foreach ( wc_get_orders(
			array(
				'customer_id' => (int) $conversation->user_id,
				'limit'       => 5,
				'orderby'     => 'date',
				'order'       => 'DESC',
			)
		) as $order ) {
			$created = $order->get_date_created();
			$out[]   = array(
				'number' => $order->get_order_number(),
				'status' => wc_get_order_status_name( $order->get_status() ),
				'total'  => html_entity_decode( wp_strip_all_tags( $order->get_formatted_order_total() ), ENT_QUOTES, 'UTF-8' ),
				'date'   => $created ? $created->getTimestamp() : 0,
				'url'    => $order->get_edit_order_url(),
			);
		}
		return $out;
	}

	public static function sync( \WP_REST_Request $request ) {
		$me = get_current_user_id();
		Presence::touch( $me );

		$view = in_array( $request->get_param( 'view' ), array( 'waiting', 'mine', 'open', 'closed' ), true ) ? $request->get_param( 'view' ) : 'open';
		$out  = array(
			'now'    => time(),
			'status' => Presence::status( $me ),
			'counts' => Store::counts( $me ),
			'list'   => Store::query( $view, $me, mb_substr( sanitize_text_field( (string) $request->get_param( 'search' ) ), 0, 100 ), absint( $request->get_param( 'page' ) ) ),
			'chat'   => null,
		);

		$id = absint( $request->get_param( 'chat' ) );
		if ( $id ) {
			$conversation = Store::conversation( $id );
			if ( $conversation ) {
				if ( rest_sanitize_boolean( $request->get_param( 'read' ) ) && ( $conversation->unread_agent > 0 || $conversation->agent_seen < $conversation->last_message_id ) ) {
					Store::update(
						$id,
						array(
							'unread_agent' => 0,
							'agent_seen'   => (int) $conversation->last_message_id,
						)
					);
				}
				$out['chat'] = self::details( $conversation, absint( $request->get_param( 'after' ) ) );
			}
		}
		$response = rest_ensure_response( $out );
		$response->header( 'Cache-Control', 'no-store, private' );
		return $response;
	}

	public static function set_status( \WP_REST_Request $request ) {
		Presence::set_status( get_current_user_id(), (string) $request->get_param( 'status' ) );
		return array( 'status' => Presence::status( get_current_user_id() ) );
	}

	public static function agents() {
		$out    = array();
		$online = Presence::online_agents();
		foreach ( get_users(
			array(
				'capability' => 'allc_answer_chats',
				'fields'     => array( 'ID', 'display_name' ),
				'number'     => 200,
			)
		) as $user ) {
			$out[] = array(
				'id'     => (int) $user->ID,
				'name'   => $user->display_name,
				'online' => in_array( (int) $user->ID, $online, true ),
			);
		}
		return $out;
	}

	public static function reply( \WP_REST_Request $request ) {
		$conversation = self::chat( $request );
		if ( is_wp_error( $conversation ) ) {
			return $conversation;
		}
		$body = mb_substr( trim( sanitize_textarea_field( (string) $request->get_param( 'message' ) ) ), 0, 2000 );
		if ( '' === $body ) {
			return new \WP_Error( 'allc_empty', __( 'Please write a message.', 'softicon-live-chat' ), array( 'status' => 400 ) );
		}
		$me   = get_current_user_id();
		$note = rest_sanitize_boolean( $request->get_param( 'note' ) );

		if ( ! $note ) {
			// the first answer takes a waiting chat; an answer to a closed chat opens it again
			if ( 'open' !== $conversation->status || ! $conversation->agent_id ) {
				Store::update(
					$conversation->id,
					array(
						'status'    => 'open',
						'agent_id'  => $conversation->agent_id ? (int) $conversation->agent_id : $me,
						'closed_at' => null,
					)
				);
				if ( ! $conversation->agent_id ) {
					/* translators: %s: agent name */
					Store::add_message( $conversation->id, 'system', sprintf( __( '%s joined the chat.', 'softicon-live-chat' ), self::name( $me ) ) );
				}
			}
			Presence::clear_typing( $conversation->id, 'agent' );
		}

		$message = Store::add_message( $conversation->id, $note ? 'note' : 'agent', $body, $me );
		Store::update( $conversation->id, array( 'agent_seen' => $message->id ) );
		if ( ! $note ) {
			Notify::agent_reply( Store::conversation( $conversation->id ), $message );
			do_action( 'allc_agent_message', $conversation, $message );
		}
		return Store::message_out( $message, true );
	}

	public static function typing( \WP_REST_Request $request ) {
		Presence::set_typing( (int) $request['id'], 'agent' );
		return array( 'ok' => true );
	}

	public static function assign( \WP_REST_Request $request ) {
		$conversation = self::chat( $request );
		if ( is_wp_error( $conversation ) ) {
			return $conversation;
		}
		$me     = get_current_user_id();
		$target = absint( $request->get_param( 'agent' ) );
		$target = $target ? $target : $me;
		if ( ! user_can( $target, 'allc_answer_chats' ) ) {
			return new \WP_Error( 'allc_agent', __( 'This user cannot answer chats.', 'softicon-live-chat' ), array( 'status' => 400 ) );
		}
		Store::update(
			$conversation->id,
			array(
				'agent_id'  => $target,
				'status'    => 'open',
				'closed_at' => null,
			)
		);
		$text = $target === $me
			/* translators: %s: agent name */
			? sprintf( __( '%s joined the chat.', 'softicon-live-chat' ), self::name( $me ) )
			/* translators: 1: agent name, 2: other agent name */
			: sprintf( __( '%1$s transferred the chat to %2$s.', 'softicon-live-chat' ), self::name( $me ), self::name( $target ) );
		Store::add_message( $conversation->id, 'system', $text );
		return array( 'ok' => true );
	}

	public static function close( \WP_REST_Request $request ) {
		$conversation = self::chat( $request );
		if ( is_wp_error( $conversation ) ) {
			return $conversation;
		}
		if ( 'closed' !== $conversation->status ) {
			Store::update(
				$conversation->id,
				array(
					'status'    => 'closed',
					'closed_at' => Store::now(),
				)
			);
			/* translators: %s: agent name */
			Store::add_message( $conversation->id, 'system', sprintf( __( '%s ended the chat.', 'softicon-live-chat' ), self::name( get_current_user_id() ) ) );
		}
		return array( 'ok' => true );
	}

	public static function reopen( \WP_REST_Request $request ) {
		$conversation = self::chat( $request );
		if ( is_wp_error( $conversation ) ) {
			return $conversation;
		}
		Store::update(
			$conversation->id,
			array(
				'status'    => $conversation->agent_id ? 'open' : 'waiting',
				'closed_at' => null,
			)
		);
		return array( 'ok' => true );
	}

	public static function delete( \WP_REST_Request $request ) {
		return array( 'deleted' => Store::delete( (int) $request['id'] ) );
	}

	public static function canned() {
		$items = get_option( 'allc_canned', array() );
		return is_array( $items ) ? $items : array();
	}

	public static function save_canned( \WP_REST_Request $request ) {
		$items = array();
		foreach ( array_slice( (array) $request->get_param( 'items' ), 0, 200 ) as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			$shortcut = strtolower( preg_replace( '/[^A-Za-z0-9_-]/', '', (string) ( $item['shortcut'] ?? '' ) ) );
			$text     = mb_substr( trim( sanitize_textarea_field( (string) ( $item['text'] ?? '' ) ) ), 0, 2000 );
			if ( '' !== $shortcut && '' !== $text ) {
				$items[] = array(
					'shortcut' => mb_substr( $shortcut, 0, 30 ),
					'text'     => $text,
				);
			}
		}
		update_option( 'allc_canned', $items, false );
		return $items;
	}

	public static function settings() {
		$s     = Settings::get();
		$pages = array();
		foreach ( $s['display_pages'] as $id ) {
			$pages[] = array(
				'id'    => $id,
				'title' => get_the_title( $id ),
			);
		}
		return array(
			'settings' => $s,
			'pages'    => $pages,
			'logo'     => $s['logo_id'] ? wp_get_attachment_image_url( $s['logo_id'], 'thumbnail' ) : '',
		);
	}

	public static function save_settings( \WP_REST_Request $request ) {
		$saved = Settings::save( $request->get_param( 'settings' ) );
		do_action( 'allc_settings_saved', $saved );
		return self::settings();
	}

	public static function test_email() {
		$sent = Notify::test();
		return array(
			'sent' => (bool) $sent,
			'to'   => implode( ', ', Settings::notify_emails() ),
		);
	}

	private static function user_out( $user ) {
		return array(
			'id'     => (int) $user->ID,
			'name'   => $user->display_name,
			'email'  => $user->user_email,
			'agent'  => user_can( $user, 'allc_answer_chats' ),
			'locked' => user_can( $user, 'allc_manage' ),
		);
	}

	public static function users( \WP_REST_Request $request ) {
		$search = sanitize_text_field( (string) $request->get_param( 'search' ) );
		$args   = array(
			'number' => 20,
			'fields' => 'all',
		);
		if ( '' !== $search ) {
			$args['search']         = '*' . $search . '*';
			$args['search_columns'] = array( 'user_login', 'user_email', 'display_name' );
		} else {
			$args['capability'] = 'allc_answer_chats';
			$args['number']     = 200;
		}
		return array_map( array( __CLASS__, 'user_out' ), get_users( $args ) );
	}

	public static function set_agent( \WP_REST_Request $request ) {
		$user = get_userdata( absint( $request->get_param( 'user' ) ) );
		if ( ! $user ) {
			return new \WP_Error( 'allc_user', __( 'User not found.', 'softicon-live-chat' ), array( 'status' => 404 ) );
		}
		if ( rest_sanitize_boolean( $request->get_param( 'agent' ) ) ) {
			$user->add_cap( 'allc_answer_chats' );
		} elseif ( ! user_can( $user, 'allc_manage' ) ) {
			$user->remove_cap( 'allc_answer_chats' );
			// still allowed through a role: deny it for this user
			if ( user_can( $user->ID, 'allc_answer_chats' ) ) {
				$user->add_cap( 'allc_answer_chats', false );
			}
		}
		return self::user_out( get_userdata( $user->ID ) );
	}
}
