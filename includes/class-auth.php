<?php
namespace ALLC_Live_Chat;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Visitors are known by a random token the server hands out when a chat starts. The browser keeps it in
 * localStorage and sends it in a header; the database keeps only its HMAC. No cookie and no nonce, so cached
 * pages never break the chat. Every visitor route also needs the X-ALLC-Client header, which a cross-site form
 * cannot send and WordPress' CORS preflight does not allow, and an Origin from another site is refused.
 */
class Auth {

	private static $conversations = array();

	public static function new_token() {
		return bin2hex( random_bytes( 32 ) );
	}

	public static function hash( $token ) {
		return hash_hmac( 'sha256', $token, wp_salt( 'auth' ) );
	}

	public static function client( \WP_REST_Request $request ) {
		if ( '1' !== $request->get_header( 'x_allc_client' ) ) {
			return new \WP_Error( 'allc_client', __( 'Not allowed.', 'softicon-live-chat' ), array( 'status' => 403 ) );
		}
		$origin = $request->get_header( 'origin' );
		if ( $origin ) {
			$host = wp_parse_url( $origin, PHP_URL_HOST );
			if ( ! $host || ! in_array( $host, self::hosts(), true ) ) {
				return new \WP_Error( 'allc_origin', __( 'Not allowed.', 'softicon-live-chat' ), array( 'status' => 403 ) );
			}
		}
		return true;
	}

	// the site's own host names: requests may come from them, and visitor page addresses must point to them
	public static function hosts() {
		return (array) apply_filters( 'allc_allowed_hosts', array_unique( array( wp_parse_url( home_url(), PHP_URL_HOST ), wp_parse_url( site_url(), PHP_URL_HOST ) ) ) );
	}

	public static function conversation( \WP_REST_Request $request ) {
		$token = (string) $request->get_header( 'x_allc_token' );
		if ( ! preg_match( '/^[a-f0-9]{64}$/', $token ) ) {
			return null;
		}
		$hash = self::hash( $token );
		if ( ! array_key_exists( $hash, self::$conversations ) ) {
			self::$conversations[ $hash ] = Store::by_hash( $hash );
		}
		return self::$conversations[ $hash ];
	}

	public static function owner( \WP_REST_Request $request ) {
		$client = self::client( $request );
		if ( true !== $client ) {
			return $client;
		}
		$conversation = self::conversation( $request );
		// a chat started while logged in belongs to that user only (a shared computer, someone else logged in)
		$owner_id     = $conversation ? (int) $conversation->user_id : 0;
		if ( ! $conversation || ( $owner_id && self::cookie_user() !== $owner_id ) ) {
			return new \WP_Error( 'allc_token', __( 'This chat was not found.', 'softicon-live-chat' ), array( 'status' => 404 ) );
		}
		return true;
	}

	public static function ip() {
		$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
		$ip = apply_filters( 'allc_visitor_ip', $ip );
		$ip = filter_var( $ip, FILTER_VALIDATE_IP ) ? $ip : '';
		// an IPv4 visitor seen through a dual-stack socket is that IPv4 address
		if ( 0 === stripos( $ip, '::ffff:' ) && filter_var( substr( $ip, 7 ), FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 ) ) {
			$ip = substr( $ip, 7 );
		}
		return $ip;
	}

	// fixed-window counter per IP (an IPv6 address counts by its /64), or for the whole site; false once the limit is reached.
	// Only for rare requests: each call writes a transient.
	public static function rate( $bucket, $max, $window, $per_ip = true ) {
		$max = (int) apply_filters( 'allc_rate_limit', $max, $bucket );
		if ( $max <= 0 ) {
			return true;
		}
		$who = '';
		if ( $per_ip ) {
			$who = self::ip();
			if ( '' === $who ) {
				// no usable address: one shared bucket for all such visitors, with a looser limit
				$bucket .= '_noip';
				$max    *= 20;
			} elseif ( false !== strpos( $who, ':' ) ) {
				$who = substr( bin2hex( (string) inet_pton( $who ) ), 0, 16 );
			}
		}
		// keyed with a site secret: the option name must not give the IP address away
		$key   = 'allc_rl_' . substr( hash_hmac( 'sha256', $bucket . '|' . $who . '|' . floor( time() / $window ), wp_salt( 'nonce' ) ), 0, 32 );
		$count = (int) get_transient( $key );
		if ( $count >= $max ) {
			return false;
		}
		set_transient( $key, $count + 1, $window );
		return true;
	}

	public static function limited() {
		return new \WP_Error( 'allc_rate', __( 'Too many messages. Please wait a moment.', 'softicon-live-chat' ), array( 'status' => 429 ) );
	}

	public static function blocked( $email = '' ) {
		$list = Settings::get( 'block_list' );
		if ( '' === trim( $list ) ) {
			return false;
		}
		$ip    = self::ip();
		$email = strtolower( $email );
		foreach ( preg_split( '/\r\n|\r|\n/', strtolower( $list ) ) as $rule ) {
			$rule = trim( $rule );
			if ( '' === $rule ) {
				continue;
			}
			if ( $email && ( $rule === $email || ( '@' === $rule[0] && substr( $email, -strlen( $rule ) ) === $rule ) ) ) {
				return true;
			}
			if ( $ip && ( $rule === $ip || ( '.' === substr( $rule, -1 ) && 0 === strpos( $ip, $rule ) ) ) ) {
				return true;
			}
		}
		return false;
	}

	// a logged-in visitor, read from the login cookie (the custom header above stands in for the nonce)
	public static function cookie_user() {
		if ( ! defined( 'LOGGED_IN_COOKIE' ) || empty( $_COOKIE[ LOGGED_IN_COOKIE ] ) ) {
			return 0;
		}
		return (int) wp_validate_auth_cookie( '', 'logged_in' );
	}
}
