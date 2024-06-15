const settings = require('../handlers/readSettings').settings(); 

module.exports.load = async function (app, db) {

    const lvcodes = {};
    const cooldowns = {};

    app.get(`/lv/gen`, async (req, res) => {
        if (!req.session.pterodactyl || !req.session) return res.redirect("/login");

        let userId = req.session.userinfo.id;

        if (cooldowns[userId] > Date.now()) {
            return res.redirect(`/lv`);
        } else if (cooldowns[userId]) {
            delete cooldowns[userId];
        }

        const dailyTotal = await db.get(`dailylinkvertise-${userId}`);
        if (dailyTotal && dailyTotal >= settings.linkvertise.dailyLimit) 
            return res.redirect(`/lv?err=REACHEDDAILYLIMIT`);
        
        let referer = req.headers.referer;
        if (!referer) return res.send('An error occurred with your browser!');
        referer = referer.toLowerCase();
        if (referer.includes('?')) referer = referer.split('?')[0]
        if (!referer.endsWith(`/lv`) && !referer.endsWith(`/lv/`)) return res.send('An error occurred with your browser!');
        if (!referer.endsWith(`/`)) referer += `/`;

        const code = makeid(12);
        const lvurl = linkvertise(settings.linkvertise.userid, referer + `redeem/${code}`);

        lvcodes[userId] = {
            code: code,
            user: userId,
            generated: Date.now()
        };

        res.redirect(lvurl);
    });

    app.get(`/lv/redeem/:code`, async (req, res) => {
        if (!req.session.pterodactyl) return res.redirect("/");

        let userId = req.session.userinfo.id;

        if (cooldowns[userId] > Date.now()) {
            return res.redirect(`/lv`);
        } else if (cooldowns[userId]) {
            delete cooldowns[userId];
        }

        // We get the code from the paramters, eg (client.domain.com/lv/redeem/abc123) here "abc123" is the code
        const code = req.params.code
        if (!code) return res.send('An error occurred with your browser!');
        if (!req.headers.referer || !req.headers.referer.includes('linkvertise.com')) 
            return res.send('<p>Hm... our systems detected something going on! Please make sure you are not using an ad blocker (or linkvertise bypasser).</p> <img src="https://i.imgur.com/lwbn3E9.png" alt="robot" height="300">');

        const usercode = lvcodes[userId];
        if (!usercode || usercode.code !== code) return res.redirect(`/lv`);
        delete lvcodes[userId];

        // Checking at least the minimum allowed time passed between generation and completion
        if (((Date.now() - usercode.generated) / 1000) < settings.linkvertise.minTimeToComplete) 
            return res.send('<p>Hm... our systems detected something going on! Please make sure you are not using an ad blocker (or linkvertise bypasser). <a href="/lv">Generate another link</a></p> <img src="https://i.imgur.com/lwbn3E9.png" alt="robot" height="300">');

        cooldowns[userId] = Date.now() + (settings.linkvertise.cooldown * 1000);

        // Adding to daily total
        const dailyTotal = await db.get(`dailylinkvertise-${userId}`);
        if (dailyTotal && dailyTotal >= settings.linkvertise.dailyLimit) 
            return res.redirect(`/lv?err=REACHEDDAILYLIMIT`);
        
        if (dailyTotal) await db.set(`dailylinkvertise-${userId}`, dailyTotal + 1)
        else await db.set(`dailylinkvertise-${userId}`, 1);
        if (dailyTotal + 1 >= settings.linkvertise.dailyLimit) 
            await db.set(`lvlimitdate-${userId}`, Date.now(), 43200000);

        // Adding coins
        const coins = await db.get(`coins-${userId}`);
        await db.set(`coins-${userId}`, coins + settings.linkvertise.coins);

        res.redirect(`/lv?success=true`);
    });
    
    app.get(`/api/lvcooldown`, async (req, res) => {
        if (!req.session.pterodactyl) return res.json({ error: true, message: 'Not logged in' });

        let userId = req.session.userinfo.id;

        const limitTimestamp = await db.get(`lvlimitdate-${userId}`);
        if (!limitTimestamp) return res.json({ dailyLimit: true, readable: msToHoursAndMinutes((limitTimestamp + 43200000) - Date.now()) })
        if ((limitTimestamp + 43200000) < Date.now()) {
            await db.delete(`dailylinkvertise-${userId}`);
            await db.delete(`lvlimitdate-${userId}`);
        }

        if (cooldowns[userId] && cooldowns[userId] < Date.now()) 
            delete cooldowns[userId];

        return res.json({ cooldown: cooldowns[userId] ?? null });
    })

    // Removing codes that have expired and cooldowns that are no longer applicable
    setInterval(() => {
        for (const code of Object.values(lvcodes)) {
            if (((Date.now() - code.generated) / 1000) > settings.linkvertise.timeToExpire) {
                delete lvcodes[code.user];
            }
        }

        for (const user of Object.keys(cooldowns)) {
            const cooldown = cooldowns[user];
            if (cooldown < Date.now()) 
                delete cooldowns[user];
        }
    }, 10000);
};

function linkvertise(userid, link) {
    let base_url = `https://link-to.net/${userid}/${Math.random() * 1000}/dynamic`;
    let href = base_url + "?r=" + Buffer.from(encodeURI(link)).toString('base64');
    return href;
}

function makeid(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let result = Array.from({ length }, () => characters.charAt(Math.floor(Math.random() * charactersLength))).join('');
    return result;
}

function msToHoursAndMinutes(ms) {
    if (isNaN(ms) || ms < 0) return "Unknown time";
    const msInHour = 3600000;
    const msInMinute = 60000;

    const hours = Math.floor(ms / msInHour);
    const minutes = Math.round((ms - (hours * msInHour)) / msInMinute * 100) / 100;

    let pluralHours = hours === 1 ? '' : 's';
    let pluralMinutes = minutes === 1 ? '' : 's';

    return `${hours} hour${pluralHours} and ${minutes} minute${pluralMinutes}`;
}