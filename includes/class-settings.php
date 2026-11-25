<?php
namespace ALLC_Live_Chat;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Settings {

	const OPTION = 'allc_settings';

	const FIELD_TYPES   = array( 'name', 'email', 'phone', 'text', 'textarea', 'select', 'checkbox' );
	const CHANNEL_TYPES = array( 'whatsapp', 'messenger', 'telegram', 'phone', 'email', 'link' );
	const ICONS         = array( 'chat', 'message', 'help', 'headset' );

	private static $cache = null;

	public static function defaults() {
		$hours = array();
		for ( $day = 0; $day < 7; $day++ ) {
			$hours[] = array(
				'on'   => $day >= 1 && $day <= 5,
				'from' => '09:00',
				'to'   => '17:00',
			);
		}
		return array(
			'enabled'          => true,
			'availability'     => 'auto',
			'hours_enabled'    => false,
			'hours'            => $hours,
			'reply_time'       => '',
			'color'            => '#2563eb',
			'position'         => 'right',
			'offset_x'         => 20,
			'offset_y'         => 20,
			'size'             => 'normal',
			'launcher_text'    => '',
			'icon'             => 'chat',
			'title'            => '',
			'subtitle'         => '',
			'greeting'         => '',
			'offline_text'     => '',
			'logo_id'          => 0,
			'show_agents'      => true,
			'form_enabled'     => true,
			'fields'           => array(
				array(
					'id'       => 'name',
					'type'     => 'name',
					'label'    => '',
					'required' => true,
					'options'  => '',
				),
				array(
					'id'       => 'email',
					'type'     => 'email',
					'label'    => '',
					'required' => true,
					'options'  => '',
				),
			),
			'consent'          => false,
			'consent_text'     => '',
			'channels'         => array(),
			'channels_mode'    => 'offline',
			'display_rule'     => 'all',
			'display_pages'    => array(),
			'display_devices'  => 'all',
			'display_visitors' => 'all',
			'auto_open'        => 0,
			'email_to'         => '',
			'email_new'        => 'offline',
			'email_replies'    => true,
			'transcript'       => true,
			'rating'           => true,
			'store_ip'         => false,
			'retention_days'   => 0,
			'delete_data'      => false,
			'block_list'       => '',
		);
	}

	public static function get( $key = null ) {
		if ( null === self::$cache ) {
			$saved       = get_option( self::OPTION, array() );
			self::$cache = wp_parse_args( is_array( $saved ) ? $saved : array(), self::defaults() );
		}
		if ( null === $key ) {
			return self::$cache;
		}
		return self::$cache[ $key ] ?? null;
	}

	public static function save( $input ) {
		$clean = self::sanitize( $input );
		update_option( self::OPTION, $clean, true );
		self::$cache = null;
		return self::get();
	}

