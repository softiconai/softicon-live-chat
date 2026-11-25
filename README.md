# Live Chat – Self-Hosted Chat Widget for Customer Support

A live chat plugin for WordPress that runs on your own site. Visitors chat from a small widget, agents answer from an inbox in wp-admin. No account, no external servers: the chats stay in your own database.

WordPress.org: https://wordpress.org/plugins/softicon-live-chat/

Videos:

- [Full walkthrough](https://www.youtube.com/watch?v=Ut1rL5HBLqM) (4:06): install, set up and answer your visitors
- [Every setting, explained](https://www.youtube.com/watch?v=VLPyIS-lNDc) (2:21)
- [30-second promo](https://www.youtube.com/watch?v=_q6ChHFN0qw)

[![Full walkthrough](https://img.youtube.com/vi/Ut1rL5HBLqM/maxresdefault.jpg)](https://www.youtube.com/watch?v=Ut1rL5HBLqM)

## Development

```bash
npm install
npm run start   # watch
npm run build   # production build
npm run lint
npm run zip     # build + translations + release zip
```

The widget (`src/widget/`) is plain JavaScript in a shadow root. The inbox, the settings and the block (`src/admin/`, `src/block/`) use React from `@wordpress/scripts`. Images for the WordPress.org page are in `.wordpress-org/`.

## License

GPLv2 or later.
