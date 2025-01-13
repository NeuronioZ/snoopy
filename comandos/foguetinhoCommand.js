const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

const userPointsPath = path.resolve(__dirname, 'json', 'userPoints.json');
const cooldownsPath = path.resolve(__dirname, 'json', 'cooldowns.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('foguetinho')
    .setDescription('Aposte no foguete e veja até onde ele vai!')
    .addIntegerOption(option =>
      option.setName('quantidade')
        .setDescription('Quantia de pontos para apostar (mínimo 50)')
        .setRequired(true)),

  async execute(interaction) {
    const betAmount = interaction.options.getInteger('quantidade');
    const userId = interaction.user.id;

    const cooldownData = await loadCooldowns();
    const now = Date.now();
    const cooldownTime = 1 * 60 * 1000;

    if (cooldownData[userId] && now - cooldownData[userId] < cooldownTime) {
      const timeRemainingSeconds = Math.ceil((cooldownTime - (now - cooldownData[userId])) / 1000);
      const timeRemainingMinutes = Math.ceil(timeRemainingSeconds / 60);
      return interaction.reply({ content: `Você precisa esperar mais ${timeRemainingMinutes} minuto(s) para jogar novamente.`, ephemeral: true });
    }

    cooldownData[userId] = now;
    await saveCooldowns(cooldownData);

    if (betAmount < 50) {
      return interaction.reply({ content: 'A aposta mínima é 50 pontos!', ephemeral: true });
    }

    const userPoints = await loadUserPoints();

    if (userPoints[userId] < betAmount || betAmount <= 0) {
      return interaction.reply({ content: 'Você não tem pontos suficientes para apostar.', ephemeral: true });
    }

    let accumulatedPoints = 0;
    let gameEnded = false;
    let gameResult = '';
    let timeElapsed = 0;
    let rocketPosition = 0;

    const embed = new EmbedBuilder()
      .setTitle('Jogo do Foguetinho - Iniciado <:snoopy_coffee:1323869950775132180>')
      .setDescription('<:white_dash:1323871271297089627> Clique em "Parar" antes que ele exploda!')
      .addFields(
        { name: '<:white_dot:1323871280021110835> Sua Aposta', value: betAmount.toString(), inline: true },
        { name: '<:white_dot:1323871280021110835> Pontos Acumulados', value: '0', inline: true },
        { name: '<:white_dot:1323871280021110835> Status', value: 'Aguardando...', inline: true },
        { name: '<:white_dot:1323871280021110835> Tempo', value: '0s', inline: true }
      )
      .setColor('#FFFFFF');

    const actionRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder().setCustomId('parar').setLabel('Parar').setStyle(ButtonStyle.Danger),
      );

    const message = await interaction.reply({ embeds: [embed], components: [actionRow], fetchReply: true });

    const filter = i => i.user.id === interaction.user.id;
    const collector = message.createMessageComponentCollector({ filter, time: 60000 });

    let intervalId;

    const updateGame = async () => {
      if (gameEnded) return;

      accumulatedPoints += Math.floor(betAmount / 10);
      timeElapsed += 1;
      rocketPosition += 1;

      let chanceOfFailure = 0.2;
      if (betAmount > 100) {
        chanceOfFailure = 0.4;
      }

      if (Math.random() < chanceOfFailure) {
        gameEnded = true;
        gameResult = `O foguete caiu! 💥 Você perdeu a aposta após ter subido ${rocketPosition} metros. <:snoopy_snooze:1323869958735921183>`;
        return endGame(interaction, gameResult, false, betAmount, accumulatedPoints, rocketPosition);
      }

      const rocketMovement = '🚀'.repeat(rocketPosition);

      const embedToUpdate = new EmbedBuilder()
        .setTitle('Jogo do Foguetinho - Iniciado <:snoopy_coffee:1323869950775132180>')
        .setDescription(rocketMovement)
        .addFields(
          { name: '<:white_star:1323871287625383956> Sua Aposta', value: betAmount.toString(), inline: true },
          { name: '<:white_star:1323871287625383956> Pontos Acumulados', value: accumulatedPoints.toString(), inline: true },
          { name: '<:white_dot:1323871280021110835> Status', value: 'Aguardando...', inline: true },
          { name: '<:white_dot:1323871280021110835> Tempo', value: `${timeElapsed}s`, inline: true }
        )
        .setColor('#FFFFFF');

      await interaction.editReply({ embeds: [embedToUpdate] });
    };

    intervalId = setInterval(updateGame, 1000);

    collector.on('collect', async i => {
      if (gameEnded) return;

      if (i.customId === 'parar') {
        gameEnded = true;
        gameResult = `Você parou! Você ganhou ${accumulatedPoints} pontos. <:snoopy_ok:1323869918369939576>`;
        clearInterval(intervalId);
        return endGame(interaction, gameResult, true, betAmount, accumulatedPoints, rocketPosition);
      }
    });

    collector.on('end', async () => {
      if (!gameEnded) {
        clearInterval(intervalId);
        await interaction.editReply({ content: 'O tempo acabou! Você não parou a partida. <:snoopy_tear:1323869994425254018>', components: [] });
      }
    });
  },
};

async function endGame(interaction, resultMessage, playerWon, betAmount, accumulatedPoints, rocketPosition) {
  const userPoints = await loadUserPoints();
  const totalPoints = userPoints[interaction.user.id] || 0;

  const finalPoints = playerWon ? totalPoints + accumulatedPoints : totalPoints - betAmount;

  const embed = new EmbedBuilder()
    .setTitle(playerWon ? 'Parabéns!<:White_heart:1323871248886927461> ' : 'Que pena! <:snoopy_snooze:1323869958735921183>')
    .setDescription(resultMessage)
    .setColor(playerWon ? '#FFFFFF' : '#FFFFFF')
    .addFields(
      { name: '<:white_star:1323871287625383956> Pontos Ganhos', value: playerWon ? `${betAmount + accumulatedPoints}` : '0', inline: true },
      { name: '<:white_star:1323871287625383956> Pontos Totais', value: finalPoints.toString(), inline: true }
    );

  await interaction.editReply({ embeds: [embed], components: [] });

  if (playerWon) {
    userPoints[interaction.user.id] += accumulatedPoints;
  } else {
    userPoints[interaction.user.id] -= betAmount;
  }
  await saveUserPoints(userPoints);
}

async function loadUserPoints() {
  try {
    const data = await fs.readFile(userPointsPath, 'utf-8');
    return data ? JSON.parse(data) : {};
  } catch (err) {
    console.error('Erro ao carregar pontos:', err);
    return {};
  }
}

async function saveUserPoints(points) {
  try {
    await fs.writeFile(userPointsPath, JSON.stringify(points, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao salvar pontos:', err);
  }
}

async function loadCooldowns() {
  try {
    await fs.access(cooldownsPath);
    const data = await fs.readFile(cooldownsPath, 'utf-8');
    return data ? JSON.parse(data) : {};
  } catch (err) {
    return {};
  }
}

async function saveCooldowns(cooldowns) {
  try {
    await fs.writeFile(cooldownsPath, JSON.stringify(cooldowns, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao salvar cooldowns:', err);
  }
}
