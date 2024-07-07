"use strict";
 
const fs = require("fs");
const yaml = require('js-yaml');

module.exports = {
   settings: () => {
      let settings = yaml.load(fs.readFileSync('./settings.yml', 'utf8'));
      if (settings.pterodactyl.domain.endsWith("/")) settings.pterodactyl.domain.slice(0, -1);
      if (settings.oauth2.link.endsWith("/")) settings.oauth2.link.slice(0, -1); 
      if (settings.oauth2.callbackpath.slice(0, 1) !== "/") settings.oauth2.callbackpath = `/${settings.oauth2.callbackpath}`;
      return settings;
   }
}