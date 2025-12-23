const express = require('express')
const route = express.Router();

route.use("/auth", require("./auth/auth.route"))
route.use("/task", require("./Task/task"))
route.use("/brands", require("./brand.route"))

module.exports = route;