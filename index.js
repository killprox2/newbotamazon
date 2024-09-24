const axios = require('axios');
const cheerio = require('cheerio');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const winston = require('winston');

// Liste de proxys gratuits (remplace avec une liste mise à jour régulièrement)
const proxies = [
    'http://12.34.56.78:8080',
    'http://23.45.67.89:8080',
    // Ajoute autant de proxys que possible
];

// Fonction pour obtenir un proxy aléatoire
function getRandomProxy() {
    return proxies[Math.floor(Math.random() * proxies.length)];
}

// Liste des user-agents pour simuler différents navigateurs
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.2 Safari/605.1.15',
    // Ajoute plus de user-agents ici
];

// Fonction pour obtenir un user-agent aléatoire
function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// Configurer les logs avec Winston
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level.toUpperCase()}] - ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'bot_logs.log' })
    ]
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

// Associer les catégories à l'ID des salons Discord
const categoryChannels = {
    "entretien": "1255863140974071893",
    "logs": "1285977835365994506" // Remplace avec l'ID du salon de logs
};

// Fonction pour envoyer des logs dans le salon de logs
async function sendLogToChannel(logMessage) {
    const logChannel = client.channels.cache.get(categoryChannels.logs);
    if (logChannel) {
        logChannel.send(logMessage);
    } else {
        console.error('Le salon "logs" n\'a pas été trouvé.');
    }
}

// Scraping avec rotation des proxies et user-agents
async function scrapeAmazon(category, channelID) {
    logger.info(`Scraping démarré pour la catégorie ${category}.`);
    sendLogToChannel(`📄 Scraping démarré pour la catégorie **${category}**.`);

    for (let i = 1; i <= 5; i++) {  // Limité à 5 pages pour tester
        const url = `https://www.amazon.fr/s?k=${category}&page=${i}`;
        const proxy = getRandomProxy();  // Choisir un proxy aléatoire
        const userAgent = getRandomUserAgent();  // Choisir un user-agent aléatoire

        logger.info(`Accès à la page ${i} pour la catégorie ${category} avec le proxy ${proxy}.`);
        sendLogToChannel(`🔍 Accès à la page **${i}** pour la catégorie **${category}**.`);

        try {
            const { data } = await axios.get(url, {
                headers: {
                    'User-Agent': userAgent
                },
                proxy: {
                    host: proxy.split(':')[1].replace('//', ''),  // Format du proxy
                    port: parseInt(proxy.split(':')[2])
                }
            });

            const $ = cheerio.load(data);
            let products = [];

            $('.s-main-slot .s-result-item').each((index, element) => {
                const title = $(element).find('h2 a span').text();
                const link = $(element).find('h2 a').attr('href');
                const priceOld = $(element).find('.a-price.a-text-price span').text();
                const priceNew = $(element).find('.a-price .a-offscreen').text();

                if (title && link && priceOld && priceNew) {
                    const oldPrice = parseFloat(priceOld.replace(/[^\d,.-]/g, '').replace(',', '.'));
                    const newPrice = parseFloat(priceNew.replace(/[^\d,.-]/g, '').replace(',', '.'));
                    const discount = ((oldPrice - newPrice) / oldPrice) * 100;

                    if (discount >= 50) {
                        products.push({
                            title: title,
                            link: `https://www.amazon.fr${link}`,
                            oldPrice: oldPrice,
                            newPrice: newPrice,
                            discount: discount.toFixed(2)
                        });
                    }
                }
            });

            if (products.length > 0) {
                const embed = new EmbedBuilder()
                    .setTitle(`Produits avec réduction dans la catégorie ${category}`)
                    .setColor('#ff9900')
                    .setDescription(products.map(p => `**${p.title}**\nAncien prix: ${p.oldPrice}€, Nouveau prix: ${p.newPrice}€, Réduction: ${p.discount}%\n[Lien](${p.link})`).join('\n\n'));

                const discordChannel = client.channels.cache.get(channelID);
                if (discordChannel) {
                    discordChannel.send({ embeds: [embed] });
                    logger.info(`Produits envoyés dans le salon ${category}.`);
                    sendLogToChannel(`✅ **${products.length} produits trouvés** dans la catégorie **${category}** ont été ajoutés au salon.`);
                }
            } else {
                sendLogToChannel(`❌ Aucun produit trouvé sur la page **${i}** de la catégorie **${category}**.`);
            }

        } catch (error) {
            logger.error(`Erreur lors de l'accès à la page ${i} pour la catégorie ${category}: ${error.message}`);
            sendLogToChannel(`⚠️ Erreur lors de l'accès à la page **${i}** pour la catégorie **${category}**: ${error.message}`);
            continue;  // Passe à la page suivante en cas d'erreur
        }

        // Délai aléatoire pour éviter une surcharge
        const delay = Math.floor(Math.random() * (60000 - 30000 + 1)) + 30000;  // Délai aléatoire entre 30 et 60 secondes
        await new Promise(resolve => setTimeout(resolve, delay));
    }
}

// Démarrage du scraping
async function startScraping() {
    for (const [category, channelID] of Object.entries(categoryChannels)) {
        if (category !== "logs") {
            logger.info(`Démarrage du scraping pour la catégorie ${category}.`);
            sendLogToChannel(`Démarrage du scraping pour la catégorie **${category}**.`);
            await scrapeAmazon(category, channelID);
        }
    }
}

client.once('ready', () => {
    logger.info('Bot is ready!');
    sendLogToChannel('⚙️ Le bot a démarré et est prêt à scraper.');
    startScraping();  // Lancer le scraping dès que le bot est prêt
});

client.login(process.env.TOKEN);
