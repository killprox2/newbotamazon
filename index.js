const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
});

client.login(process.env.TOKEN);

// Rôles et salons
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
    deal: '1285955371252580352',
    logs: '1285977835365994506', // ID du salon où les logs seront envoyés
};

// Fonction pour envoyer des messages dans le salon de logs
function sendLogMessage(content) {
    const logChannel = client.channels.cache.get(channels.logs);
    if (logChannel) {
        logChannel.send(content);
    } else {
        console.log('Salon de logs introuvable.');
    }
}

// Logs au démarrage du bot
client.once('ready', () => {
    console.log('Bot is online!');
    sendLogMessage('✅ Bot démarré et prêt à l\'emploi.');
});

// Fonction pour envoyer un embed avec les données d'un produit dans le salon Discord
async function sendProductEmbed(productData, channelID) {
    try {
        const embed = new EmbedBuilder()
            .setTitle(productData.name)
            .setURL(productData.url)
            .setImage(productData.image)
            .addFields(
                { name: 'Prix', value: `${productData.price_string}`, inline: true },
                { name: 'Évaluations', value: `${productData.total_reviews} avis`, inline: true },
                { name: 'Note', value: `${productData.stars} ⭐`, inline: true },
                { name: 'Prime', value: productData.has_prime ? 'Oui' : 'Non', inline: true }
            )
            .setFooter({ text: 'Produit Amazon' });

        const discordChannel = client.channels.cache.get(channelID);
        if (discordChannel) {
            await discordChannel.send({ embeds: [embed] });
            sendLogMessage(`📌 Produit ajouté : ${productData.name} - ${productData.price_string}`);
        } else {
            console.error('Salon Discord introuvable');
            sendLogMessage('❌ Échec de l\'envoi du produit : Salon Discord introuvable.');
        }
    } catch (error) {
        console.error('Erreur lors de l\'envoi du produit dans Discord:', error);
        sendLogMessage('❌ Erreur lors de l\'envoi du produit dans Discord.');
    }
}

// Fonction pour récupérer les deals Amazon via ScraperAPI
async function fetchAmazonProducts() {
    try {
        sendLogMessage('🔎 Recherche de deals Amazon via ScraperAPI...');

        // Appel à l'API ScraperAPI avec l'URL Amazon
        const response = await axios.get('https://api.scraperapi.com', {
            params: {
                api_key: process.env.SCRAPER_API_KEY,
                url: 'https://www.amazon.fr/s?k=deals' // Ajuste la requête selon tes besoins
            }
        });

        const products = response.data.results; // Extraction des résultats de la réponse

        if (products && products.length > 0) {
            sendLogMessage(`📦 ${products.length} produits trouvés sur Amazon.`);
            // Pour chaque produit trouvé, on envoie un embed dans le salon Amazon
            products.forEach(product => {
                sendProductEmbed(product, channels.amazon);
            });
        } else {
            sendLogMessage('❌ Aucun produit trouvé sur Amazon.');
        }
    } catch (error) {
        console.error('Erreur lors de la récupération des produits Amazon:', error);
        sendLogMessage('⚠️ Erreur lors de la recherche des deals Amazon via ScraperAPI.');
    }
}

// Fonction de scraping Cdiscount (tu peux la modifier de manière similaire pour les autres)
async function checkCdiscountDeals() {
    try {
        sendLogMessage('🔎 Recherche de deals Cdiscount...');
        const response = await axios.get('https://www.cdiscount.com/');
        const deals = parseCdiscountDeals(response.data); // Fonction pour parser les données

        if (deals.length > 0) {
            sendLogMessage(`📦 ${deals.length} deals trouvés sur Cdiscount.`);
            deals.forEach(deal => {
                const embed = new EmbedBuilder()
                    .setTitle(deal.title)
                    .setURL(deal.url)
                    .addFields(
                        { name: 'Prix actuel', value: deal.currentPrice, inline: true },
                        { name: 'Prix avant', value: deal.oldPrice, inline: true },
                        { name: 'Réduction', value: `${deal.discount}%`, inline: true }
                    )
                    .setFooter({ text: 'Cdiscount Deal' });

                client.channels.cache.get(channels.cdiscount).send({ embeds: [embed] });
                sendLogMessage(`📌 Produit ajouté : ${deal.title} - ${deal.currentPrice}€ (réduction de ${deal.discount}%)`);
            });
        } else {
            sendLogMessage('❌ Aucun deal trouvé sur Cdiscount.');
        }
    } catch (error) {
        sendLogMessage('⚠️ Erreur lors de la recherche des deals Cdiscount.');
        console.error('Erreur lors de la recherche des deals Cdiscount:', error);
    }
}

