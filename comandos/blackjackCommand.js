const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

const userPointsPath = path.resolve(__dirname, 'json', 'userPoints.json');
const cooldownsPath = path.resolve(__dirname, 'json', 'cooldowns.json');
const houseId = '1312620873743863949';
const houseCommission = 0.10;
const cooldownTime = 1 * 60 * 1000;

// Funções para carregar e salvar dados
async function loadUserPoints() {
    try {
        const data = await fs.readFile(userPointsPath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Erro ao carregar os pontos dos usuários:', err);
        return {}; // Retorna um objeto vazio se não conseguir carregar
    }
}

async function saveUserPoints(userPoints) {
    try {
        await fs.writeFile(userPointsPath, JSON.stringify(userPoints, null, 2), 'utf8');
    } catch (err) {
        console.error('Erro ao salvar os pontos dos usuários:', err);
    }
}

async function loadCooldowns() {
    try {
        const data = await fs.readFile(cooldownsPath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Erro ao carregar os cooldowns:', err);
        return {}; // Retorna um objeto vazio se não conseguir carregar
    }
}

async function saveCooldowns(cooldowns) {
    try {
        await fs.writeFile(cooldownsPath, JSON.stringify(cooldowns, null, 2), 'utf8');
    } catch (err) {
        console.error('Erro ao salvar os cooldowns:', err);
    }
}

// Funções do Jogo
function createDeck() {
    const suits = ['♥', '♦', '♣', '♠'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck = [];

    for (let suit of suits) {
        for (let value of values) {
            deck.push(`${value}${suit}`);
        }
    }
    return deck;
}

function drawCard(deck) {
    return deck.splice(Math.floor(Math.random() * deck.length), 1)[0];
}

function calculateHand(hand) {
    let total = 0;
    let aceCount = 0;

    hand.forEach(card => {
        const value = card.slice(0, -1); // Remove o naipe
        if (value === 'A') {
            aceCount++;
            total += 11;
        } else if (['K', 'Q', 'J'].includes(value)) {
            total += 10;
        } else {
            total += parseInt(value);
        }
    });

    // Ajusta os ases se necessário
    while (total > 21 && aceCount > 0) {
        total -= 10;
        aceCount--;
    }

    return total;
}

function formatHand(hand) {
    return hand.join(' ');
}

function determineWinner(playerTotal, dealerTotal) {
    if (playerTotal > 21) {
        return { message: 'Você perdeu! Estourou 21!', playerWon: false };
    } else if (dealerTotal > 21 || playerTotal > dealerTotal) {
        return { message: 'Você venceu!', playerWon: true };
    } else if (playerTotal < dealerTotal) {
        return { message: 'Você perdeu! O dealer ganhou.', playerWon: false };
    } else {
        return { message: 'Empate!', playerWon: null };
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blackjack')
        .setDescription('Jogue Blackjack contra o Syt!')
        .addIntegerOption(option =>
            option.setName('quantidade')
                .setDescription('Quantidade de SnooCredits para apostar')
                .setRequired(true)),

    async execute(interaction) {
        const userId = interaction.user.id;
        const betAmount = interaction.options.getInteger('quantidade');
        const userPoints = await loadUserPoints();
        const cooldowns = await loadCooldowns();

        const now = Date.now();
        const lastUsed = cooldowns[userId] || 0;

        if (now - lastUsed < cooldownTime) {
            const timeLeft = Math.floor((cooldownTime - (now - lastUsed)) / 1000);
            return interaction.reply({ content: `Você precisa esperar mais ${timeLeft} segundos para jogar novamente.`, ephemeral: true });
        }

        cooldowns[userId] = now;
        await saveCooldowns(cooldowns);

        if (userPoints[userId] < betAmount || betAmount < 50) {
            const errorMessage = betAmount < 50
                ? 'Você precisa ter ao menos 50 SnooCredits para apostar.'
                : 'Você não tem saldo suficiente para essa aposta.';
            return interaction.reply({ content: errorMessage, ephemeral: true });
        }

        const deck = createDeck();
        const playerHand = [drawCard(deck), drawCard(deck)];
        const dealerHand = [drawCard(deck), drawCard(deck)];
        let playerTotal = calculateHand(playerHand);
        let dealerTotal = calculateHand(dealerHand);
        let gameEnded = false;
        let doubleDownBet = 0;

        const embed = new EmbedBuilder()
            .setTitle('Blackjack - Jogo Iniciado!')
            .setDescription('Escolha sua ação abaixo:')
            .addFields(
                { name: 'Sua mão', value: formatHand(playerHand), inline: true },
                { name: 'Total Sua Mão', value: playerTotal.toString(), inline: true },
                { name: 'Mão Dealer', value: `${dealerHand[0]} e uma carta virada.`, inline: true }
            )
            .setColor('#FFFFFF')
            .setImage('https://i.ibb.co/jrk5xyH/f033b9ef0ac9c207e43eff37bc28c648.png');

        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('hit').setLabel('Hit').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('stand').setLabel('Stand').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('double_down').setLabel('Double Down').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('help').setLabel('Como Jogar').setStyle(ButtonStyle.Secondary),
            );

        const message = await interaction.reply({ embeds: [embed], components: [actionRow], fetchReply: true });

        const filter = i => i.user.id === interaction.user.id;
        const collector = message.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
            if (gameEnded) return;

            if (i.customId === 'hit') {
                playerHand.push(drawCard(deck));
                playerTotal = calculateHand(playerHand);

                if (playerTotal > 21) {
                    gameEnded = true;
                    return endGame(interaction, playerHand, dealerHand, 'Você perdeu! Estourou 21!', false, betAmount, doubleDownBet);
                }

                await updateEmbed(interaction, playerHand, playerTotal, dealerHand);
            } else if (i.customId === 'stand') {
                gameEnded = true;
                while (dealerTotal < 17) {
                    dealerHand.push(drawCard(deck));
                    dealerTotal = calculateHand(dealerHand);
                }

                const result = determineWinner(playerTotal, dealerTotal);
                return endGame(interaction, playerHand, dealerHand, result.message, result.playerWon, betAmount, doubleDownBet);
            } else if (i.customId === 'double_down') {
                if (playerHand.length > 2) {
                    return i.reply({ content: 'Você só pode usar Double Down na primeira rodada.', ephemeral: true });
                }

                if (userPoints[userId] < betAmount) {
                    return i.reply({ content: 'Você não tem SnooCredits suficientes para dobrar a aposta!', ephemeral: true });
                }

                doubleDownBet = betAmount * 2;
                await i.deferUpdate();

                playerHand.push(drawCard(deck));
                playerTotal = calculateHand(playerHand);
                gameEnded = true;

                if (playerTotal > 21) {
                    return endGame(interaction, playerHand, dealerHand, 'Você perdeu! Estourou 21!', false, doubleDownBet, doubleDownBet);
                }

                while (dealerTotal < 17) {
                    dealerHand.push(drawCard(deck));
                    dealerTotal = calculateHand(dealerHand);
                }

                const result = determineWinner(playerTotal, dealerTotal);
                return endGame(interaction, playerHand, dealerHand, result.message, result.playerWon, doubleDownBet, doubleDownBet);
            } else if (i.customId === 'help') {
                const helpEmbed = new EmbedBuilder()
                    .setTitle('Como Jogar Blackjack')
                    .setDescription('**Objetivo do Jogo:** Chegar o mais perto de 21 pontos sem ultrapassar esse número.\n\n**Cartas:**\n- Ás: 1 ou 11 pontos.\n- Cartas de 2 a 10: valor igual ao número.\n- Valete, Dama e Rei: 10 pontos.\n\n**Ações:**\n- **Hit:** Pega mais uma carta.\n- **Stand:** Fica com a mão atual.\n- **Double Down:** Dobra a aposta e pega uma carta adicional.\n\nTente vencer o dealer sem estourar os 21 pontos!')
                    .setColor('#FFFFFF')
                    .setFooter({ text: 'Boa sorte!' });

                return i.reply({ embeds: [helpEmbed], ephemeral: true });
            }

            await i.deferUpdate();
        });

        collector.on('end', async collected => {
            if (!gameEnded) {
                await interaction.editReply({ content: 'O tempo acabou! Jogo encerrado.', components: [] });
            }
        });
    },
};

async function endGame(interaction, playerHand, dealerHand, message, playerWon, betAmount, doubleDownBet) {
    const userId = interaction.user.id;
    const userPoints = await loadUserPoints();
    const totalBet = doubleDownBet > 0 ? doubleDownBet : betAmount;

    // Calcular comissão da casa (10% da aposta)
    const commission = totalBet * houseCommission;

    // Atualizar os pontos do jogador
    if (playerWon === null) {
        // Caso de empate, os pontos do jogador não mudam
        message = 'Empate! Seus pontos foram devolvidos.';
    } else if (playerWon) {
        // Se ganhou, o jogador recebe o valor da aposta menos a comissão
        userPoints[userId] += totalBet - commission;
    } else {
        // Se perdeu, o jogador perde a aposta
        userPoints[userId] -= totalBet;
    }

    // Adicionar a comissão da casa ao saldo da "houseId"
    if (!userPoints[houseId]) {
        userPoints[houseId] = 0;  // Se a casa ainda não tiver pontos, inicializa
    }
    userPoints[houseId] += commission;

    // Salvar os pontos atualizados
    await saveUserPoints(userPoints);

    // Criar o embed para mostrar o resultado final
    const embed = new EmbedBuilder()
        .setTitle('Resultado do Blackjack')
        .setDescription(message)
        .addFields(
            { name: 'Sua Mão', value: formatHand(playerHand), inline: true },
            { name: 'Total Sua Mão', value: calculateHand(playerHand).toString(), inline: true },
            { name: 'Mão Dealer', value: formatHand(dealerHand), inline: true },
            { name: 'Total Mão Dealer', value: calculateHand(dealerHand).toString(), inline: true }
        )
        .setColor(playerWon === null ? '#FFFF00' : (playerWon ? '#00FF00' : '#FF0000'))
        .setFooter({ text: playerWon === null ? 'Empate' : (playerWon ? 'Você ganhou!' : 'Você perdeu!') });

    await interaction.editReply({ embeds: [embed], components: [] });
}

async function updateEmbed(interaction, playerHand, playerTotal, dealerHand) {
    const embed = new EmbedBuilder()
        .setTitle('Blackjack - Jogo em Andamento')
        .setDescription('Escolha sua ação abaixo:')
        .addFields(
            { name: 'Sua mão', value: formatHand(playerHand), inline: true },
            { name: 'Total Sua Mão', value: playerTotal.toString(), inline: true },
            { name: 'Mão Syt (Bot)', value: `${dealerHand[0]} e uma carta virada.`, inline: true }
        )
        .setColor('#FFFFFF')
        .setImage('https://i.ibb.co/jrk5xyH/f033b9ef0ac9c207e43eff37bc28c648.png');

    await interaction.editReply({ embeds: [embed] });
}
