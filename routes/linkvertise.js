const settings = require('../handlers/readSettings').settings(); 

module.exports.load = async function (app, db) {
    const lvcodes = {};
    const cooldowns = {};

    app.get(`/lv/gen`, async (req, res) => {
        // add try/catch for dev, when is released i think i will remove
        try {
            if (!req.session.pterodactyl) return res.redirect("/login");

            const userId = req.session.userinfo.id;

            if (cooldowns[userId] > Date.now()) {
                return res.redirect(`/lv`);
            } else if (cooldowns[userId]) {
                delete cooldowns[userId];
            }

            const dailyTotal = await db.get(`dailylinkvertise-${userId}`);
            if (dailyTotal && dailyTotal >= settings.linkvertise.dailyLimit)
                return res.redirect(`/lv?err=REACHEDDAILYLIMIT`);

            let referer = req.headers.referer
            if (!referer) return res.send('An error occured with your browser!')
            referer = referer.toLowerCase()
            if (referer.includes('?')) referer = referer.split('?')[0]
            if (!referer.endsWith(`/lv`) && !referer.endsWith(`/lv/`)) 
                return res.send('An error occured with your browser!')
            if (!referer.endsWith(`/`)) referer += `/`

            const code = makeid(12);
            const lvurl = linkvertise(settings.linkvertise.userid, referer + `redeem/${code}`);

            lvcodes[userId] = {
                code: code,
                user: userId,
                generated: Date.now()
            };
            //  res.redirect(`/lv/redeem/${code}`); Dev comment
            res.redirect(lvurl);
        } catch (error) {
            console.error("Error generating link:", error);
            res.status(500).send("Internal Server Error");
        }
    });

    app.get(`/lv/redeem/:code`, async (req, res) => {
        try {
            if (!req.session.pterodactyl) return res.redirect("/");
            const userId = req.session.userinfo.id;

            if (cooldowns[userId] > Date.now()) {
                return res.redirect(`/lv`);
            } else if (cooldowns[userId]) {
                delete cooldowns[userId];
            }

            const code = req.params.code;
            if (!code || !req.headers.referer || !req.headers.referer.includes('linkvertise.com')) 
                return res.send('<p>Hm... our systems detected something going on! Please make sure you are not using an ad blocker (or linkvertise bypasser).</p> <img src="https://i.imgur.com/lwbn3E9.png" alt="robot" height="300">');

            const usercode = lvcodes[userId];
            if (!usercode || usercode.code !== code) return res.redirect(`/lv`);
            delete lvcodes[userId];

            const timePassed = (Date.now() - usercode.generated) / 1000;
            if (timePassed < settings.linkvertise.minTimeToComplete) 
                return res.send('<p>Hm... our systems detected something going on! Please make sure you are not using an ad blocker (or linkvertise bypasser). <a href="/lv">Generate another link</a></p> <img src="https://i.imgur.com/lwbn3E9.png" alt="robot" height="300">');
            
            cooldowns[userId] = Date.now() + (settings.linkvertise.cooldown * 1000);

            const dailyTotal = await db.get(`dailylinkvertise-${userId}`);
            if (dailyTotal && dailyTotal >= settings.linkvertise.dailyLimit) 
                return res.redirect(`/lv?err=REACHEDDAILYLIMIT`);
            
            await db.set(`dailylinkvertise-${userId}`, 1)
            if (dailyTotal + 1 >= settings.linkvertise.dailyLimit) 
                await db.set(`lvlimitdate-${userId}`, Date.now(), 43200000);

            // Adding coins
            const coins = await db.get(`coins-${req.session.userinfo.id}`)
            await db.set(`coins-${req.session.userinfo.id}`, coins + settings.linkvertise.coins)

            res.redirect(`/lv?success=true`);
        } catch (error) {
            console.error("Error redeeming code:", error);
            res.status(500).send("Internal Server Error");
        }
    });

    app.get(`/api/lvcooldown`, async (req, res) => {
        try {
            if (!req.session.pterodactyl) return res.json({ error: true, message: 'Not logged in' });
            const userId = req.session.userinfo.id;

            const limitTimestamp = await db.get(`lvlimitdate-${userId}`);
            if (limitTimestamp && limitTimestamp + 43200000 < Date.now()) {
                await Promise.all([
                    db.delete(`dailylinkvertise-${userId}`),
                    db.delete(`lvlimitdate-${userId}`)
                ]);
            } else if (cooldowns[userId] && cooldowns[userId] < Date.now()) {
                delete cooldowns[userId];
            }

            return res.json({
                dailyLimit: limitTimestamp ? true : false,
                readable: limitTimestamp ? msToHoursAndMinutes(limitTimestamp + 43200000 - Date.now()) : null,
                cooldown: cooldowns[userId] || null
            });
        } catch (error) {
            console.error("Error checking cooldown:", error);
            res.status(500).json({ error: true, message: "Internal Server Error" });
        }
    });

    // Removing expired codes and cooldowns
    setInterval(() => {
        // idk if is working x)
        for (const [userId, code] of Object.entries(lvcodes)) {
            if ((Date.now() - code.generated) / 1000 > settings.linkvertise.timeToExpire) {
                delete lvcodes[userId];
            }
        }

        for (const [userId, cooldown] of Object.entries(cooldowns)) {
            if (cooldown < Date.now()) {
                delete cooldowns[userId];
            }
        }
    }, 10000);
};

function linkvertise(userid, link) {
    const base_url = `https://link-to.net/${userid}/${Math.random() * 1000}/dynamic`;
    const href = base_url + "?r=" + Buffer.from(encodeURI(link)).toString('base64');
    return href;
}

function makeid(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let result = Array.from({ length }, () => characters.charAt(Math.floor(Math.random() * charactersLength))).join('');
    return result;
}

function msToHoursAndMinutes(ms) {
    const msInHour = 3600000;
    const msInMinute = 60000;

    const hours = Math.floor(ms / msInHour);
    const minutes = Math.round((ms - (hours * msInHour)) / msInMinute * 100) / 100;

    let pluralHours = hours === 1 ? '' : 's';
    let pluralMinutes = minutes === 1 ? '' : 's';

    return `${hours} hour${pluralHours} and ${minutes} minute${pluralMinutes}`;
}