// Fonction de scraping Auchan
async function checkAuchanDeals() {
    try {
        sendLogMessage('🔎 Recherche de deals Auchan...');
        const response = await axios.get('https://www.auchan.fr/');
        const deals = parseAuchanDeals(response.data); // Fonction pour parser les données

        if (deals.length > 0) {
            sendLogMessage(`📦 ${deals.length} deals trouvés sur Auchan.`);
            deals.forEach(deal => {
                const embed = new EmbedBuilder()
                    .setTitle(deal.title)
                    .setURL(deal.url)
                    .addFields(
                        { name: 'Prix actuel', value: deal.currentPrice, inline: true },
                        { name: 'Prix avant', value: deal.oldPrice, inline: true },
                        { name: 'Réduction', value: `${deal.discount}%`, inline: true }
                    )
                    .setFooter({ text: 'Auchan Deal' });

                client.channels.cache.get(channels.auchan).send({ embeds: [embed] });
                sendLogMessage(`📌 Produit ajouté : ${deal.title} - ${deal.currentPrice}€ (réduction de ${deal.discount}%)`);
            });
        } else {
            sendLogMessage('❌ Aucun deal trouvé sur Auchan.');
        }
    } catch (error) {
        sendLogMessage('⚠️ Erreur lors de la recherche des deals Auchan.');
        console.error('Erreur lors de la recherche des deals Auchan:', error);
    }
}

// Fonction de scraping Manomano
async function checkManomanoDeals() {
    try {
        sendLogMessage('🔎 Recherche de deals Manomano...');
        const response = await axios.get('https://www.manomano.fr/');
        const deals = parseManomanoDeals(response.data); // Fonction pour parser les données

        if (deals.length > 0) {
            sendLogMessage(`📦 ${deals.length} deals trouvés sur Manomano.`);
            deals.forEach(deal => {
                const embed = new EmbedBuilder()
                    .setTitle(deal.title)
                    .setURL(deal.url)
                    .addFields(
                        { name: 'Prix actuel', value: deal.currentPrice, inline: true },
                        { name: 'Prix avant', value: deal.oldPrice, inline: true },
                        { name: 'Réduction', value: `${deal.discount}%`, inline: true }
                    )
                    .setFooter({ text: 'Manomano Deal' });

                client.channels.cache.get(channels.manomano).send({ embeds: [embed] });
                sendLogMessage(`📌 Produit ajouté : ${deal.title} - ${deal.currentPrice}€ (réduction de ${deal.discount}%)`);
            });
        } else {
            sendLogMessage('❌ Aucun deal trouvé sur Manomano.');
        }
    } catch (error) {
        sendLogMessage('⚠️ Erreur lors de la recherche des deals Manomano.');
        console.error('Erreur lors de la recherche des deals Manomano:', error);
    }
}

// Planification de la recherche de deals (exécute toutes les heures)
setInterval(() => {
    sendLogMessage('🔄 Lancement de la recherche de deals Amazon via ScraperAPI...');
    fetchAmazonProducts();
}, 3600000); // Toutes les heures

setInterval(() => {
    sendLogMessage('🔄 Lancement de la recherche de deals Cdiscount...');
    checkCdiscountDeals();
}, 3600000); // Toutes les heures

setInterval(() => {
    sendLogMessage('🔄 Lancement de la recherche de deals Auchan...');
    checkAuchanDeals();
}, 3600000); // Toutes les heures

setInterval(() => {
    sendLogMessage('🔄 Lancement de la recherche de deals Manomano...');
    checkManomanoDeals();
}, 3600000); // Toutes les heures
