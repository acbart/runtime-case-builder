const path = require('path');
const webpack = require("webpack");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require("copy-webpack-plugin");
const {CleanWebpackPlugin} = require('clean-webpack-plugin');
const dev = process.env.NODE_ENV !== 'production'
mode = process.env.NODE_ENV || 'development'


module.exports = {
    mode: 'development',
    entry: './src/index.js',
    output: {
        filename: 'main.js',
        path: path.resolve(__dirname, 'dist'),
    },
    devServer: {
        contentBase: './dist',
    },
    performance: {
        hints: false,
        maxEntrypointSize: 512000,
        maxAssetSize: 512000
    },
    devtool: dev ? 'eval-cheap-module-source-map' : 'source-map',

    module: {
        rules: [
            {
                test: /\.js$/,
                include: path.resolve(__dirname, 'src'),
                loader: 'babel-loader',
            },
            {
                test: /\.s[ac]ss$/i,
                include: path.resolve(__dirname, 'src'),
                use: ['style-loader', 'css-loader', "sass-loader"],
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            },
            {
                include: path.resolve(__dirname, 'node_modules/@fortawesome/'),
                test: /\.(ico|jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2)(\?.*)?$/,
                use: {
                    loader: 'file-loader',
                    options: {
                        name: '[path][name].[ext]',
                    },
                },
            },
        ]
    },
    plugins: [
        new CleanWebpackPlugin({cleanStaleWebpackAssets: false}),
        new webpack.ProvidePlugin({
            $: 'jquery',
            jQuery: 'jquery'
        }),
        new CopyPlugin({
            patterns: [
                {from: "libs/*.js"},
            ],
        }),
        new HtmlWebpackPlugin({
            template: 'src/index.html',
            title: 'Runtime Case Builder',
        }),
    ]
};