	public static function sanitize( $in ) {
		$def = self::defaults();
		$in  = is_array( $in ) ? $in : array();
		$out = array();

		$bool = function ( $key ) use ( $in, $def ) {
			return isset( $in[ $key ] ) ? rest_sanitize_boolean( $in[ $key ] ) : $def[ $key ];
		};
		$pick = function ( $key, $allowed ) use ( $in, $def ) {
			return isset( $in[ $key ] ) && in_array( $in[ $key ], $allowed, true ) ? $in[ $key ] : $def[ $key ];
		};
		$int  = function ( $key, $min, $max ) use ( $in, $def ) {
			return isset( $in[ $key ] ) && is_numeric( $in[ $key ] ) ? max( $min, min( $max, (int) $in[ $key ] ) ) : $def[ $key ];
		};
		$text = function ( $key, $max, $multiline = false ) use ( $in ) {
			$value = isset( $in[ $key ] ) && is_scalar( $in[ $key ] ) ? (string) $in[ $key ] : '';
			$value = $multiline ? sanitize_textarea_field( $value ) : sanitize_text_field( $value );
			return mb_substr( $value, 0, $max );
		};

		foreach ( array( 'enabled', 'hours_enabled', 'show_agents', 'form_enabled', 'consent', 'email_replies', 'transcript', 'rating', 'store_ip', 'delete_data' ) as $key ) {
			$out[ $key ] = $bool( $key );
		}

		$out['availability']     = $pick( 'availability', array( 'auto', 'online', 'offline' ) );
		$out['position']         = $pick( 'position', array( 'right', 'left' ) );
		$out['size']             = $pick( 'size', array( 'normal', 'compact' ) );
		$out['icon']             = $pick( 'icon', self::ICONS );
		$out['channels_mode']    = $pick( 'channels_mode', array( 'always', 'offline' ) );
		$out['display_rule']     = $pick( 'display_rule', array( 'all', 'only', 'except' ) );
		$out['display_devices']  = $pick( 'display_devices', array( 'all', 'desktop', 'mobile' ) );
		$out['display_visitors'] = $pick( 'display_visitors', array( 'all', 'guests', 'users' ) );
		$out['email_new']        = $pick( 'email_new', array( 'offline', 'always', 'never' ) );

		$out['offset_x']       = $int( 'offset_x', 0, 200 );
		$out['offset_y']       = $int( 'offset_y', 0, 200 );
		$out['auto_open']      = $int( 'auto_open', 0, 600 );
		$out['retention_days'] = $int( 'retention_days', 0, 3650 );
		$out['logo_id']        = $int( 'logo_id', 0, PHP_INT_MAX );

		$color        = isset( $in['color'] ) ? sanitize_hex_color( $in['color'] ) : '';
		$out['color'] = $color ? $color : $def['color'];

		$out['reply_time']    = $text( 'reply_time', 120 );
		$out['launcher_text'] = $text( 'launcher_text', 40 );
		$out['title']         = $text( 'title', 80 );
		$out['subtitle']      = $text( 'subtitle', 120 );
		$out['greeting']      = $text( 'greeting', 500, true );
		$out['offline_text']  = $text( 'offline_text', 500, true );
		$out['consent_text']  = $text( 'consent_text', 300, true );
		$out['block_list']    = $text( 'block_list', 5000, true );

		$emails = array();
		foreach ( preg_split( '/[\s,;]+/', isset( $in['email_to'] ) && is_string( $in['email_to'] ) ? $in['email_to'] : '' ) as $email ) {
			$email = sanitize_email( $email );
			if ( $email && is_email( $email ) && count( $emails ) < 5 ) {
				$emails[] = $email;
			}
		}
		$out['email_to'] = implode( ', ', array_unique( $emails ) );

		$out['hours'] = $def['hours'];
		if ( isset( $in['hours'] ) && is_array( $in['hours'] ) ) {
			for ( $day = 0; $day < 7; $day++ ) {
				$row = isset( $in['hours'][ $day ] ) && is_array( $in['hours'][ $day ] ) ? $in['hours'][ $day ] : array();
				foreach ( array( 'from', 'to' ) as $edge ) {
					if ( isset( $row[ $edge ] ) && is_string( $row[ $edge ] ) && preg_match( '/^([01]\d|2[0-3]):[0-5]\d$/', $row[ $edge ] ) ) {
						$out['hours'][ $day ][ $edge ] = $row[ $edge ];
					}
				}
				$out['hours'][ $day ]['on'] = ! empty( $row['on'] ) && rest_sanitize_boolean( $row['on'] );
			}
		}

		$out['fields'] = isset( $in['fields'] ) && is_array( $in['fields'] ) ? self::sanitize_fields( $in['fields'] ) : $def['fields'];

		$out['channels'] = array();
		if ( isset( $in['channels'] ) && is_array( $in['channels'] ) ) {
			foreach ( array_slice( $in['channels'], 0, 8 ) as $channel ) {
				$channel = self::sanitize_channel( $channel );
				if ( $channel ) {
					$out['channels'][] = $channel;
				}
			}
		}

		$out['display_pages'] = array();
		if ( isset( $in['display_pages'] ) && is_array( $in['display_pages'] ) ) {
			$out['display_pages'] = array_values( array_unique( array_filter( array_map( 'absint', array_slice( $in['display_pages'], 0, 200 ) ) ) ) );
		}

		return $out;
	}

