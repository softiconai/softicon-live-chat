const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );

// drop the RTL stylesheet copies wp-scripts emits, the styles use logical properties instead
const plugins = defaultConfig.plugins.filter( ( p ) => ! ( Object.values( p ).length === 2 && Object.values( p )?.[ 1 ]?.filename === '[name]-rtl.css' ) );

const blockEntries = typeof defaultConfig.entry === 'function' ? defaultConfig.entry() : defaultConfig.entry;

module.exports = {
	...defaultConfig,
	entry: {
		...blockEntries,
		// the visitor widget: plain JS, no WordPress script dependencies; its panel is a lazy chunk
		widget: './src/widget/index.js',
		// wp-admin apps
		inbox: './src/admin/inbox/index.js',
		settings: './src/admin/settings/index.js',
		notify: './src/admin/notify.js',
	},
	// the lazy chunks get a version, so a browser never mixes a cached old chunk with a new widget.js
	output: { ...defaultConfig.output, chunkFilename: '[name].js?ver=[contenthash:8]' },
	plugins,
};
