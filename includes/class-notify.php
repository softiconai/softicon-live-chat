<?php
namespace ALLC_Live_Chat;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Notify {

	const REMIND_AFTER = 120;

	private static function site() {
		return wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES );
	}

	private static function inbox_url( $conversation_id ) {
		return admin_url( 'admin.php?page=softicon-live-chat#/chat/' . (int) $conversation_id );
	}

	private static function send( $to, $subject, $body, $reply_to = '' ) {
		$headers = array( 'Content-Type: text/plain; charset=UTF-8' );
		if ( $reply_to && is_email( $reply_to ) ) {
			$headers[] = 'Reply-To: ' . $reply_to;
		}
		return wp_mail( $to, $subject, $body, $headers );
	}

	private static function visitor_lines( $conversation ) {
		$lines = array();
		if ( $conversation->name ) {
			/* translators: %s: visitor name */
			$lines[] = sprintf( __( 'Name: %s', 'softicon-live-chat' ), $conversation->name );
		}
		if ( $conversation->email ) {
			/* translators: %s: visitor email */
			$lines[] = sprintf( __( 'Email: %s', 'softicon-live-chat' ), $conversation->email );
		}
		if ( $conversation->phone ) {
			/* translators: %s: visitor phone number */
			$lines[] = sprintf( __( 'Phone: %s', 'softicon-live-chat' ), $conversation->phone );
		}
		foreach ( (array) json_decode( (string) $conversation->fields, true ) as $field ) {
			if ( isset( $field['label'], $field['value'] ) && '' !== $field['value'] ) {
				$lines[] = $field['label'] . ': ' . $field['value'];
			}
		}
		if ( $conversation->current_url ) {
			/* translators: %s: page address */
			$lines[] = sprintf( __( 'Page: %s', 'softicon-live-chat' ), $conversation->current_url );
		}
		return $lines;
	}

	// a new chat: mail now when nobody is online (or always, if set), otherwise later if nobody answers
	public static function new_conversation( $conversation, $message, $offline ) {
		$mode = Settings::get( 'email_new' );
		if ( 'never' === $mode ) {
			return;
		}
		if ( $offline || 'always' === $mode ) {
			if ( Store::claim_notify( $conversation->id ) ) {
				self::mail_new( $conversation, $message, $offline );
			}
			return;
		}
		self::schedule_reminder( $conversation->id );
	}

	// WP-Cron sends the reminder even when the visitor has left; sync() below is the fallback when cron is late
	public static function schedule_reminder( $conversation_id ) {
		if ( 'never' !== Settings::get( 'email_new' ) ) {
			wp_schedule_single_event( time() + self::REMIND_AFTER, 'allc_remind', array( (int) $conversation_id ) );
		}
	}

	public static function remind( $conversation_id ) {
		$conversation = Store::conversation( (int) $conversation_id );
		if ( $conversation ) {
			self::maybe_remind( $conversation, true );
		}
	}

	// $due: called by the cron event, which already waited
	public static function maybe_remind( $conversation, $due = false ) {
		if ( 'waiting' !== $conversation->status || $conversation->notified || 'never' === Settings::get( 'email_new' ) ) {
			return;
		}
		// counted from the visitor's last message, so a chat that comes back after being closed waits too
		if ( ! $due && time() - Store::time( $conversation->updated_at ) < self::REMIND_AFTER ) {
			return;
		}
		// a site-wide cap, so no script can flood the inbox of the site owner
		if ( ! Auth::rate( 'remind_site', 30, HOUR_IN_SECONDS, false ) || ! Store::claim_notify( $conversation->id ) ) {
			return;
		}
		$conversation->notified = 1;
		$first                  = Store::messages( $conversation->id );
		$first                  = $first ? $first[0]->body : '';
		self::mail_new( $conversation, $first, false );
	}

	private static function mail_new( $conversation, $message, $offline ) {
		$who     = $conversation->name ? $conversation->name : ( $conversation->email ? $conversation->email : __( 'A visitor', 'softicon-live-chat' ) );
		$subject = $offline
			/* translators: 1: site name, 2: visitor name */
			? sprintf( __( '[%1$s] New message from %2$s', 'softicon-live-chat' ), self::site(), $who )
			/* translators: 1: site name, 2: visitor name */
			: sprintf( __( '[%1$s] %2$s is waiting in live chat', 'softicon-live-chat' ), self::site(), $who );
		$body = implode( "\n", self::visitor_lines( $conversation ) ) . "\n\n" . $message . "\n\n"
			/* translators: %s: link to the chat in wp-admin */
			. sprintf( __( 'Answer in the inbox: %s', 'softicon-live-chat' ), self::inbox_url( $conversation->id ) );
		if ( $conversation->email ) {
			$body .= "\n" . __( 'You can also reply to this email to answer by email.', 'softicon-live-chat' );
		}
		self::send( Settings::notify_emails(), $subject, $body, $conversation->email );
	}

	// an agent answered while the visitor was away from the site: send the answer by email, at most every 15 minutes
	public static function agent_reply( $conversation, $message ) {
		if ( ! Settings::get( 'email_replies' ) || ! $conversation->email ) {
			return;
		}
		if ( time() - Store::time( $conversation->visitor_active_at ) < 90 ) {
			return;
		}
		if ( time() - Store::time( $conversation->visitor_emailed_at ) < 15 * MINUTE_IN_SECONDS ) {
			return;
		}
		Store::update( $conversation->id, array( 'visitor_emailed_at' => Store::now() ) );
		/* translators: %s: site name */
		$subject = sprintf( __( 'New reply from %s', 'softicon-live-chat' ), self::site() );
		$body    = Store::agent_name( $message->user_id ) . ":\n" . $message->body . "\n\n";
		if ( $conversation->current_url ) {
			/* translators: %s: page address */
			$body .= sprintf( __( 'Continue the chat: %s', 'softicon-live-chat' ), $conversation->current_url . '#live-chat' ) . "\n";
		}
		self::send( $conversation->email, $subject, $body, Settings::notify_emails()[0] );
	}

	public static function transcript( $conversation ) {
		if ( ! $conversation->email ) {
			return false;
		}
		$lines = array();
		foreach ( Store::all_messages( $conversation->id ) as $message ) {
			if ( 'system' === $message->type ) {
				continue;
			}
			$who     = 'agent' === $message->type ? Store::agent_name( $message->user_id ) : ( $conversation->name ? $conversation->name : __( 'You', 'softicon-live-chat' ) );
			$lines[] = '[' . wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), Store::time( $message->created_at ) ) . '] ' . $who . ":\n" . $message->body;
		}
		/* translators: %s: site name */
		$subject = sprintf( __( 'Your chat with %s', 'softicon-live-chat' ), self::site() );
		return self::send( $conversation->email, $subject, implode( "\n\n", $lines ), Settings::notify_emails()[0] );
	}

	public static function test() {
		/* translators: %s: site name */
		$subject = sprintf( __( '[%s] Live chat test email', 'softicon-live-chat' ), self::site() );
		$body    = __( 'This is a test from SoftIcon Live Chat. If you can read it, new chat emails will reach you.', 'softicon-live-chat' );
		return self::send( Settings::notify_emails(), $subject, $body );
	}
}
