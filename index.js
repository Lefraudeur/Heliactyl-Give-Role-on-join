//
//  * Fixed-Heliactyl
// 
//  * Heliactyl 12.8 (Based off of 12.7), Codename Gekyume
//  * Copyright SRYDEN, Inc. & Overnode
//
"use strict";

// Load packages.
const fs = require("fs");
const fetch = require("node-fetch");
const chalk = require("chalk");
const ejs = require("ejs");
const cookieParser = require("cookie-parser");
const express = require("express");
const session = require("express-session");

// Global Buffer
const globalBuffer = global.Buffer || require('buffer').Buffer;

if (!global.btoa) 
  global.btoa = (str) => globalBuffer.from(str, 'binary').toString('base64');


if (!global.atob) 
  global.atob = (b64Encoded) => globalBuffer.from(b64Encoded, 'base64').toString('binary');


// Load settings
const settings = require('./handlers/readSettings').settings(); 
const db = require("./handlers/db.js");
const indexjs = require("./index.js");
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

const rateLimitCache = new Map();

module.exports.renderdataeval = async function(req) {
  const newsettings = require('./handlers/readSettings').settings(); 
  let theme = indexjs.get(req);
  const userinfo = req.session.userinfo;

  return {
    req,
    settings: newsettings,
    userinfo: userinfo,
    packagename: userinfo ? await db.get(`package-${userinfo.id}`) || newsettings.packages.default : null,
    extraresources: userinfo ? (await db.get(`extra-${userinfo.id}`) || { ram: 0, disk: 0, cpu: 0, servers: 0 }) : null,
    packages: userinfo ? newsettings.packages.list[await db.get(`package-${userinfo.id}`) || newsettings.packages.default] : null,
    coins: newsettings.coins.enabled ? (userinfo ? await db.get(`coins-${userinfo.id}`) || 0 : null) : null,
    pterodactyl: req.session.pterodactyl,
    theme: theme.name,
    db
  };
};

module.exports.db = db;
module.exports.app = app;

const listener = app.listen(settings.website.port, async () => {
  console.clear();
  console.log(`${chalk.gray("  ")}${chalk.bgBlue("  APPLICATION IS ONLINE  ")}\n${chalk.gray("  ")}`);
  console.log(`${chalk.gray("  ")}${chalk.cyan("[Heliactyl]")}${chalk.white(" Checking for updates...")}`);

  try {
    const newsettings = require('./handlers/readSettings').settings(); 
    const response = await fetch(`https://api.github.com/repos/OvernodeProjets/Fixed-Heliactyl/releases/latest`);
    const { tag_name: latestVersion } = await response.json();

    if (latestVersion !== newsettings.version) {
      console.log(`${chalk.gray("  ")}${chalk.cyan("[Heliactyl]")}${chalk.yellow(" New version available!")}`);
      console.log(`${chalk.gray("  ")}${chalk.cyan("[Heliactyl]")}${chalk.white(` Current Version: ${newsettings.version}, Latest Version: ${latestVersion}`)}`);
    } else {
      console.log(`${chalk.gray("  ")}${chalk.cyan("[Heliactyl]")}${chalk.white(" Your application is up-to-date.")}`);
    }
  } catch (error) {
    console.error(`${chalk.gray("  ")}${chalk.cyan("[Heliactyl]")}${chalk.red(" Error checking for updates:")} ${error.message}`);
  }

  console.log(`${chalk.gray("  ")}${chalk.cyan("[Heliactyl]")}${chalk.white(" You can now access the dashboard at ")}${chalk.underline(`${settings.oauth2.link}/`)}`);
});

// Handle rate limiting.
app.use((req, res, next) => {
  if (!settings.ratelimits[req._parsedUrl.pathname]) return next()
  const rateLimitPath = settings.ratelimits[req._parsedUrl.pathname]

  const currentTime = Date.now();
  const rateLimitKey = `${req._parsedUrl.pathname}:${req.ip}`;

  if (rateLimitCache.has(rateLimitKey) && rateLimitCache.get(rateLimitKey) > currentTime) return res.status(429).send('Too Many Requests');
  
  rateLimitCache.set(rateLimitKey, currentTime + rateLimitPath * 1000);
  next();
});

// Load routes.
fs.readdirSync('./routes').filter(file => file.endsWith('.js')).forEach(file => {
  let routeFile = require(`./routes/${file}`);
  routeFile.load(app, db);
});

