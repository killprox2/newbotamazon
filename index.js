const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

client.login(process.env.TOKEN);

const roles = {
    owner: 'OwnerRoleID',
    modo: 'ModoRoleID',
    preniumPlus: 'PreniumPlusRoleID',
    prenium: 'PreniumRoleID',
    visiteur: 'VisiteurRoleID',
};

const channels = {
    amazon: '1255863140974071893',
    cdiscount: '1285939619598172232',
    auchan: '1285969661535453215',
    manomano: '1285953900066902057',
    electromenager: 'ElectromenagerChannelID',
    livre: 'LivreChannelID',
    enfant: 'EnfantChannelID',
    jouet: 'JouetChannelID',
    entretien: 'EntretienChannelID',
    electronique: 'ElectroniqueChannelID',
    logs: '1285977835365994506',
};

// Fonction pour envoyer des messages dans le canal de logs
async function sendLogMessage(content) {
    try {
        const logChannel = await client.channels.fetch(channels.logs);
        if (logChannel) {
            await logChannel.send(content);
        } else {
            console.log('Canal de logs introuvable.');
        }
    } catch (error) {
        console.log('Erreur d\'envoi du message de log :', error);
    }
}

// Lancement du bot et démarrage des recherches
client.once('ready', async () => {
    console.log('Le bot est en ligne !');
    await sendLogMessage('✅ Bot démarré et prêt à l\'emploi.');
    await checkAmazonGeneralDeals();
    await checkAmazonAdvancedDeals();
    await checkCdiscountDeals();
    await checkAuchanDeals();
    await checkManomanoDeals();
});

// ===================== Recherche Amazon Général =====================

async function checkAmazonGeneralDeals() {
    const searchURLs = [
        'https://www.amazon.fr/deals',
        'https://www.amazon.fr/s?rh=n%3A20606778031&language=fr_FR',
        'https://www.amazon.fr/s?k=pas+cher',
        'https://www.amazon.fr/s?k=1+euro',
    ];

    try {
        await sendLogMessage('🔎 Recherche de deals Amazon général...');

        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-extensions',
                '--disable-infobars',
                '--disable-popup-blocking',
                '--disable-translate',
                '--remote-debugging-port=9222',
                '--disable-software-rasterizer',
            ],
            executablePath: process.env.CHROME_BIN || null, // Utilisation du Chrome installé via le buildpack
        });

        const page = await browser.newPage();

        let allDeals = [];

        for (let url of searchURLs) {
            await page.goto(url, { waitUntil: 'domcontentloaded' });

            let deals = await page.evaluate(() => {
                let dealElements = document.querySelectorAll('.s-result-item');

                let extractedDeals = [];
                dealElements.forEach(el => {
                    let title = el.querySelector('h2 .a-link-normal')?.innerText;
                    let currentPrice = el.querySelector('.a-price .a-offscreen')?.innerText;
                    let oldPrice = el.querySelector('.a-text-price .a-offscreen')?.innerText;

                    if (title && currentPrice && oldPrice) {
                        let currentPriceValue = parseFloat(currentPrice.replace(/[^\d,.-]/g, '').replace(',', '.'));
                        let oldPriceValue = parseFloat(oldPrice.replace(/[^\d,.-]/g, '').replace(',', '.'));

                        let discount = ((oldPriceValue - currentPriceValue) / oldPriceValue) * 100;

                        if (discount >= 50) {
                            extractedDeals.push({
                                title,
                                currentPrice: `${currentPriceValue}€`,
                                oldPrice: `${oldPriceValue}€`,
                                discount: discount.toFixed(2) + '%',
                                url: el.querySelector('a')?.href,
                            });
                        }
                    }
                });
                return extractedDeals;
            });

            allDeals = [...allDeals, ...deals];
        }

        if (allDeals.length > 0) {
            await sendLogMessage(`📦 ${allDeals.length} deals trouvés sur Amazon général.`);
        } else {
            await sendLogMessage('❌ Aucun deal trouvé sur Amazon général.');
        }

        for (let deal of allDeals) {
            const embed = new EmbedBuilder()
                .setTitle(deal.title)
                .setURL(deal.url)
                .addFields(
                    { name: 'Prix actuel', value: deal.currentPrice, inline: true },
                    { name: 'Prix avant', value: deal.oldPrice, inline: true },
                    { name: 'Réduction', value: deal.discount, inline: true },
                )
                .setFooter({ text: 'Amazon Deal' });

            client.channels.cache.get(channels.amazon).send({ embeds: [embed] });
            await sendLogMessage(`📌 Produit ajouté : ${deal.title} - ${deal.currentPrice}€ (réduction de ${deal.discount})`);
        }

        await page.close();
        await browser.close();
    } catch (error) {
        await sendLogMessage('⚠️ Erreur lors de la recherche des deals Amazon général.');
        console.error('Erreur lors de la recherche des deals Amazon général:', error);
    }
}

// ===================== Recherche Amazon Avancé =====================

