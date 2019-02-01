// Convert an upa to an arango object key
// '1/2/3' -> '1:2:3'
module.exports = upa => upa.replace(/\//g, ':')