// Handle all other requests.
app.all("*", async (req, res) => {
  if (req.session.pterodactyl && req.session.pterodactyl.id !== await db.get(`users-${req.session.userinfo.id}`))
    return res.redirect("/login?prompt=none");

  let theme = indexjs.get(req);

  if (theme.settings.mustbeloggedin.includes(req._parsedUrl.pathname) && (!req.session || !req.session.userinfo || !req.session.pterodactyl)) 
    return res.redirect("/login" + (req._parsedUrl.pathname.slice(0, 1) === "/" ? "?redirect=" + req._parsedUrl.pathname.slice(1) : ""));

  const filePath = `./themes/${theme.name}/${theme.settings.pages[req._parsedUrl.pathname.slice(1)] || "404.ejs"}`;
  const data = await indexjs.renderdataeval(req);

  if (req._parsedUrl.pathname === "/admin") {
    ejs.renderFile(`./themes/${theme.name}/404.ejs`, data, null,
      async (error, str) => {
        delete req.session.newaccount;
        delete req.session.password;
        if (!req.session.userinfo || !req.session.pterodactyl || error) {
          if (error) {
            console.error(chalk.red(`[Heliactyl] An error occurred on path ${req._parsedUrl.pathname}:`))
            console.error(error)
            return res.render("404.ejs", { error })
          }
          res.status(200).send(str);
        } else {
          let cacheAccount = await fetch(`${settings.pterodactyl.domain}/api/application/users/${await db.get(`users-${req.session.userinfo.id}`)}?include=servers`, {
            method: "GET",
            headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
          });

          if (await cacheAccount.statusText === "Not Found") {
            if (error) {
              console.error(chalk.red(`[Heliactyl] An error occurred on path ${req._parsedUrl.pathname}:`))
              console.error(error)
              return res.render("404.ejs", { error })
            }
            return res.send(str);
          }

          let cacheAccountInfo = JSON.parse(await cacheAccount.text());
          req.session.pterodactyl = cacheAccountInfo.attributes;

          if (!cacheAccountInfo.attributes.root_admin) {
            if (error) {
              console.error(chalk.red(`[Heliactyl] An error occurred on path ${req._parsedUrl.pathname}:`))
              console.error(error)
              return res.render("404.ejs", { error })
            }
            return res.send(str);
          }

          ejs.renderFile(filePath, data, null,
            (error, str) => {
              delete req.session.newaccount;
              delete req.session.password;
              if (error) {
                console.error(chalk.red(`[Heliactyl] An error occurred on path ${req._parsedUrl.pathname}:`))
                console.error(error)
                return res.render("404.ejs", { error })
              }
              res.status(200).send(str);
            }
          );
        }
      }
    );
    return;
  }

  ejs.renderFile(filePath, data, null, 
    (error, str) => {
      delete req.session.newaccount;
      delete req.session.password;
      if (error) {
        console.error(chalk.red(`[Heliactyl] An error occurred on path ${req._parsedUrl.pathname}:`))
        console.error(error)
        return res.render("404.ejs", { error })
      }
      res.status(200).send(str);
    }
  );
});

module.exports.get = function(req) {
  const settings = require('./handlers/readSettings').settings(); 
  let themeName = encodeURIComponent(req.cookies.theme);
  let name = (
    themeName ?
      fs.existsSync(`./themes/${themeName}`) ?
        themeName
      : settings.theme
    : settings.theme
  )
  return {
    settings: (
      fs.existsSync(`./themes/${name}/pages.json`) ?
        JSON.parse(fs.readFileSync(`./themes/${name}/pages.json`).toString())
      : themesettings
    ),
    name: name
  };
};

module.exports.islimited = async (path, ip) => {
  const rateLimitPath = settings.ratelimits[path];
  if (!rateLimitPath) return false;

  const currentTime = Date.now();
  const rateLimitKey = `${path}:${ip}`;

  return rateLimitCache.has(rateLimitKey) && rateLimitCache.get(rateLimitKey) > currentTime;
};

module.exports.ratelimits = async (path, ip, length) => {
  const rateLimitKey = `${path}:${ip}`;
  const currentTime = Date.now();

  if (rateLimitCache[rateLimitKey] && rateLimitCache[rateLimitKey] > currentTime) {
    setTimeout(() => module.exports.ratelimits(path, ip, length), 1000);
    return;
  }

  rateLimitCache[rateLimitKey] = currentTime + length * 1000;
};