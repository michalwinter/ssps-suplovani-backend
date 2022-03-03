const express = require("express");
const app = express();
const moment = require("moment");
const puppeteer = require('puppeteer');
const cors = require("cors");
const mongoose = require("mongoose");
const { logPup } = require("./logger");
require("dotenv").config()

const Days = mongoose.model("days", new mongoose.Schema({
  date: String,
  list: Array,
}))

mongoose.connect(`mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_IP}/sspsag-suplovani?authSource=admin`, { useNewUrlParser: true });
mongoose.connection.on("connected", async () => {
  console.log("Server connected to database.");
});

app.use(cors());

const getData = async () => {
  const ulr = "https://ssps.cz/";
  logPup("Starting browser.");
  const browser = await puppeteer.launch({ignoreDefaultArgs: ['--disable-extensions']});
  logPup("Browser started, creating page.");
  const page = await browser.newPage();
  logPup("Page created, opening url.");
  await page.goto(ulr);
  let titles = await page.$$eval(".supplementation-report strong", els => els.map(el => el.innerText));
  const lists = await page.$$eval(".supplementation-report ul", els => els.map(el => el.innerText));
  const data = [];
  for (let i = 0; i < titles.length; i++) {
    let title = titles[i];
    let date = title.split(" ").slice(3).join(" ");
    date = moment(date, "D. M. YYYY").toISOString();
    data.push({
      date,
      list: null
    });
  }
  for (let i = 0; i < lists.length; i++) {
    const suplovani = lists[i].split("\n").map(item => item.split("").slice(1).join(""));
    data[i].list = [];
    for (let j = 0; j < suplovani.length; j++) {
      let content = suplovani[j].split(" ");
      let text = content.slice(1).join(" ");
      let grade = content[0];
      let hour = content[1].split(",").map(item => parseInt(item.slice(0, item.indexOf("."))));
      let type = "other";
      if (content.includes("supluje")) type = "supl";
      if (content.includes("odpadá")) type = "odp";
      data[i].list[j] = { text, grade, hour, type };
    }
  }
  await browser.close();
  logPup("Browser closed.");
  for (let i = 0; i < data.length; i++) {
    const day = data[i];
    //Find if day is in database
    const dayInDb = await Days.findOne({ date: day.date });
    if (dayInDb) {
      //Update day
      dayInDb.list = day.list;
      await dayInDb.save();
    } else {
      //Create day
      await Days.create(day);
    }
  }
  logPup("Data updated.");
};

getData();

const getDataEvery5Minutes = () => {
  const now = moment();
  const hour = now.hour() + 1;
  const minute = now.minute();
  if (hour < 5 || hour > 20) return;
  if (minute % 5 === 0) {
    logPup("Running getData.");
    getData();
  }
};

getDataEvery5Minutes();
setInterval(getDataEvery5Minutes, 15000);

app.get("/suplovani", async (req, res) => {
  const days = await Days.find().sort({ date: -1 }).limit(5);
  res.send(days);
});

app.listen(6574, () => console.log("Server is running on 6574"))