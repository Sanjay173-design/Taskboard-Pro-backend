const { res } = require("./utils/response");

module.exports.health = async () => {
  return res(200, { status: "TaskBoard Pro API running 🚀" });
};
