<?php
/**
 * The chat inside a page. The widget script finds the [data-allc-inline] box and mounts the chat in it.
 *
 * @package SoftIcon_Live_Chat
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$allc_height = isset( $attributes['height'] ) ? (int) $attributes['height'] : 520;
?>
<div <?php echo get_block_wrapper_attributes(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped by WordPress ?>>
	<?php echo ALLC_Live_Chat\Widget::inline( $allc_height ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- built from escaped parts ?>
</div>
