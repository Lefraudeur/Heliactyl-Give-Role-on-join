//
//  * Fixed-Heliactyl
// 
//  * Heliactyl 12.8 (Based off of 12.7), Codename Flameing
//  * Copyright SRYDEN, Inc. & Overnode projets
//
"use strict";

// Load packages.
const fs = require("fs");
const chalk = require("chalk");
const fetch = require("node-fetch");
const cookieParser = require("cookie-parser");
const express = require("express");
const session = require("express-session");

// Buffer
global.Buffer = global.Buffer || require('buffer').Buffer;
global.btoa = global.btoa || ((str) => Buffer.from(str, 'binary').toString('base64')); 
global.atob = global.atob || ((b64) => Buffer.from(b64, 'base64').toString('binary')); 

// Load settings
const settings = require('./handlers/readSettings').settings(); 
const db = require("./handlers/db");
const themesettings = {
  pages: {},
  mustbeloggedin: []
};

const app = express();
require('express-ws')(app);

// Middleware setup
app.use(cookieParser(settings.website.secret));
app.use(session({
  secret: settings.website.secret,
  resave: false,
  saveUninitialized: false,
}));
app.use(express.json({
  inflate: true,
  limit: '500kb',
  strict: true,
  type: 'application/json'
}));

module.exports.db = db;
module.exports.app = app;

const listener = app.listen(settings.website.port, async () => {
  console.clear();
  console.log(`${chalk.bgBlue("  APPLICATION IS ONLINE  ")}\n`);
  console.log(`${chalk.cyan("[Heliactyl]")}${chalk.white(" Checking for updates...")}`);

  try {
    const response = await fetch('https://api.github.com/repos/OvernodeProjets/Fixed-Heliactyl/releases/latest');
    const { tag_name: latestVersion } = await response.json();

    if (latestVersion !== settings.version) {
      console.log(`${chalk.cyan("[Heliactyl]")}${chalk.yellow(" New version available!")}`);
      console.log(`${chalk.cyan("[Heliactyl]")}${chalk.white(` Current Version: ${settings.version}, Latest Version: ${latestVersion}`)}`);
    } else {
      console.log(`${chalk.cyan("[Heliactyl]")}${chalk.white(" Your application is up-to-date.")}`);
    }
  } catch (error) {
    console.error(`${chalk.cyan("[Heliactyl]")}${chalk.red(" Error checking for updates:")} ${error.message}`);
  }

  console.log(`${chalk.cyan("[Heliactyl]")}${chalk.white(" You can now access the dashboard at ")}${chalk.underline(`${settings.oauth2.link}/`)}`);
});

const rateLimitCache = new Map();

// Handle rate limiting.
app.use((req, res, next) => {
  const limitInfo = settings.ratelimits[req.path];
  if (!limitInfo) return next();

  const rateLimitKey = `${req.path}:${req.ip}`;
  const currentTime = Date.now();

  if (rateLimitCache.has(rateLimitKey) && rateLimitCache.get(rateLimitKey) > currentTime) {
    return res.status(429).send('Too Many Requests');
  }

  rateLimitCache.set(rateLimitKey, currentTime + limitInfo * 1000);
  next();
});

// Load routes.
fs.readdirSync('./routes').filter(file => file.endsWith('.js')).forEach(file => {
  require(`./routes/${file}`).load(app, db);
});

module.exports.get = function(req) {
  const settings = require('./handlers/readSettings').settings(); 
  let themeName = encodeURIComponent(req.cookies.theme);
  let name = (themeName && fs.existsSync(`./themes/${themeName}`)) ? themeName : settings.theme;
  return {
    settings: (fs.existsSync(`./themes/${name}/pages.json`) ? require(`./themes/${name}/pages.json`) : themesettings),
    name
  };
};

module.exports.islimited = async (path, ip) => {
  const rateLimitPath = settings.ratelimits[path];
  if (!rateLimitPath) return false;

  const rateLimitKey = `${path}:${ip}`;
  return rateLimitCache.has(rateLimitKey) && rateLimitCache.get(rateLimitKey) > Date.now();
};

module.exports.ratelimits = (path, ip, length) => {
  const rateLimitKey = `${path}:${ip}`;
  const currentTime = Date.now();

  if (rateLimitCache[rateLimitKey] && rateLimitCache[rateLimitKey] > currentTime) {
    setTimeout(() => module.exports.ratelimits(path, ip, length), 1000);
    return;
  }

  rateLimitCache.set(rateLimitKey, currentTime + length * 1000);
};