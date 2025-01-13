const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

const userPointsFile = path.resolve(__dirname, 'json', 'userPoints.json');
let userPoints = {};

const loadUserPoints = async () => {
  try {
    const data = await fs.readFile(userPointsFile, 'utf-8');
    userPoints = JSON.parse(data);
  } catch {
    userPoints = {};
    await saveUserPoints();
  }
};

const saveUserPoints = async () => {
  await fs.writeFile(userPointsFile, JSON.stringify(userPoints, null, 2));
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mines')
    .setDescription('Jogue Mines e tente a sorte!')
    .addIntegerOption(option =>
      option.setName('aposta')
        .setDescription('Quantos pontos deseja apostar?')
        .setRequired(true)),

  async execute(interaction) {
    const bet = interaction.options.getInteger('aposta');
    const userId = interaction.user.id;

    await loadUserPoints();

    if (!userPoints[userId]) userPoints[userId] = 0;

    if (userPoints[userId] < bet) {
      return interaction.reply({ content: '<:Exclamation:1324588791989669929> ┃ Você não tem pontos suficientes para essa aposta!', flags: 64 });
    }

    if (bet < 50) {
      return interaction.reply({ content: '<:Exclamation:1324588791989669929> ┃ A aposta mínima é 50 pontos!', flags: 64 });
    }

    userPoints[userId] -= bet;
    await saveUserPoints();

    const rows = 3;
    const cols = 3;
    const gridSize = rows * cols;
    const bombCount = Math.floor(gridSize * 0.3);
    const bombPositions = new Set();

    while (bombPositions.size < bombCount) {
      const pos = Math.floor(Math.random() * gridSize);
      bombPositions.add(pos);
    }

    const revealCell = (index) => bombPositions.has(index) ? 'bomba' : 'diamante';

    const maxButtonsPerRow = 3;
    const actionRows = [];
    let row = new ActionRowBuilder();
    let buttonIndex = 0;

    for (let i = 0; i < rows * cols; i++) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`cell_${buttonIndex}`)
          .setLabel('⚫')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(false)
      );
      buttonIndex++;

      if (row.components.length === maxButtonsPerRow) {
        actionRows.push(row);
        row = new ActionRowBuilder();
      }
    }

    if (row.components.length > 0) {
      actionRows.push(row);
    }

    const stopRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('stop_game')
        .setLabel('Parar')
        .setStyle(ButtonStyle.Primary)
    );

    const gameMessage = await interaction.reply({
      content: `<:Exclamation:1324588791989669929> ┃ Jogo iniciado! Clique nas células para revelar. Boa sorte!`,
      components: [...actionRows, stopRow],
    });

    const collector = gameMessage.createMessageComponentCollector({
      filter: i => i.user.id === userId,
      time: 60000,
    });

    let totalDiamonds = 0;

    collector.on('collect', async buttonInteraction => {
      if (buttonInteraction.customId === 'stop_game') {
        if (totalDiamonds > 0) {
          const totalWon = Math.floor(bet * 0.05 * totalDiamonds);
          userPoints[userId] += totalWon;
          await saveUserPoints();

          collector.stop('stopped');
          return buttonInteraction.update({
            content: `<:Exclamation:1324588791989669929> ┃ Você decidiu parar o jogo e ganhou **${totalWon} SnooCredits**!`,
            components: [],
          });
        } else {
          return buttonInteraction.reply({ content: '<:Exclamation:1324588791989669929> ┃ Você precisa encontrar pelo menos 1 diamante para poder parar!', flags: 64 });
        }
      }

      const cellIndex = parseInt(buttonInteraction.customId.split('_')[1]);
      const result = revealCell(cellIndex);

      if (result === 'bomba') {
        const updatedButton = new ButtonBuilder()
          .setCustomId(`revealed_${cellIndex}`)
          .setLabel('💣')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(true);

        const row = Math.floor(cellIndex / cols);
        const col = cellIndex % cols;
        actionRows[row].components[col] = updatedButton;

        await buttonInteraction.update({
          components: [...actionRows, stopRow],
        });

        collector.stop('bomba');
      } else {
        totalDiamonds++;
        const updatedButton = new ButtonBuilder()
          .setCustomId(`revealed_${cellIndex}`)
          .setLabel('💎')
          .setStyle(ButtonStyle.Success)
          .setDisabled(true);

        const row = Math.floor(cellIndex / cols);
        const col = cellIndex % cols;
        actionRows[row].components[col] = updatedButton;

        await buttonInteraction.update({
          components: [...actionRows, stopRow],
        });
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'bomba') {
        interaction.followUp({
          content: `<:Exclamation:1324588791989669929> ┃ Você encontrou uma bomba e perdeu **${bet} SnooCredits**!`,
          flags: 64
        });
      } else if (reason !== 'stopped') {
        interaction.followUp({
          content: '<:Exclamation:1324588791989669929> ┃ O tempo acabou! Você perdeu a chance de ganhar. ⏳',
          flags: 64
        });
      }

      if (totalDiamonds > 0) {
        const totalWon = Math.floor(bet * 0.05 * totalDiamonds);
        userPoints[userId] += totalWon;
        await saveUserPoints();
        interaction.followUp({
          content: `<:Exclamation:1324588791989669929> ┃ Você encontrou **${totalDiamonds} diamantes** e ganhou **${totalWon} SnooCredits**!`,
          flags: 64
        });
      }
    });
  },
};
