// PostCSS configuration for Community Management Platform
// Integrates Tailwind CSS v3.0+ and advanced CSS processing features

module.exports = {
  plugins: [
    // Tailwind CSS v3.0+ - Utility-first CSS framework
    require('tailwindcss')('./tailwind.config.ts'),

    // Autoprefixer v10.0+ - Add vendor prefixes automatically
    require('autoprefixer')({
      flexbox: true,
      grid: true,
      overrideBrowserslist: [
        'last 2 versions',
        '> 1%',
        'not dead'
      ]
    }),

    // PostCSS Preset Env v8.0+ - Enable modern CSS features
    require('postcss-preset-env')({
      stage: 3,
      features: {
        'nesting-rules': true,
        'custom-properties': true,
        'custom-media-queries': true,
        'media-query-ranges': true,
        'custom-selectors': true,
        'gap-properties': true,
        'logical-properties-and-values': true,
        'color-functional-notation': true
      },
      autoprefixer: false, // Disable built-in autoprefixer as we're using it separately
      browsers: 'last 2 versions'
    })
  ]
}