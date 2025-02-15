const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    mode: 'development',
    entry: {
        admin: './client/admin.js',
        votant: './client/votant.js'
    },
    output: {
        path: path.resolve(__dirname, 'public/dist'),
        filename: '[name].bundle.js',
        clean: true
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            }
        ]
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './client/admin.html',
            filename: 'admin.html',
            chunks: ['admin']
        }),
        new HtmlWebpackPlugin({
            template: './client/votant.html',
            filename: 'votant.html',
            chunks: ['votant']
        })
    ]
}