async function checkAmazonAdvancedDeals() {
    const searchKeywords = ['entretien', 'electromenager', 'jouet', 'livre', 'enfant'];
    const baseURL = 'https://www.amazon.fr/s?k=';

    try {
        await sendLogMessage('🔎 Recherche de deals avancés Amazon...');

        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-extensions',
                '--disable-infobars',
                '--disable-popup-blocking',
                '--disable-translate',
                '--remote-debugging-port=9222',
                '--disable-software-rasterizer',
            ],
            executablePath: process.env.CHROME_BIN || null, // Utilisation du Chrome installé via le buildpack
        });

        const page = await browser.newPage();

        let allDeals = [];

        for (let keyword of searchKeywords) {
            let currentPage = 1;
            let hasNextPage = true;

            while (hasNextPage) {
                const searchURL = `${baseURL}${keyword}&page=${currentPage}`;
                await page.goto(searchURL, { waitUntil: 'domcontentloaded' });

                let deals = await page.evaluate(() => {
                    let dealElements = document.querySelectorAll('.s-result-item');
                    let extractedDeals = [];

                    dealElements.forEach(el => {
                        let title = el.querySelector('h2 .a-link-normal')?.innerText;
                        let currentPrice = el.querySelector('.a-price .a-offscreen')?.innerText;
                        let oldPrice = el.querySelector('.a-price.a-text-price .a-offscreen')?.innerText;

                        if (title && currentPrice && oldPrice) {
                            let currentPriceValue = parseFloat(currentPrice.replace(/[^\d,.-]/g, '').replace(',', '.'));
                            let oldPriceValue = parseFloat(oldPrice.replace(/[^\d,.-]/g, '').replace(',', '.'));

                            let discount = ((oldPriceValue - currentPriceValue) / oldPriceValue) * 100;

                            if (discount >= 50) {
                                extractedDeals.push({
                                    title,
                                    currentPrice: `${currentPriceValue}€`,
                                    oldPrice: `${oldPriceValue}€`,
                                    discount: discount.toFixed(2) + '%',
                                    url: el.querySelector('a')?.href,
                                });
                            }
                        }
                    });
                    return extractedDeals;
                });

                allDeals = [...allDeals, ...deals];

                // Vérification de la présence de la page suivante
                hasNextPage = await page.$('ul.a-pagination li.a-disabled.a-last') === null;
                currentPage++;
            }
        }

        if (allDeals.length > 0) {
            await sendLogMessage(`📦 ${allDeals.length} deals trouvés sur Amazon avancé.`);
        } else {
            await sendLogMessage('❌ Aucun deal trouvé sur Amazon avancé.');
        }

        for (let deal of allDeals) {
            const embed = new EmbedBuilder()
                .setTitle(deal.title)
                .setURL(deal.url)
                .addFields(
                    { name: 'Prix actuel', value: deal.currentPrice, inline: true },
                    { name: 'Prix avant', value: deal.oldPrice, inline: true },
                    { name: 'Réduction', value: deal.discount, inline: true },
                )
                .setFooter({ text: 'Amazon Advanced Deal' });

            client.channels.cache.get(channels.electromenager).send({ embeds: [embed] });
            await sendLogMessage(`📌 Produit ajouté : ${deal.title} - ${deal.currentPrice}€ (réduction de ${deal.discount})`);
        }

        await page.close();
        await browser.close();
    } catch (error) {
        await sendLogMessage('⚠️ Erreur lors de la recherche des deals avancés Amazon.');
        console.error('Erreur lors de la recherche des deals avancés Amazon:', error);
    }
}

// ===================== Recherche de Deals Cdiscount =====================

async function checkCdiscountDeals() {
    try {
        await sendLogMessage('🔎 Recherche de deals Cdiscount...');

        const { data } = await axios.get('https://www.cdiscount.com/', {
            headers: {
                'User-Agent': rotateUserAgent(),
                'Referer': 'https://www.google.com',
                'Accept-Language': 'fr-FR,fr;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
            },
        });

        const $ = cheerio.load(data);
        const deals = [];

        $('.productContainer').each((i, el) => {
            const title = $(el).find('.productTitle').text().trim();
            const currentPrice = $(el).find('.productPrice').text().trim();
            const oldPrice = $(el).find('.productOldPrice').text().trim();
            const discount = $(el).find('.productDiscount').text().trim();
            let url = $(el).find('a').attr('href');

            if (url.startsWith('/')) {
                url = `https://www.cdiscount.com${url}`;
            }

            if (parseFloat(discount.replace('%', '').replace('-', '').trim()) >= 50) {
                deals.push({ title, currentPrice, oldPrice, discount, url });
            }
        });

        if (deals.length > 0) {
            await sendLogMessage(`📦 ${deals.length} deals trouvés sur Cdiscount.`);
        } else {
            await sendLogMessage('❌ Aucun deal trouvé sur Cdiscount.');
        }

        for (let deal of deals) {
            const embed = new EmbedBuilder()
                .setTitle(deal.title)
                .setURL(deal.url)
                .addFields(
                    { name: 'Prix actuel', value: deal.currentPrice, inline: true },
                    { name: 'Prix avant', value: deal.oldPrice, inline: true },
                    { name: 'Réduction', value: deal.discount, inline: true },
                )
                .setFooter({ text: 'Cdiscount Deal' });

            client.channels.cache.get(channels.cdiscount).send({ embeds: [embed] });
            await sendLogMessage(`📌 Produit ajouté : ${deal.title} - ${deal.currentPrice}€ (réduction de ${deal.discount})`);
        }
    } catch (error) {
        await sendLogMessage('⚠️ Erreur lors de la recherche des deals Cdiscount.');
        console.error('Erreur lors de la recherche des deals Cdiscount:', error);
    }
}

