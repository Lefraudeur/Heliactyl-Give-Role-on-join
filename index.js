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

global.Buffer = global.Buffer || require('buffer').Buffer;

if (!global.btoa) {
  global.btoa = function (str) {
    return Buffer.from(str, 'binary').toString('base64');
  };
}
if (!global.atob) {
  global.atob = function (b64Encoded) {
    return Buffer.from(b64Encoded, 'base64').toString('binary');
  };
}

// Load settings.

const settings = require('./handlers/readSettings').settings(); 

if (settings.pterodactyl && settings.pterodactyl.domain && settings.pterodactyl.domain.endsWith("/")) {
  settings.pterodactyl.domain = settings.pterodactyl.domain.slice(0, -1);
}

const themesettings = {
  index: "index.ejs",
  notfound: "index.ejs",
  redirect: {},
  pages: {},
  mustbeloggedin: [],
  mustbeadmin: []
};

module.exports.renderdataeval = async function(req) {
  const newsettings = require('./handlers/readSettings').settings(); 
  let theme = indexjs.get(req);
  return {
    req,
    settings: newsettings,
    userinfo: req.session.userinfo,
    packagename: req.session.userinfo ? await db.get(`package-${req.session.userinfo.id}`) || newsettings.packages.default : null,
    extraresources: !req.session.userinfo ? null : (await db.get(`extra-${req.session.userinfo.id}`) || { ram: 0, disk: 0, cpu: 0, servers: 0 }),
    packages: req.session.userinfo ? newsettings.packages.list[await db.get(`package-${req.session.userinfo.id}`) || newsettings.packages.default] : null,
    coins: newsettings.coins.enabled ? (req.session.userinfo ? await db.get(`coins-${req.session.userinfo.id}`) || 0 : null) : null,
    pterodactyl: req.session.pterodactyl,
    theme: theme.name,
    db
  };
};

// Load database

const db = require("./handlers/db.js");

module.exports.db = db;

// Load express addons.

const cookieParser = require("cookie-parser");
const express = require("express");
const session = require("express-session");
const app = express();
require('express-ws')(app);

const ejs = require("ejs");
const indexjs = require("./index.js");

const sqlite = require("better-sqlite3");
const SqliteStore = require("better-sqlite3-session-store")(session);
const session_db = new sqlite("sessions.db");

// Load the website.

module.exports.app = app;

if (settings.website.helmet) {
  const helmet = require('helmet');
  app.use(helmet());
}

app.use(cookieParser());
app.use(session({
  secret: settings.website.secret,
  resave: true,
  saveUninitialized: true,
  store: new SqliteStore({
    client: session_db, 
    expired: {
      clear: true,
      intervalMs: 900000
    }
  })
}));

app.use(express.json({
  inflate: true,
  limit: '500kb',
  reviver: null,
  strict: true,
  type: 'application/json',
  verify: undefined
}));

// Load the console

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

const manager = require('./handlers/readSettings').settings(); 
var cache = false

app.use(function(req, res, next) {
  const rateLimitPath = manager.ratelimits[req._parsedUrl.pathname];

  if (rateLimitPath) {
    if (cache) {
      setTimeout(async () => {
        let allqueries = Object.entries(req.query);
        let querystring = "";

        for (let query of allqueries) {
          querystring = `${querystring}&${query[0]}=${query[1]}`;
        }
        querystring = `?${querystring.slice(1)}`;
        res.redirect((req._parsedUrl.pathname.slice(0, 1) == "/" ? req._parsedUrl.pathname : "/" + req._parsedUrl.pathname) + querystring);
      }, 1000);
      return;
    } else {
      cache = true;

      setTimeout(async () => {
        cache = false;
      }, 1000 * rateLimitPath);
    }
  }
  next();
});

// Load the routes.

let routeFiles = fs.readdirSync('./routes').filter(file => file.endsWith('.js'));

