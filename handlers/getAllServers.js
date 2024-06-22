const settings = require('../handlers/readSettings').settings();
const fetch = require("node-fetch");

module.exports = async () => {
  try {
    const allServers = [];

    async function getServersOnPage(page) {
      try {
        const response = await fetch(
          `${settings.pterodactyl.domain}/api/application/servers/?page=${page}`,
          {
            headers: {
              "Authorization": `Bearer ${settings.pterodactyl.key}`
            }
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch servers on page ${page}`);
        }

        return response.json();
      } catch (error) {
        console.error(`Error fetching servers on page ${page}:`, error);
        throw error;
      }
    }

    let currentPage = 1;
    while (true) {
      try {
        const page = await getServersOnPage(currentPage);
        allServers.push(...page.data);

        if (page.meta.pagination.total_pages <= currentPage) {
          break;
        }

        currentPage++;
      } catch (error) {
        console.error(`Error fetching servers:`, error);
        return [];
      }
    }

    return allServers;
  } catch (error) {
    console.error(`Error fetching all servers:`, error);
    return [];
  }
};