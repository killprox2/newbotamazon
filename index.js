const axios = require('axios');
const cheerio = require('cheerio');
const { Client, GatewayIntentBits, MessageEmbed } = require('discord.js');
const winston = require('winston');

// Configurer les logs
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

// Initialiser le client Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

// Associer les catégories à l'ID des salons Discord
const categoryChannels = {
    "entretien": "ID_SALON_ENTRETIEN",
    "electronique": "ID_SALON_ELECTRONIQUE",
    "smartphone": "ID_SALON_SMARTPHONE",
    "electromenager": "ID_SALON_ELECTROMENAGER",
    "enfant": "ID_SALON_ENFANT",
    "jouet": "ID_SALON_JOUET",
    "hygiene": "ID_SALON_HYGIENE",
    "bebe": "ID_SALON_BEBE",
    "bricolage": "ID_SALON_BRICOLAGE",
    "jardin": "ID_SALON_JARDIN",
    "logs": "1285977835365994506" // ID du salon pour les logs
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

// Scraping avec Cheerio et Axios
async function scrapeAmazon(category, channelID) {
    logger.info(`Scraping démarré pour la catégorie ${category}.`);
    sendLogToChannel(`📄 Scraping démarré pour la catégorie **${category}**.`);

    for (let i = 1; i <= 50; i++) {
        const url = `https://www.amazon.fr/s?k=${category}&page=${i}`;
        logger.info(`Accès à la page ${i} pour la catégorie ${category} : ${url}`);
        sendLogToChannel(`🔍 Accès à la page **${i}** pour la catégorie **${category}** : [Lien](${url})`);

        try {
            const { data } = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:91.0) Gecko/20100101 Firefox/91.0',
                    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'DNT': '1', // Ne pas me suivre
                    'Upgrade-Insecure-Requests': '1',
                    'TE': 'Trailers'
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

                    if (discount >= 40) {
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
                const embed = new MessageEmbed()
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
            continue; // Passe à la page suivante en cas d'erreur
        }

        // Délai pour éviter une surcharge
        await new Promise(resolve => setTimeout(resolve, 60000)); // Augmente le délai
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

client.login(process.env.TOKEN);