	private static function sanitize_fields( $fields ) {
		$out  = array();
		$ids  = array();
		$core = array();
		foreach ( array_slice( $fields, 0, 12 ) as $index => $field ) {
			if ( ! is_array( $field ) || ! isset( $field['type'] ) || ! in_array( $field['type'], self::FIELD_TYPES, true ) ) {
				continue;
			}
			$type = $field['type'];
			// one name, one email and one phone field fill the conversation's own columns
			if ( in_array( $type, array( 'name', 'email', 'phone' ), true ) ) {
				if ( isset( $core[ $type ] ) ) {
					continue;
				}
				$core[ $type ] = true;
				$id            = $type;
			} else {
				$id = isset( $field['id'] ) ? substr( sanitize_key( $field['id'] ), 0, 20 ) : '';
				if ( '' === $id || in_array( $id, array( 'name', 'email', 'phone' ), true ) || isset( $ids[ $id ] ) ) {
					$id = 'f' . $index . wp_rand( 100, 999 );
				}
			}
			$ids[ $id ] = true;
			$out[]      = array(
				'id'       => $id,
				'type'     => $type,
				'label'    => mb_substr( sanitize_text_field( isset( $field['label'] ) ? (string) $field['label'] : '' ), 0, 100 ),
				'required' => ! empty( $field['required'] ) && rest_sanitize_boolean( $field['required'] ),
				'options'  => 'select' === $type ? mb_substr( sanitize_textarea_field( isset( $field['options'] ) ? (string) $field['options'] : '' ), 0, 1000 ) : '',
			);
		}
		return $out;
	}

	private static function sanitize_channel( $channel ) {
		if ( ! is_array( $channel ) || ! isset( $channel['type'] ) || ! in_array( $channel['type'], self::CHANNEL_TYPES, true ) ) {
			return null;
		}
		$type  = $channel['type'];
		$value = isset( $channel['value'] ) && is_string( $channel['value'] ) ? trim( $channel['value'] ) : '';
		switch ( $type ) {
			case 'whatsapp':
			case 'phone':
				$value = preg_replace( '/[^0-9+]/', '', $value );
				break;
			case 'messenger':
			case 'telegram':
				// the name from a full link too: m.me/name, facebook.com/name/, t.me/name?start=x
				$value = preg_replace( '/[^A-Za-z0-9_.]/', '', preg_replace( '#^.*/#', '', rtrim( preg_replace( '/[?#].*$/', '', $value ), '/' ) ) );
				break;
			case 'email':
				$value = is_email( sanitize_email( $value ) ) ? sanitize_email( $value ) : '';
				break;
			default:
				$value = esc_url_raw( $value, array( 'http', 'https' ) );
		}
		if ( '' === $value ) {
			return null;
		}
		return array(
			'type'  => $type,
			'label' => mb_substr( sanitize_text_field( isset( $channel['label'] ) ? (string) $channel['label'] : '' ), 0, 60 ),
			'value' => mb_substr( $value, 0, 300 ),
		);
	}

	public static function channel_url( $channel ) {
		$value = $channel['value'];
		switch ( $channel['type'] ) {
			case 'whatsapp':
				return 'https://wa.me/' . ltrim( $value, '+' );
			case 'messenger':
				return 'https://m.me/' . $value;
			case 'telegram':
				return 'https://t.me/' . $value;
			case 'phone':
				return 'tel:' . $value;
			case 'email':
				return 'mailto:' . $value;
			default:
				return $value;
		}
	}

	public static function notify_emails() {
		$to = self::get( 'email_to' );
		return $to ? array_map( 'trim', explode( ',', $to ) ) : array( get_option( 'admin_email' ) );
	}

	// the texts the site owner can change, when left empty
	public static function default_texts() {
		return array(
			'title'    => __( 'Chat with us', 'softicon-live-chat' ),
			'greeting' => __( 'Hi! How can we help you today?', 'softicon-live-chat' ),
			'offline'  => __( 'We are away right now. Leave a message and we will reply by email.', 'softicon-live-chat' ),
			'consent'  => __( 'I agree that my data is stored to answer my message.', 'softicon-live-chat' ),
		);
	}

