const fs = require('fs');
const moment = require("moment");
require("moment-timezone");

module.exports = {
  logPup: (...args) => {
    const date = moment().tz("Europe/Prague").format("DD.MM.YYYY HH:mm:ss");
    const text = args.join(" ");
    fs.appendFileSync("logPup.log", `${date} ${text}\n`);
  }
}