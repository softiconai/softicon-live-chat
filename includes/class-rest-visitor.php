<?php
namespace ALLC_Live_Chat;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Rest_Visitor {

	const NS = 'softicon-live-chat/v1';

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
	}

	public static function routes() {
		$client = array( Auth::class, 'client' );
		$owner  = array( Auth::class, 'owner' );

		register_rest_route(
			self::NS,
			'/status',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'status' ),
				'permission_callback' => $client,
			)
		);
		// typed parameters: core answers a wrong type with a 400 before our code runs
		$string = array(
			'type'    => 'string',
			'default' => '',
		);
		$int    = array(
			'type'    => 'integer',
			'default' => 0,
		);
		$bool   = array(
			'type'    => 'boolean',
			'default' => false,
		);
		$page   = array( 'type' => 'object' );
		$after  = array( 'after' => $int );

		register_rest_route(
			self::NS,
			'/start',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'start' ),
				'permission_callback' => $client,
				'args'                => array(
					'message'  => $string,
					'website'  => $string,
					'referrer' => $string,
					'elapsed'  => $int,
					'consent'  => $bool,
					'page'     => $page,
					'fields'   => array(
						'type'    => 'object',
						'default' => array(),
					),
					'pages'    => array(
						'type'    => 'array',
						'default' => array(),
					),
				),
			)
		);
		$args = array(
			'sync'   => $after + array(
				'open' => $bool,
				'page' => $page,
			),
			'send'   => $after + array( 'message' => $string ),
			'typing' => array(),
			'rate'   => array(
				'rating'     => $int,
				'note'       => $string,
				'transcript' => $bool,
			),
			'end'    => $after,
		);
		foreach ( $args as $route => $route_args ) {
			register_rest_route(
				self::NS,
				'/' . $route,
				array(
					'methods'             => 'POST',
					'callback'            => array( __CLASS__, $route ),
					'permission_callback' => $owner,
					'args'                => $route_args,
				)
			);
		}
	}

	private static function no_store( $data ) {
		$response = rest_ensure_response( $data );
		$response->header( 'Cache-Control', 'no-store, private' );
		return $response;
	}

	private static function error( $code, $message, $status = 400, $data = array() ) {
		return new \WP_Error( $code, $message, array_merge( array( 'status' => $status ), $data ) );
	}

	private static function body( $raw ) {
		$body = trim( sanitize_textarea_field( is_string( $raw ) ? $raw : '' ) );
		return mb_substr( $body, 0, 2000 );
	}

	private static function page( $page ) {
		if ( ! is_array( $page ) || empty( $page['url'] ) || ! is_string( $page['url'] ) ) {
			return null;
		}
		// only pages of this site: agents click these, and they go into emails
		$url = esc_url_raw( $page['url'], array( 'http', 'https' ) );
		if ( ! $url || ! in_array( wp_parse_url( $url, PHP_URL_HOST ), Auth::hosts(), true ) ) {
			return null;
		}
		return array(
			'url'   => mb_substr( $url, 0, 1000 ),
			'title' => mb_substr( sanitize_text_field( isset( $page['title'] ) && is_string( $page['title'] ) ? $page['title'] : '' ), 0, 200 ),
			'time'  => isset( $page['time'] ) ? absint( $page['time'] ) : time(),
		);
	}

	public static function conversation_out( $conversation, $after = 0 ) {
		return array(
			'id'       => (int) $conversation->id,
			'status'   => $conversation->status,
			'offline'  => (bool) $conversation->offline,
			'messages' => array_map( array( Store::class, 'message_out' ), Store::messages( $conversation->id, $after ) ),
			'typing'   => Presence::typing( $conversation->id, 'agent' ),
			'seen'     => (int) $conversation->agent_seen,
			'agent'    => $conversation->agent_id ? Store::agent_name( $conversation->agent_id ) : '',
			'rated'    => (int) $conversation->rating,
			'hasEmail' => '' !== $conversation->email,
		);
	}

	public static function status() {
		$open   = Presence::is_open();
		$agents = array();
		if ( $open && Settings::get( 'show_agents' ) ) {
			foreach ( array_slice( Presence::online_agents(), 0, 3 ) as $id ) {
				$agents[] = Store::agent_name( $id );
			}
		}
		$me   = null;
		$user = get_userdata( Auth::cookie_user() );
		if ( $user ) {
			$me = array(
				'name'  => $user->display_name,
				'email' => $user->user_email,
			);
		}
		return self::no_store(
			array(
				'online' => $open,
				'agents' => $agents,
				'me'     => $me,
			)
		);
	}

	public static function start( \WP_REST_Request $request ) {
		$s = Settings::get();

		if ( '' !== (string) $request->get_param( 'website' ) || (int) $request->get_param( 'elapsed' ) < 1500 ) {
			return self::error( 'allc_spam', __( 'Please try again.', 'softicon-live-chat' ) );
		}
		if ( ! Auth::rate( 'start', 5, 10 * MINUTE_IN_SECONDS ) ) {
			return Auth::limited();
		}

		$message = self::body( $request->get_param( 'message' ) );
		if ( '' === $message ) {
			return self::error( 'allc_empty', __( 'Please write a message.', 'softicon-live-chat' ), 400, array( 'field' => 'message' ) );
		}

		$values = $request->get_param( 'fields' );
		$values = is_array( $values ) ? $values : array();
		$row    = array(
			'name'  => '',
			'email' => '',
			'phone' => '',
		);
		$extra  = array();

		$fields  = $s['form_enabled'] ? $s['fields'] : array();
		$offline = ! Presence::is_open();
		// away with no email field in the form: the widget adds one, the answer has to go somewhere
		$has_email = in_array( 'email', wp_list_pluck( $fields, 'type' ), true );
		if ( $offline && ! $has_email ) {
			$fields[] = array(
				'id'       => 'email',
				'type'     => 'email',
				'label'    => '',
				'required' => true,
				'options'  => '',
			);
		}

		foreach ( $fields as $field ) {
			$raw = isset( $values[ $field['id'] ] ) && is_scalar( $values[ $field['id'] ] ) ? trim( (string) $values[ $field['id'] ] ) : '';
			switch ( $field['type'] ) {
				case 'email':
					$value = sanitize_email( $raw );
					if ( '' !== $raw && ! is_email( $value ) ) {
						return self::error( 'allc_email', __( 'Please enter a valid email address.', 'softicon-live-chat' ), 400, array( 'field' => $field['id'] ) );
					}
					break;
				case 'phone':
					$value = mb_substr( preg_replace( '/[^0-9+()\-.\s]/', '', $raw ), 0, 40 );
					break;
				case 'textarea':
					$value = mb_substr( sanitize_textarea_field( $raw ), 0, 1000 );
					break;
				case 'checkbox':
					$value = rest_sanitize_boolean( $raw ) ? __( 'Yes', 'softicon-live-chat' ) : '';
					break;
				case 'select':
					$options = array_filter( array_map( 'trim', preg_split( '/\r\n|\r|\n/', $field['options'] ) ) );
					$value   = in_array( $raw, $options, true ) ? $raw : '';
					break;
				default:
					$value = mb_substr( sanitize_text_field( $raw ), 0, 191 );
			}
			// offline, an email is needed even when the field itself is optional
			$required = $field['required'] || ( $offline && 'email' === $field['type'] );
			if ( $required && '' === $value ) {
				return self::error( 'allc_required', __( 'Please fill in the required fields.', 'softicon-live-chat' ), 400, array( 'field' => $field['id'] ) );
			}
			if ( in_array( $field['type'], array( 'name', 'email', 'phone' ), true ) ) {
				$row[ $field['type'] ] = $value;
			} elseif ( '' !== $value ) {
				$extra[] = array(
					'label' => $field['label'] ? $field['label'] : $field['id'],
					'value' => $value,
				);
			}
		}

		if ( $s['consent'] && ! rest_sanitize_boolean( $request->get_param( 'consent' ) ) ) {
			return self::error( 'allc_consent', __( 'Please accept the privacy notice.', 'softicon-live-chat' ), 400, array( 'field' => 'consent' ) );
		}
		if ( Auth::blocked( $row['email'] ) ) {
			return self::error( 'allc_blocked', __( 'Sorry, you cannot start a chat.', 'softicon-live-chat' ), 403 );
		}

		$user = get_userdata( Auth::cookie_user() );
		if ( $user ) {
			$row['name']  = $row['name'] ? $row['name'] : $user->display_name;
			$row['email'] = $row['email'] ? $row['email'] : $user->user_email;
		}

		$current = self::page( $request->get_param( 'page' ) );
		$pages   = array();
		foreach ( array_slice( (array) $request->get_param( 'pages' ), -10 ) as $page ) {
			$page = self::page( $page );
			if ( $page ) {
				$pages[] = $page;
			}
		}
		if ( $current && ( ! $pages || end( $pages )['url'] !== $current['url'] ) ) {
			$pages[] = $current;
		}
		$pages = array_slice( $pages, -10 );
		$agent = isset( $_SERVER['HTTP_USER_AGENT'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ) : '';

		$token = Auth::new_token();
		$id    = Store::insert_conversation(
			array(
				'token_hash'    => Auth::hash( $token ),
				'user_id'       => $user ? $user->ID : 0,
				'name'          => mb_substr( $row['name'], 0, 191 ),
				'email'         => mb_substr( $row['email'], 0, 191 ),
				'phone'         => $row['phone'],
				'fields'        => $extra ? wp_json_encode( $extra ) : null,
				'current_url'   => $current ? $current['url'] : '',
				'current_title' => $current ? $current['title'] : '',
				'pages'         => wp_json_encode( $pages ),
				'referrer'      => mb_substr( esc_url_raw( strtok( (string) $request->get_param( 'referrer' ), '?#' ), array( 'http', 'https' ) ), 0, 1000 ),
				'device'        => mb_substr( $agent, 0, 255 ),
				'ip'            => $s['store_ip'] ? Auth::ip() : '',
				'offline'       => $offline ? 1 : 0,
			)
		);
		if ( ! $id ) {
			return self::error( 'allc_db', __( 'Something went wrong. Please try again.', 'softicon-live-chat' ), 500 );
		}
		Store::add_message( $id, 'visitor', $message );
		$conversation = Store::conversation( $id );

		Notify::new_conversation( $conversation, $message, $offline );
		do_action( 'allc_conversation_started', $conversation );

		return self::no_store(
			array_merge(
				array( 'token' => $token ),
				self::conversation_out( $conversation )
			)
		);
	}

	// the poll: no rate limit here, it would write a transient on every request and trip visitors who share an IP
	public static function sync( \WP_REST_Request $request ) {
		$conversation = Auth::conversation( $request );
		$update       = array();

		if ( time() - Store::time( $conversation->visitor_active_at ) >= 15 ) {
			$update['visitor_active_at'] = Store::now();
		}
		if ( rest_sanitize_boolean( $request->get_param( 'open' ) ) && (int) $conversation->last_message_id > (int) $conversation->visitor_seen ) {
			$update['visitor_seen'] = (int) $conversation->last_message_id;
		}
		$page = self::page( $request->get_param( 'page' ) );
		// the widget sends the page only once per page view, so it is saved right away (a script can only rewrite its own row)
		if ( $page && $page['url'] !== $conversation->current_url ) {
			$pages   = json_decode( (string) $conversation->pages, true );
			$pages   = is_array( $pages ) ? $pages : array();
			$pages[] = $page;

			$update['current_url']   = $page['url'];
			$update['current_title'] = $page['title'];
			$update['pages']         = wp_json_encode( array_slice( $pages, -10 ) );
		}
		if ( $update ) {
			Store::update( $conversation->id, $update );
		}
		Notify::maybe_remind( $conversation );

		return self::no_store( self::conversation_out( $conversation, absint( $request->get_param( 'after' ) ) ) );
	}

	public static function send( \WP_REST_Request $request ) {
		$conversation = Auth::conversation( $request );
		$max          = (int) apply_filters( 'allc_rate_limit', 20, 'send' );
		// per chat first (no write), then a day cap per chat, then all chats of one IP together (generous, for shared IPs)
		if ( ( $max > 0 && Store::flooding( $conversation->id, $max, MINUTE_IN_SECONDS ) ) || Store::flooding( $conversation->id, 500, DAY_IN_SECONDS ) || ! Auth::rate( 'send_ip', 60, MINUTE_IN_SECONDS ) ) {
			return Auth::limited();
		}
		if ( Auth::blocked( $conversation->email ) ) {
			return self::error( 'allc_blocked', __( 'Sorry, you cannot send messages.', 'softicon-live-chat' ), 403 );
		}
		$body = self::body( $request->get_param( 'message' ) );
		if ( '' === $body ) {
			return self::error( 'allc_empty', __( 'Please write a message.', 'softicon-live-chat' ) );
		}
		$update = array( 'visitor_active_at' => Store::now() );
		if ( 'closed' === $conversation->status ) {
			$update['status']    = $conversation->agent_id ? 'open' : 'waiting';
			$update['closed_at'] = null;
			// a chat closed and reopened within the hour (or by a script over and over) brings no second email
			if ( time() - Store::time( $conversation->closed_at ) > HOUR_IN_SECONDS ) {
				$update['notified'] = 0;
			}
		}
		Store::update( $conversation->id, $update );
		Presence::clear_typing( $conversation->id, 'visitor' );
		Store::add_message( $conversation->id, 'visitor', $body );
		if ( isset( $update['notified'] ) && 'waiting' === $update['status'] ) {
			Notify::schedule_reminder( $conversation->id );
		}
		do_action( 'allc_visitor_message', $conversation, $body );

		return self::no_store( self::conversation_out( Store::conversation( $conversation->id ), absint( $request->get_param( 'after' ) ) ) );
	}

	public static function typing( \WP_REST_Request $request ) {
		Presence::set_typing( Auth::conversation( $request )->id, 'visitor' );
		return self::no_store( array( 'ok' => true ) );
	}

	public static function rate( \WP_REST_Request $request ) {
		$conversation = Auth::conversation( $request );
		if ( ! Auth::rate( 'rate', 10, HOUR_IN_SECONDS ) ) {
			return Auth::limited();
		}
		$rating = (int) $request->get_param( 'rating' );
		if ( Settings::get( 'rating' ) && in_array( $rating, array( 1, -1 ), true ) ) {
			Store::update(
				$conversation->id,
				array(
					'rating'      => $rating,
					'rating_note' => mb_substr( sanitize_textarea_field( (string) $request->get_param( 'note' ) ), 0, 500 ),
				)
			);
			Store::add_message( $conversation->id, 'system', 1 === $rating ? __( 'The visitor rated this chat as good.', 'softicon-live-chat' ) : __( 'The visitor rated this chat as bad.', 'softicon-live-chat' ) );
		}
		// the email address is not verified, so a copy goes only for a chat an agent answered, once, with a site-wide
		// cap: otherwise anyone could make the site mail text of their choosing to any address
		$sent = false;
		if ( Settings::get( 'transcript' ) && rest_sanitize_boolean( $request->get_param( 'transcript' ) ) && $conversation->agent_id
			&& ! $conversation->transcript_at && ! Auth::blocked( $conversation->email ) && Store::has_agent_message( $conversation->id )
			&& Auth::rate( 'transcript_site', 30, HOUR_IN_SECONDS, false ) && Store::claim_transcript( $conversation->id ) ) {
			$sent = Notify::transcript( $conversation );
		}
		return self::no_store( array( 'transcript' => (bool) $sent ) );
	}

	public static function end( \WP_REST_Request $request ) {
		$conversation = Auth::conversation( $request );
		if ( 'closed' !== $conversation->status ) {
			Store::update(
				$conversation->id,
				array(
					'status'    => 'closed',
					'closed_at' => Store::now(),
				)
			);
			Store::add_message( $conversation->id, 'system', __( 'The visitor ended the chat.', 'softicon-live-chat' ) );
		}
		return self::no_store( self::conversation_out( Store::conversation( $conversation->id ), absint( $request->get_param( 'after' ) ) ) );
	}
}
