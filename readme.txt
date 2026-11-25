=== Live Chat – Self-Hosted Chat Widget for Customer Support ===
Contributors: softiconai
Tags: live chat, chat, customer support, support chat, helpdesk
Requires at least: 6.5
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.0.1
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Free live chat for WordPress with no account or API key. Chats stay in your own database. Agent inbox, offline form and WhatsApp buttons.

== Description ==

Live chat that runs on your own WordPress site. No account, no trial, no monthly fee, no limits on agents or chats.

[Documentation](https://softiconai.com/docs/live-chat/) | [Live demo](https://softiconai.com/products/live-chat/demos/) | [Website](https://softiconai.com/products/live-chat/) | [Support](https://wordpress.org/support/plugin/softicon-live-chat/)

https://www.youtube.com/watch?v=_q6ChHFN0qw

**New to it?** Watch the [4-minute walkthrough](https://www.youtube.com/watch?v=Ut1rL5HBLqM), from installing the plugin to answering your first visitor, or [every setting, explained](https://www.youtube.com/watch?v=VLPyIS-lNDc) in 2 minutes.

SoftIcon Live Chat adds a chat button to your site. Visitors write to you, and you answer from an inbox in wp-admin. Everything runs on your own WordPress site: the chats are stored in your own database and never pass through another company's servers.

There is nothing to sign up for. No account, no API key, no trial that ends, and no limit on agents, chats or visitors.

= Why another live chat? =

* **No account and no trial.** Most chat plugins are a front end for a paid service. This one is the whole thing.
* **Your data stays with you.** Chats, names and emails are in your database. Good for privacy laws such as GDPR.
* **Works with page caching.** The chat does not rely on WordPress nonces, so cached pages never break it.
* **Light.** The page loads one small script and stylesheet (under 9 KB gzipped together). The chat window loads only when a visitor opens it.
* **No conflicts with your theme.** The widget lives in its own shadow DOM: your theme's styles cannot break it, and it cannot break your theme. It uses your site's font.

= For your visitors =

* A chat button in the bottom corner, with your color, icon and text.
* Normal or compact size. Full screen on phones.
* A form before the chat, built by you: name, email, phone, short text, long text, dropdown or checkbox, each required or optional.
* An optional privacy notice they must accept.
* When you are away, an offline form: their message reaches your inbox and your email.
* WhatsApp, Messenger, Telegram, phone and email buttons, shown always or only when you are offline.
* Typing indicator, "Seen", links that can be clicked.
* A rating at the end of the chat, and a copy of the chat by email if they ask.
* The chat stays open as they move from page to page.

= For you and your team =

* An inbox in wp-admin: waiting, mine, open and closed chats, with search.
* Sound, desktop notifications and a counter in the admin bar when a visitor writes.
* See the visitor's details, the page they are on, the pages they visited, where they came from and their device.
* WooCommerce: see a logged-in customer's latest orders next to the chat.
* Private notes only agents can see.
* Saved replies: type / and a shortcut to insert a ready answer.
* Take, transfer, end and reopen chats.
* An Agents page to choose who can answer chats. No role editor plugin needed.
* Online / Away switch for each agent.
* Business hours with your site's time zone.
* Emails when nobody is online, or when nobody answers within 2 minutes. Reply to the email to answer the visitor by email.
* When you answer after the visitor left, your answer is emailed to them.

= Show it where you want =

* On every page, only on some pages, or on every page except some.
* Computers only, phones only, or both. Everyone, guests only, or logged-in users only.
* The **Live Chat block** and the `[softicon_live_chat]` shortcode put the chat inside a page, for example on your Contact page.
* Any link to `#live-chat`, or any element with the class `allc-open`, opens the chat.

= Privacy =

* Tools → Export Personal Data and Erase Personal Data find chats by email address.
* Suggested text for your privacy policy page.
* IP addresses are not stored unless you turn that on.
* Chats with no activity for a number of days can be deleted automatically.
* No cookies. The visitor's browser storage keeps the last 10 pages of the current visit (sent only if the visitor starts a chat) and, once a chat starts, a random code for up to 30 days.

= Developers =

* PHP actions: `allc_loaded`, `allc_conversation_started`, `allc_visitor_message`, `allc_agent_message`, `allc_settings_saved`.
* PHP filters: `allc_widget_config`, `allc_show_widget`, `allc_is_open`, `allc_rate_limit`, `allc_allowed_hosts`, `allc_visitor_ip`, `allc_rest_routes`.

= Credits =

* Icons from Material Icons by Google, Apache License 2.0: https://github.com/google/material-design-icons

== Installation ==

1. Install and activate the plugin.
2. Go to **Live Chat → Settings** to pick your colors, form and business hours.
3. Keep **Live Chat → Inbox** open in a browser tab. While it is open (and you are not set to Away), visitors see that you are online.

== Frequently Asked Questions ==

= Is there a video tutorial? =

Yes, two. The [full walkthrough](https://www.youtube.com/watch?v=Ut1rL5HBLqM) (4:06) goes from installing the plugin to answering visitors. Jump to a part:

* [Settings and the live preview](https://www.youtube.com/watch?v=Ut1rL5HBLqM&t=26s)
* [The form before the chat](https://www.youtube.com/watch?v=Ut1rL5HBLqM&t=58s)
* [WhatsApp and email buttons](https://www.youtube.com/watch?v=Ut1rL5HBLqM&t=73s)
* [What the visitor sees](https://www.youtube.com/watch?v=Ut1rL5HBLqM&t=97s)
* [The inbox: take a chat and answer](https://www.youtube.com/watch?v=Ut1rL5HBLqM&t=120s)
* [Saved replies and private notes](https://www.youtube.com/watch?v=Ut1rL5HBLqM&t=160s)
* [Transfer, end the chat and the rating](https://www.youtube.com/watch?v=Ut1rL5HBLqM&t=178s)
* [Offline messages answered by email](https://www.youtube.com/watch?v=Ut1rL5HBLqM&t=200s)
* [The Live Chat block in a page](https://www.youtube.com/watch?v=Ut1rL5HBLqM&t=219s)

[Every setting, explained](https://www.youtube.com/watch?v=VLPyIS-lNDc) (2:21) goes through each settings tab. The Plugins screen, the settings page and the empty inbox link to these videos too.

= Do I need an account anywhere? =

No. The plugin is the whole chat system. It does not connect to any outside chat service.

= How do I know when someone writes? =

The inbox plays a sound and can show desktop notifications. On other wp-admin pages, the admin bar shows a counter. When nobody is online, or nobody answers within 2 minutes, you get an email.

= Why does the chat say "Away" although I am logged in? =

You count as online while wp-admin is open in a browser and your status is "Online" (top of the inbox). You can also set **Settings → General → When are you online?** to "Always online".

= Emails do not arrive =

WordPress sends email through your server, and many hosts do not deliver it well. Install an SMTP plugin and use **Settings → Emails → Send a test email**. Every chat is in the inbox too, so nothing is lost.

= Does it work with caching plugins? =

Yes. The page holds only settings that are the same for every visitor, and the chat itself talks to the server directly. After changing the look in the settings, clear your page cache so visitors get the new version. If a "delay JavaScript" option hides the chat button until the visitor scrolls, exclude `softicon-live-chat` from it.

= Is it fast enough without WebSockets? =

Yes. Most shared hosting cannot keep WebSockets open, so the chat checks for new messages every 3 seconds during a conversation, slows down when it is quiet, and nearly stops when the tab is hidden. Visitors who do not open the chat cause no requests, except on a page with the Live Chat block or when the chat opens by itself.

= My site is behind Cloudflare or another proxy =

To stop spam, the plugin limits how many chats one IP address can start. Behind a proxy, all visitors can seem to come from the proxy's address. Most hosts pass the real address on already. If yours does not, set it with the `allc_visitor_ip` filter, using only a header your proxy sets, for example `CF-Connecting-IP` on Cloudflare.

= Can other users answer chats? =

Yes. Go to **Live Chat → Settings → Agents** and add them. Administrators can always answer.

= Can I put the chat on my Contact page instead of the corner? =

Yes. Add the **Live Chat** block, or the `[softicon_live_chat]` shortcode in a page builder. On that page the corner button is hidden. To show the chat only there, turn off **Show the chat button on the site**.

= Does it work with WPML or Polylang? =

The plugin is fully translatable and follows the language of the page. The texts you write in the settings can be translated with WPML String Translation.

= Where is the data stored? =

In two tables in your WordPress database (`wp_allc_conversations` and `wp_allc_messages`). When you delete the plugin, the data stays unless you turned on **Settings → Privacy & spam → Delete all chats and settings when the plugin is deleted**.

== External services ==

This plugin does not connect to any external service.

The optional WhatsApp, Messenger, Telegram, phone and email buttons are plain links (wa.me, m.me, t.me, tel: and mailto:). Nothing is sent to these services when the page loads. Only when a visitor clicks a button does their browser open that service, under that service's own terms and privacy policy:

* WhatsApp: https://www.whatsapp.com/legal/terms-of-service and https://www.whatsapp.com/legal/privacy-policy
* Messenger (Meta): https://www.facebook.com/terms.php and https://www.facebook.com/privacy/policy/
* Telegram: https://telegram.org/tos and https://telegram.org/privacy

== Screenshots ==

1. The chat on your site.
2. The form before the chat, built in the settings.
3. The inbox in wp-admin, with the visitor's details.
4. The offline form with WhatsApp and email buttons.
5. The settings with a live preview.
6. The chat inside a page with the Live Chat block.

== Changelog ==

= 1.0.1 =
* Links to the video tutorials on the Plugins screen, the settings page and the empty inbox.
* Fixed: the number of waiting chats in the admin bar was taller than the bar.

= 1.0.0 =
* First release.

== Upgrade Notice ==

= 1.0.1 =
Adds links to the video tutorials.

= 1.0.0 =
First release.
