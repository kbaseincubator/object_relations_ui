// Convert an arango object key to an upa
// '1:2:3' -> '1/2/3'
module.exports = key => key.replace(/:/g, '/')
