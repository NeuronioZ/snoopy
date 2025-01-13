const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

const cooldowns = new Map();

const userPointsPath = path.resolve(__dirname, 'json', 'userPoints.json');
const roubarDataPath = path.resolve(__dirname, 'json', 'roubar.json');
const factionsPath = path.resolve(__dirname, 'json', 'factions.json');

let userPoints = {};
let roubarData = [];
let factions = {};
const lock = {};

const loadData = async () => {
  try {
    if (await fileExists(userPointsPath)) {
      const data = await fs.readFile(userPointsPath, 'utf-8');
      userPoints = data ? JSON.parse(data) : {};
    }
  } catch (error) {
    console.error('Erro ao carregar os dados de pontos:', error);
    userPoints = {};
  }
};

const loadRoubarData = async () => {
  try {
    if (await fileExists(roubarDataPath)) {
      const data = await fs.readFile(roubarDataPath, 'utf-8');
      roubarData = Array.isArray(JSON.parse(data)) ? JSON.parse(data) : [];
    } else {
      roubarData = [];
    }
  } catch (error) {
    console.error('Erro ao carregar os dados de roubo:', error);
    roubarData = [];
  }
};

const loadFactionsData = async () => {
  try {
    if (await fileExists(factionsPath)) {
      const data = await fs.readFile(factionsPath, 'utf-8');
      factions = JSON.parse(data);
    } else {
      factions = {};
    }
  } catch (error) {
    console.error('Erro ao carregar os dados das facções:', error);
    factions = {};
  }
};

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const savePointsData = async () => {
  try {
    await fs.writeFile(userPointsPath, JSON.stringify(userPoints, null, 2));
  } catch (error) {
    console.error('Erro ao salvar os dados de pontos:', error);
  }
};

const saveRoubarData = async () => {
  try {
    await fs.writeFile(roubarDataPath, JSON.stringify(roubarData, null, 2));
  } catch (error) {
    console.error('Erro ao salvar os dados de roubo:', error);
  }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roubar')
    .setDescription('Tente roubar pontos de outro usuário.')
    .addUserOption((option) =>
      option.setName('alvo').setDescription('O usuário que você quer tentar roubar.').setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const targetUser = interaction.options.getUser('alvo');

    const protectedUserIds = [
      '1242981733792743474',
      '1242982998052311151',
      '1242981002717036646'
    ];

    if (protectedUserIds.includes(targetUser.id)) {
      return interaction.reply({
        content: 'Você não pode roubar esses usuários!',
        ephemeral: true
      });
    }

    if (targetUser.id === userId) {
      return interaction.reply({ content: 'Você não pode tentar roubar de si mesmo!', ephemeral: true });
    }

    await loadData(); // Aguarda carregar os dados
    await loadRoubarData(); // Aguarda carregar os dados de roubo
    await loadFactionsData(); // Aguarda carregar os dados das facções

    if ((userPoints[userId] || 0) < 100) {
      return interaction.reply({
        content: '<:Exclamation:1324588791989669929> ┃ Você precisa de pelo menos 100 pontos para tentar roubar!',
        ephemeral: true,
      });
    }

    // Lógica de cooldown e outras verificações
    if (cooldowns.has(userId)) {
      const expirationTime = cooldowns.get(userId);
      const now = Date.now();
      if (now < expirationTime) {
        const remainingTime = Math.ceil((expirationTime - now) / 60000);
        return interaction.reply({
          content: `<:Exclamation:1324588791989669929> ┃ Você deve esperar ${remainingTime} minuto(s) para tentar novamente.`,
          ephemeral: true,
        });
      }
    }

    cooldowns.set(userId, Date.now() + 15 * 60 * 1000);

    if (!userPoints[targetUser.id] || userPoints[targetUser.id] === 0) {
      return interaction.reply({
        content: `<:Exclamation:1324588791989669929> ┃ ${targetUser.tag} não tem pontos para você roubar!`,
        ephemeral: true,
      });
    }

    // Verifica facções para impedir roubos internos
    const userFaction = Object.values(factions).find((faction) => faction.membros.includes(userId));
    const targetFaction = Object.values(factions).find((faction) => faction.membros.includes(targetUser.id));

    if (userFaction && targetFaction && userFaction.nome === targetFaction.nome) {
      return interaction.reply({
        content: 'Você não pode roubar membros da sua própria facção!',
        ephemeral: true,
      });
    }

    let stolenPoints = Math.floor(Math.random() * 101);
    const isBot = targetUser.bot;
    const successChance = Math.random();
    let embed;

    const successRate = isBot ? 0.3 : 0.5;
    const isSuccessful = successChance <= successRate;

    if (isSuccessful) {
      userPoints[userId] = (userPoints[userId] || 0) + stolenPoints;
      userPoints[targetUser.id] = Math.max(0, (userPoints[targetUser.id] || 0) - stolenPoints);

      embed = new EmbedBuilder()
        .setColor('#ECFD01')
        .setTitle('Roubo Bem-Sucedido! 💰')
        .setDescription(`<:Exclamation:1324588791989669929> ┃ ${interaction.user.tag} roubou **${stolenPoints} SnooCredits** de ${targetUser.tag}!`)
        .addFields(
          { name: 'Seu Saldo', value: `${userPoints[userId]}`, inline: true },
          { name: 'Saldo do Alvo', value: `${userPoints[targetUser.id]}`, inline: true }
        )
        .setTimestamp();
    } else {
      userPoints[userId] = Math.max(0, (userPoints[userId] || 0) - stolenPoints);
      userPoints[targetUser.id] = (userPoints[targetUser.id] || 0) + stolenPoints;

      embed = new EmbedBuilder()
        .setColor('#2285FF')
        .setTitle('Preso! 👮')
        .setDescription(
          `<:Exclamation:1324588791989669929> ┃ ${interaction.user.tag} tentou roubar ${targetUser.tag}, mas foi pego e teve que pagar **${stolenPoints} SnooCredits** para ser solto!`
        )
        .addFields(
          { name: 'Seu Saldo', value: `${userPoints[userId]}`, inline: true },
          { name: 'Saldo do Alvo', value: `${userPoints[targetUser.id]}`, inline: true }
        )
        .setTimestamp();
    }

    // Salva os dados de pontos após a operação
    await savePointsData(); // Aguarda a gravação dos dados de pontos
    await saveRoubarData(); // Aguarda a gravação dos dados de roubo

    return interaction.reply({ embeds: [embed] });
  },
};
