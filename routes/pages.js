const indexjs = require("../index");
const ejs = require("ejs");
const express = require("express");
const getPteroUser = require('../handlers/getPteroUser');
const { renderDataEval } = require('../handlers/dataRenderer');

module.exports.load = function(app, db) {
  app.use('/assets', express.static('./assets'));

  app.all("/", async (req, res) => {
    const theme = indexjs.get(req);

    if (theme.settings.mustbeloggedin.includes(req._parsedUrl.pathname) && (!req.session || !req.session.pterodactyl || !req.session.userinfo)) {
      return res.redirect("/login");
    }

    if (req._parsedUrl.pathname === "/admin") {
      renderAdminPage(req, res, theme, db);
      return;
    }

    renderPage(`./themes/${theme.name}/index.ejs`, await renderDataEval(req), req, res);
  });
};

function renderAdminPage(req, res, theme, db) {
  ejs.renderFile(`./themes/${theme.name}/404.ejs`, renderDataEval(req), null, async (error, str) => {
    delete req.session.newaccount;
    if (!req.session || !req.session.pterodactyl || !req.session.userinfo || error) {
      console.error(`[WEBSITE] An error occurred on path ${req._parsedUrl.pathname}:`, error);
      return res.render("404.ejs", { error });
    }

    const cacheAccount = await getPteroUser(req.session.userinfo.id, db);
    if (!cacheAccount) return res.send(str);

    req.session.pterodactyl = cacheAccount.attributes;
    if (!cacheAccount.attributes.root_admin) return res.send(str);

    renderPage(`./themes/${theme.name}/index.ejs`, await renderDataEval(req), req, res);
  });
}

function renderPage(filePath, data, req, res) {
  ejs.renderFile(filePath, data, null, (error, str) => {
    if (error) {
      console.error(`[WEBSITE] An error occurred on path ${req._parsedUrl.pathname}:`, error);
      return res.render("404.ejs", { error });
    }
    delete req.session.newaccount;
    res.send(str);
  });
}