// ===================== Recherche de Deals Auchan =====================

async function checkAuchanDeals() {
    try {
        await sendLogMessage('🔎 Recherche de deals Auchan...');

        const { data } = await axios.get('https://www.auchan.fr/', {
            headers: {
                'User-Agent': rotateUserAgent(),
                'Referer': 'https://www.google.com',
                'Accept-Language': 'fr-FR,fr;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
            },
        });

        const $ = cheerio.load(data);
        const deals = [];

        $('.productContainer').each((i, el) => {
            const title = $(el).find('.productTitle').text().trim();
            const currentPrice = $(el).find('.productPrice').text().trim();
            const oldPrice = $(el).find('.productOldPrice').text().trim();
            const discount = $(el).find('.productDiscount').text().trim();
            let url = $(el).find('a').attr('href');

            if (url.startsWith('/')) {
                url = `https://www.auchan.fr${url}`;
            }

            if (parseFloat(discount.replace('%', '').replace('-', '').trim()) >= 50) {
                deals.push({ title, currentPrice, oldPrice, discount, url });
            }
        });

        if (deals.length > 0) {
            await sendLogMessage(`📦 ${deals.length} deals trouvés sur Auchan.`);
        } else {
            await sendLogMessage('❌ Aucun deal trouvé sur Auchan.');
        }

        for (let deal of deals) {
            const embed = new EmbedBuilder()
                .setTitle(deal.title)
                .setURL(deal.url)
                .addFields(
                    { name: 'Prix actuel', value: deal.currentPrice, inline: true },
                    { name: 'Prix avant', value: deal.oldPrice, inline: true },
                    { name: 'Réduction', value: deal.discount, inline: true },
                )
                .setFooter({ text: 'Auchan Deal' });

            client.channels.cache.get(channels.auchan).send({ embeds: [embed] });
            await sendLogMessage(`📌 Produit ajouté : ${deal.title} - ${deal.currentPrice}€ (réduction de ${deal.discount})`);
        }
    } catch (error) {
        await sendLogMessage('⚠️ Erreur lors de la recherche des deals Auchan.');
        console.error('Erreur lors de la recherche des deals Auchan:', error);
    }
}

// ===================== Recherche de Deals Manomano =====================

async function checkManomanoDeals() {
    try {
        await sendLogMessage('🔎 Recherche de deals Manomano...');

        const { data } = await axios.get('https://www.manomano.fr/', {
            headers: {
                'User-Agent': rotateUserAgent(),
                'Referer': 'https://www.google.com',
                'Accept-Language': 'fr-FR,fr;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
            },
        });

        const $ = cheerio.load(data);
        const deals = [];

        $('.productContainer').each((i, el) => {
            const title = $(el).find('.productTitle').text().trim();
            const currentPrice = $(el).find('.productPrice').text().trim();
            const oldPrice = $(el).find('.productOldPrice').text().trim();
            const discount = $(el).find('.productDiscount').text().trim();
            let url = $(el).find('a').attr('href');

            if (url.startsWith('/')) {
                url = `https://www.manomano.fr${url}`;
            }

            if (parseFloat(discount.replace('%', '').replace('-', '').trim()) >= 50) {
                deals.push({ title, currentPrice, oldPrice, discount, url });
            }
        });

        if (deals.length > 0) {
            await sendLogMessage(`📦 ${deals.length} deals trouvés sur Manomano.`);
        } else {
            await sendLogMessage('❌ Aucun deal trouvé sur Manomano.');
        }

        for (let deal of deals) {
            const embed = new EmbedBuilder()
                .setTitle(deal.title)
                .setURL(deal.url)
                .addFields(
                    { name: 'Prix actuel', value: deal.currentPrice, inline: true },
                    { name: 'Prix avant', value: deal.oldPrice, inline: true },
                    { name: 'Réduction', value: deal.discount, inline: true },
                )
                .setFooter({ text: 'Manomano Deal' });

            client.channels.cache.get(channels.manomano).send({ embeds: [embed] });
            await sendLogMessage(`📌 Produit ajouté : ${deal.title} - ${deal.currentPrice}€ (réduction de ${deal.discount})`);
        }
    } catch (error) {
        await sendLogMessage('⚠️ Erreur lors de la recherche des deals Manomano.');
        console.error('Erreur lors de la recherche des deals Manomano:', error);
    }
}

// Fonction de rotation du User-Agent
function rotateUserAgent() {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36',
        'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}
