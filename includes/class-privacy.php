<?php
namespace ALLC_Live_Chat;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Privacy {

	const PER_PAGE = 20;

	public static function init() {
		add_filter( 'wp_privacy_personal_data_exporters', array( __CLASS__, 'exporters' ) );
		add_filter( 'wp_privacy_personal_data_erasers', array( __CLASS__, 'erasers' ) );
		add_action( 'admin_init', array( __CLASS__, 'policy' ) );
		add_action( 'allc_daily', array( __CLASS__, 'cleanup' ) );
	}

	public static function exporters( $exporters ) {
		$exporters['softicon-live-chat'] = array(
			'exporter_friendly_name' => __( 'Live chat conversations', 'softicon-live-chat' ),
			'callback'               => array( __CLASS__, 'export' ),
		);
		return $exporters;
	}

	public static function erasers( $erasers ) {
		$erasers['softicon-live-chat'] = array(
			'eraser_friendly_name' => __( 'Live chat conversations', 'softicon-live-chat' ),
			'callback'             => array( __CLASS__, 'erase' ),
		);
		return $erasers;
	}

	public static function export( $email, $page = 1 ) {
		$rows = Store::by_email( $email, self::PER_PAGE, ( max( 1, (int) $page ) - 1 ) * self::PER_PAGE );
		$data = array();
		foreach ( $rows as $row ) {
			$items = array(
				array(
					'name'  => __( 'Started', 'softicon-live-chat' ),
					'value' => get_date_from_gmt( $row->created_at, get_option( 'date_format' ) . ' ' . get_option( 'time_format' ) ),
				),
				array(
					'name'  => __( 'Name', 'softicon-live-chat' ),
					'value' => $row->name,
				),
				array(
					'name'  => __( 'Email', 'softicon-live-chat' ),
					'value' => $row->email,
				),
				array(
					'name'  => __( 'Phone', 'softicon-live-chat' ),
					'value' => $row->phone,
				),
				array(
					'name'  => __( 'IP address', 'softicon-live-chat' ),
					'value' => $row->ip,
				),
				array(
					'name'  => __( 'Came from', 'softicon-live-chat' ),
					'value' => $row->referrer,
				),
				array(
					'name'  => __( 'Pages visited', 'softicon-live-chat' ),
					'value' => implode( "\n", wp_list_pluck( array_filter( (array) json_decode( (string) $row->pages, true ), 'is_array' ), 'url' ) ),
				),
				array(
					'name'  => __( 'Rating comment', 'softicon-live-chat' ),
					'value' => $row->rating_note,
				),
				array(
					'name'  => __( 'Browser', 'softicon-live-chat' ),
					'value' => $row->device,
				),
			);
			foreach ( (array) json_decode( (string) $row->fields, true ) as $field ) {
				if ( isset( $field['label'], $field['value'] ) ) {
					$items[] = array(
						'name'  => $field['label'],
						'value' => $field['value'],
					);
				}
			}
			$lines = array();
			foreach ( Store::all_messages( $row->id ) as $message ) {
				if ( 'visitor' === $message->type || 'agent' === $message->type ) {
					$lines[] = get_date_from_gmt( $message->created_at, get_option( 'date_format' ) . ' ' . get_option( 'time_format' ) ) . ' — ' . ( 'agent' === $message->type ? Store::agent_name( $message->user_id ) : __( 'Visitor', 'softicon-live-chat' ) ) . ': ' . $message->body;
				}
			}
			$items[] = array(
				'name'  => __( 'Messages', 'softicon-live-chat' ),
				'value' => implode( "\n", $lines ),
			);
			$data[]  = array(
				'group_id'    => 'softicon-live-chat',
				'group_label' => __( 'Live chat conversations', 'softicon-live-chat' ),
				'item_id'     => 'allc-conversation-' . $row->id,
				'data'        => array_filter(
					$items,
					function ( $item ) {
						return '' !== (string) $item['value'];
					}
				),
			);
		}
		return array(
			'data' => $data,
			'done' => count( $rows ) < self::PER_PAGE,
		);
	}

	// deleting is safer than anonymising here: the messages themselves are personal data
	public static function erase( $email ) {
		$rows = Store::by_email( $email, self::PER_PAGE, 0 );
		foreach ( $rows as $row ) {
			Store::delete( $row->id );
		}
		return array(
			'items_removed'  => count( $rows ),
			'items_retained' => false,
			'messages'       => array(),
			'done'           => count( $rows ) < self::PER_PAGE,
		);
	}

	public static function policy() {
		if ( ! function_exists( 'wp_add_privacy_policy_content' ) ) {
			return;
		}
		$text = '<p class="privacy-policy-tutorial">' . esc_html__( 'Suggested text for the live chat on your site. Change it to match your settings.', 'softicon-live-chat' ) . '</p>'
			. '<strong class="privacy-policy-tutorial">' . esc_html__( 'Suggested text:', 'softicon-live-chat' ) . ' </strong>'
			. '<p>' . esc_html__( 'When you use the live chat on this website, we store your messages and the details you enter (such as your name, email address and phone number), the pages you viewed on this site before and during the chat, and your browser\'s user agent, so we can answer you. If enabled, we also store your IP address. This data is stored on our own server and is not sent to any third-party chat service.', 'softicon-live-chat' ) . '</p>'
			. '<p>' . esc_html__( 'Your browser keeps the last pages you viewed on this site during your visit in local storage; they are sent to us only if you start a chat, so we can see where you need help. After you start a chat, your browser also keeps a random code for up to 30 days so you can continue the chat on other pages. No cookies are used. If you give your email address, we may send you our replies and, when you ask for it, a copy of the chat by email.', 'softicon-live-chat' ) . '</p>';
		wp_add_privacy_policy_content( __( 'SoftIcon Live Chat', 'softicon-live-chat' ), wp_kses_post( $text ) );
	}

	public static function cleanup() {
		$days = (int) Settings::get( 'retention_days' );
		if ( $days <= 0 ) {
			return;
		}
		$before = gmdate( 'Y-m-d H:i:s', time() - $days * DAY_IN_SECONDS );
		// in batches, up to 5,000 chats a day
		for ( $i = 0; $i < 10; $i++ ) {
			$ids = Store::idle_before( $before, 500 );
			Store::delete_many( $ids );
			if ( count( $ids ) < 500 ) {
				break;
			}
		}
	}
}
