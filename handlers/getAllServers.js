const settings = require('../handlers/readSettings').settings(); 

const fetch = require('node-fetch');

if (settings.pterodactyl && settings.pterodactyl.domain && settings.pterodactyl.domain.endsWith("/")) {
    settings.pterodactyl.domain = settings.pterodactyl.domain.slice(0, -1);
}

module.exports = () => {
    return new Promise(async (resolve) => {

        const allServers = []

        async function getServersOnPage(page) {
            return (await fetch(
                settings.pterodactyl.domain + "/api/application/servers/?page=" + page,
                {
                    headers: {
                        "Authorization": `Bearer ${settings.pterodactyl.key}`
                    }
                }
            )).json();
        };

        let currentPage = 1
        while (true) {
            const page = await getServersOnPage(currentPage)
            allServers.push(...page.data)
            if (page.meta.pagination.total_pages > currentPage) {
                currentPage++
            } else {
                break
            }
        }

        resolve(allServers)

    })
}
