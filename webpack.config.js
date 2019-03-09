const path = require('path');

module.exports = {
  entry: path.resolve(__dirname, 'src/index.js'),
  devServer: {
    contentBase: path.resolve(__dirname, 'docs')
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'docs')
  }
};