	// visitor-facing texts with translated defaults
	public static function texts() {
		$s   = self::get();
		$def = self::default_texts();
		return array(
			'title'         => $s['title'] ? $s['title'] : $def['title'],
			'subtitle'      => $s['subtitle'],
			'greeting'      => $s['greeting'] ? $s['greeting'] : $def['greeting'],
			'offline'       => $s['offline_text'] ? $s['offline_text'] : $def['offline'],
			'replyTime'     => $s['reply_time'],
			'launcher'      => $s['launcher_text'],
			'consent'       => $s['consent_text'] ? $s['consent_text'] : $def['consent'],
			'online'        => __( 'Online', 'softicon-live-chat' ),
			'away'          => __( 'Away', 'softicon-live-chat' ),
			'open'          => __( 'Open chat', 'softicon-live-chat' ),
			'close'         => __( 'Close chat', 'softicon-live-chat' ),
			'email'         => __( 'Email', 'softicon-live-chat' ),
			'message'       => __( 'Message', 'softicon-live-chat' ),
			/* translators: %s: name of a form field */
			'requiredField' => __( '%s is required.', 'softicon-live-chat' ),
			'acceptConsent' => __( 'Please accept the privacy notice.', 'softicon-live-chat' ),
			'optional'      => __( 'optional', 'softicon-live-chat' ),
			'choose'        => __( 'Choose…', 'softicon-live-chat' ),
			'start'         => __( 'Start chat', 'softicon-live-chat' ),
			'leave'         => __( 'Send message', 'softicon-live-chat' ),
			'placeholder'   => __( 'Write a message…', 'softicon-live-chat' ),
			'send'          => __( 'Send', 'softicon-live-chat' ),
			'typing'        => __( 'Typing…', 'softicon-live-chat' ),
			'seen'          => __( 'Seen', 'softicon-live-chat' ),
			'end'           => __( 'End chat', 'softicon-live-chat' ),
			'more'          => __( 'More options', 'softicon-live-chat' ),
			'endAsk'        => __( 'End this chat?', 'softicon-live-chat' ),
			'yes'           => __( 'Yes, end it', 'softicon-live-chat' ),
			'no'            => __( 'Cancel', 'softicon-live-chat' ),
			'ended'         => __( 'This chat has ended.', 'softicon-live-chat' ),
			'rate'          => __( 'How was this chat?', 'softicon-live-chat' ),
			'good'          => __( 'Good', 'softicon-live-chat' ),
			'bad'           => __( 'Bad', 'softicon-live-chat' ),
			'comment'       => __( 'Add a comment (optional)', 'softicon-live-chat' ),
			'transcript'    => __( 'Email me a copy of this chat', 'softicon-live-chat' ),
			'submit'        => __( 'Submit', 'softicon-live-chat' ),
			'thanks'        => __( 'Thank you!', 'softicon-live-chat' ),
			'newChat'       => __( 'Start a new chat', 'softicon-live-chat' ),
			'sentAway'      => __( 'Thanks! We got your message and will reply by email as soon as we can.', 'softicon-live-chat' ),
			'error'         => __( 'Something went wrong. Please try again.', 'softicon-live-chat' ),
			'offlineNet'    => __( 'Connection lost. Retrying…', 'softicon-live-chat' ),
			'invalidEmail'  => __( 'Please enter a valid email address.', 'softicon-live-chat' ),
			'orReach'       => __( 'Or reach us on', 'softicon-live-chat' ),
			/* translators: %d: number of unread messages */
			'unread'        => __( 'Open chat, unread messages: %d', 'softicon-live-chat' ),
			'whatsapp'      => 'WhatsApp',
			'messenger'     => 'Messenger',
			'telegram'      => 'Telegram',
			'call'          => __( 'Call', 'softicon-live-chat' ),
			'mail'          => __( 'Email', 'softicon-live-chat' ),
			'link'          => __( 'Contact', 'softicon-live-chat' ),
		);
	}
}
