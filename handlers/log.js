const settings = require('../handlers/readSettings').settings(); 
const fetch = require('node-fetch');

/**
 * Converts a hex color code to its decimal equivalent.
 * @param {string} hex - The hex color code.
 * @returns {number} - The decimal equivalent of the hex color code.
 */
function hexToDecimal(hex) {
    return parseInt(hex.replace("#", ""), 16);
}

/**
 * Logs an action to Discord via a webhook.
 * @param {string} action - The action being logged.
 * @param {string} message - The message to log.
 */
async function logToDiscord(action, message) {
    if (!settings.logging.status) return;
    if (!settings.logging.actions.user[action] && !settings.logging.actions.admin[action]) return;

    try {
        await fetch(settings.logging.webhook, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                embeds: [
                    {
                        color: hexToDecimal('#191c24'),
                        title: `Event: \`${action}\``,
                        description: message,
                        author: {
                            name: 'Logging'
                        },
                        thumbnail: {
                            _comment: "Replace the url for the webhook image",
                            url: 'https://cdn.discordapp.com/attachments/881207010417315861/949595064554913812/Copy_of_H_35.png?ex=661a4c52&is=6607d752&hm=8a9503adcddb8537ce1875cef66fd3e8364e466cfa5fbeabe363b6db08722138&'
                        },
                        footer: {
                            text: 'Powered by fixed-heliactyl',
                            _comment: "Replace the url for the webhook image footer",
                            icon_url: 'https://avatars.githubusercontent.com/u/122883790?s=48&v=4'
                        },
                        timestamp: new Date()
                    }
                ]
            })
        });
    } catch (error) {
        console.error('Error logging to Discord:', error);
    }
}

module.exports = logToDiscord;