routeFiles.forEach(file => {
  let routeFile = require(`./routes/${file}`);
	routeFile.load(app, db);
});

 // Load route

app.all("*", async (req, res) => {
  if (req.session.pterodactyl && req.session.pterodactyl.id !== await db.get(`users-${req.session.userinfo.id}`)) 
    return res.redirect("/login?prompt=none");

  let theme = indexjs.get(req);
  
  if (theme.settings.mustbeloggedin.includes(req._parsedUrl.pathname) && (!req.session.userinfo || !req.session.pterodactyl)) 
    return res.redirect("/login" + (req._parsedUrl.pathname.slice(0, 1) == "/" ? "?redirect=" + req._parsedUrl.pathname.slice(1) : ""));

  if (theme.settings.mustbeadmin.includes(req._parsedUrl.pathname)) {
    ejs.renderFile(
      `./themes/${theme.name}/${theme.settings.notfound}`, 
      await indexjs.renderdataeval(req),
      null,
    async function (err, str) {
      delete req.session.newaccount;
      delete req.session.password;
      if (!req.session.userinfo || !req.session.pterodactyl || err) {
        if (err) {
          console.log(chalk.red(`[Heliactyl] An error occurred on path ${req._parsedUrl.pathname}:`));
          console.log(err);
          return res.render("404.ejs", { err });
        };
        res.status(200);
        return res.send(str);
      };

      let cacheAccount = await fetch(
        `${settings.pterodactyl.domain}/api/application/users/${(await db.get(`users-${req.session.userinfo.id}`))}?include=servers`,
        {
          method: "GET",
          headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
        }
      );

      if (await cacheAccount.statusText == "Not Found") {
        if (err) {
          console.log(chalk.red(`[Heliactyl] An error occurred on path ${req._parsedUrl.pathname}:`));
          console.log(err);
          return res.render("404.ejs", { err });
        };
        return res.send(str);
      };
      
      let cacheAccountInfo = JSON.parse(await cacheAccount.text());
    
      req.session.pterodactyl = cacheAccountInfo.attributes;
      if (cacheAccountInfo.attributes.root_admin !== true) {
        if (err) {
          console.log(chalk.red(`[Heliactyl] An error occurred on path ${req._parsedUrl.pathname}:`));
          console.log(err);
          return res.render("404.ejs", { err });
        };
        return res.send(str);
      };

      ejs.renderFile(
        `./themes/${theme.name}/${theme.settings.pages[req._parsedUrl.pathname.slice(1)] ? theme.settings.pages[req._parsedUrl.pathname.slice(1)] : theme.settings.notfound}`, 
        await indexjs.renderdataeval(req),
        null,
      function (err, str) {
        delete req.session.newaccount;
        delete req.session.password;
        if (err) {
          console.log(`[Heliactyl] An error occurred on path ${req._parsedUrl.pathname}:`);
          console.log(err);
          return res.render("404.ejs", { err });
        };
        res.status(200);
        res.send(str);
      });
    });
    return;
  };

  const data = await indexjs.renderdataeval(req);
  
  ejs.renderFile(
    `./themes/${theme.name}/${theme.settings.pages[req._parsedUrl.pathname.slice(1)] ? theme.settings.pages[req._parsedUrl.pathname.slice(1)] : theme.settings.notfound}`, 
    data,
    null,
  function (err, str) {
    delete req.session.newaccount;
    delete req.session.password;
    if (err) {
      console.log(chalk.red(`[Heliactyl] An error occurred on path ${req._parsedUrl.pathname}:`));
      console.log(err);
      return res.render("404.ejs", { err });
    };
    res.status(200);
    res.send(str);
  });
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

module.exports.islimited = async function() {
  return cache ? false : true;
}

module.exports.ratelimits = async function(length) {
  if (cache) 
  return setTimeout(
    indexjs.ratelimits, 1
  );
  
  cache = true;
  setTimeout(
    async function() {
      cache = false;
    }, length * 1000
  )
}
