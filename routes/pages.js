const indexjs = require("../index");
const ejs = require("ejs");
const express = require("express");
const getPteroUser = require('../handlers/getPteroUser');
const { renderDataEval } = require('../handlers/dataRenderer');

module.exports.load = async function(app, db) {
  app.use('/assets', express.static('./assets'));
  app.all("/", async (req, res) => {
    if (req.session.pterodactyl && req.session.pterodactyl.id !== await db.get(`users-${req.session.userinfo.id}`)) return res.redirect("/login?prompt=none");
    
    let theme = indexjs.get(req);
    if (theme.settings.mustbeloggedin.includes(req._parsedUrl.pathname) && (!req.session.userinfo || !req.session || !req.session.pterodactyl)) return res.redirect("/login");
  
    if (req._parsedUrl.pathname === "/admin") {
        const renderPage = async (error, str) => {
            delete req.session.newaccount;
            if (!req.session.userinfo || !req.session.pterodactyl || error) {
                console.error(`[WEBSITE] An error has occurred on path ${req._parsedUrl.pathname}:`);
                console.error(error);
                return res.render("404.ejs", { error });
            }

            const cacheAccount = await getPteroUser(req.session.userinfo.id, db);
            if (!cacheAccount) return;

            req.session.pterodactyl = cacheAccount.attributes;
            if (!cacheAccount.attributes.root_admin) return res.send(str);
            
            ejs.renderFile(
                `./themes/${theme.name}/index.ejs`, 
                await renderDataEval(req),
                null,
                (error, str) => {
                    if (error) {
                        console.error(`[WEBSITE] An error has occurred on path ${req._parsedUrl.pathname}:`);
                        console.error(error);
                        return res.render("404.ejs", { error });
                    }
                    delete req.session.newaccount;
                    res.send(str);
                }
            );
        };
        ejs.renderFile(
            `./themes/${theme.name}/404.ejs`, 
            await renderDataEval(req),
            null,
            renderPage
        );
        return;
    }
    ejs.renderFile(
        `./themes/${theme.name}/index.ejs`, 
        await renderDataEval(req),
        null,
        (error, str) => {
            if (error) {
                console.error(`[WEBSITE] An error has occurred on path ${req._parsedUrl.pathname}:`);
                console.error(error);
                return res.render("404.ejs", { error });
            }
            delete req.session.newaccount;
            res.send(str);
        }
    );
  });
};