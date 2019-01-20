
const nodeExternals = require('webpack-node-externals')
const path = require("path");

module.exports = {

    mode: 'production',

    entry: {
        server: './dist/server.js',
    },

    output: {
        path: path.join(__dirname, 'dist'),
        publicPath: '/',
        filename: 'bundle.js'
    },

    target: 'node',
    node: {
        // Need this when working with express, otherwise the build fails
        __dirname: false,   // if you don't put this is, __dirname
        __filename: false,  // and __filename return blank or /
    },

    externals: [ nodeExternals() ] // Need this to avoid error when working with Express

}