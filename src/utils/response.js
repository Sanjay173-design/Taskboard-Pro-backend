module.exports.res = (statusCode, data) => ({
  statusCode,
  body: JSON.stringify(data),
});
