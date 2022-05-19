// 引入包
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const TerserWebpackPlugin = require("terser-webpack-plugin");
const HTMLWebpackPlugin = require('html-webpack-plugin');

// webpack 的配置信息
module.exports = {
	mode: 'production',
	// 配置入口
	entry: {
		// 背景页脚本
		background: path.resolve(__dirname, "..", "src", "background.ts"),
		// 内容注入脚本
		content: path.resolve(__dirname, "..", "src", "content.ts"),
		// 窗口脚本
		popup: path.resolve(__dirname, "..", "src", "popup.ts"),
		// 选项页脚本
		options: path.resolve(__dirname, "..", "src", "options.ts"),
		// 统计页脚本
		statistics: path.resolve(__dirname, "..", "src/statistics/", "statistics.ts"),
		// 统计页脚本
		mpwx: path.resolve(__dirname, "..", "src/mpwx/", "mp.ts"),
	},

	// 配置输出
	output: {
		// 打包路径（打包后的文件在哪）
		path: path.resolve(__dirname, '../dist'),
		// 打包后的文件名（使用文件本身的名字）
		filename: "[name].js"
	},

	// 设置模块如何被解析
	resolve: {
		// ts 和 js 文件可以作为模块使用
		extensions: [".ts", ".js"],
	},

	// 指定打包时要使用的模块
	module: {
		// 指定加载规则
		rules: [
			{
				// 指定使规则生效的文件
				test: /\.tsx?$/,
				// 指定要使用的 loader
				use: [
					// 'babel-loader',
					'ts-loader'
				],
				// 指定要排除的文件
				exclude: /node-modules/
			}
		]
	},

	// 配置插件
	plugins: [
		// CleanWebpackPlugin 用来在打包前清空打包文件夹
		new CleanWebpackPlugin(),
		// CopyPlugin 用来复制文件到指定位置
		new CopyPlugin({
			patterns: [
				// from 相对于 context
				// to 相对于编译文件夹
				{from: ".", to: ".", context: "wereader-chrome"},
				{from: "manifest.json", to: ".", context: "public"},
				{from: "extension-icons", to: "./icons/extension-icons", context: "public"},
				{from: "popup/static/css/popup.css", to: ".", context: "src"},
				{from: "statistics/statistics.css", to: ".", context: "src"},
				{from: "content/static/css", to: "./content/static/css", context: "src"},
				{from: "mpwx/mp.css", to: ".", context: "src"},
				{from: "options.css", to: ".", context: "src/options"},
				{from: "icons", to: "./icons/options-icons", context: "src/options"}
			]
		}),
		new HTMLWebpackPlugin({
			filename: 'popup.html',
			template: 'src/popup/popup.html',
			// 将 scripts 放到 body 末尾
			inject: 'body',
			minify: {
				removeComments: true,
				collapseWhitespace: true
			},
			// 要引入到 HTML 中的打包好的 js 脚本
			chunks: ['popup']
		}),
		new HTMLWebpackPlugin({
			filename: 'statistics.html',
			template: 'src/statistics/statistics.html',
			inject: 'body',
			minify: {
				removeComments: true,
				collapseWhitespace: true
			},
			chunks: ['statistics']
		}),
		new HTMLWebpackPlugin({
			filename: 'mp.html',
			template: 'src/mpwx/mp.html',
			inject: 'body',
			minify: {
				removeComments: true,
				collapseWhitespace: true
			},
			chunks: ['mp']
		}),
		new HTMLWebpackPlugin({
			filename: 'options.html',
			template: 'src/options/options.html',
			inject: 'body',
			minify: {
				removeComments: true,
				collapseWhitespace: true
			},
			chunks: ['options']
		}),
		new HTMLWebpackPlugin({
			filename: 'bg.html',
			template: 'src/background/bg.html',
			inject: 'body',
			minify: {
				removeComments: true,
				collapseWhitespace: true
			},
			chunks: ['background']
		}),
	],

	optimization: {
		// 压缩代码
		minimize: true,
		// https://github.com/terser/terserx
		minimizer: [new TerserWebpackPlugin ({
			// 清除 console.log
			terserOptions: {
				compress: {
					// pure_funcs: ['console.log']
				},
			}
		})],
	},
}