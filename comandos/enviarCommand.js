const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

const userPointsPath = path.resolve(__dirname, 'json', 'userPoints.json');
const lock = {};

const loadData = async () => {
  try {
    if (await fileExists(userPointsPath)) {
      const data = JSON.parse(await fs.readFile(userPointsPath, 'utf-8'));
      return validateUserPoints(data);
    }
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
  }
  return {};
};

const saveDataWithLock = async (data) => {
  if (lock[userPointsPath]) {
    await lock[userPointsPath];
  }
  let resolveLock;
  lock[userPointsPath] = new Promise((resolve) => (resolveLock = resolve));
  try {
    await fs.writeFile(userPointsPath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Erro ao salvar dados:', error);
  } finally {
    resolveLock();
    delete lock[userPointsPath];
  }
};

const validateUserPoints = (data) => {
  if (typeof data !== 'object' || Array.isArray(data)) return {};
  for (const key in data) {
    if (typeof data[key] !== 'number' || data[key] < 0) {
      data[key] = 0;
    }
  }
  return data;
};

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pix')
    .setDescription('Envie pontos (snowflakes) para outro usuário.')
    .addUserOption((option) =>
      option
        .setName('destinatario')
        .setDescription('O usuário para quem você deseja enviar pontos.')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('quantia')
        .setDescription('A quantidade de pontos que deseja enviar.')
        .setRequired(true)
    ),

  async execute(interaction) {
    const remetenteId = interaction.user.id;
    const destinatario = interaction.options.getUser('destinatario');
    const quantia = interaction.options.getInteger('quantia');

    if (!destinatario) {
      return interaction.reply({ content: '❌ Usuário destinatário inválido.', ephemeral: true });
    }
    if (destinatario.bot) {
      return interaction.reply({ content: '❌ Você não pode enviar pontos para bots.', ephemeral: true });
    }
    if (remetenteId === destinatario.id) {
      return interaction.reply({ content: '❌ Você não pode enviar pontos para si mesmo!', ephemeral: true });
    }
    if (quantia <= 0) {
      return interaction.reply({ content: '❌ A quantia deve ser maior que zero.', ephemeral: true });
    }

    let userPoints = await loadData();

    userPoints[remetenteId] = userPoints[remetenteId] || 0;
    userPoints[destinatario.id] = userPoints[destinatario.id] || 0;

    if (userPoints[remetenteId] < quantia) {
      return interaction.reply({
        content: '❌ Você não tem pontos suficientes para realizar esta transação.',
        ephemeral: true,
      });
    }

    userPoints[remetenteId] -= quantia;
    userPoints[destinatario.id] += quantia;

    await saveDataWithLock(userPoints);

    const confirmEmbed = new EmbedBuilder()
      .setColor('#FFFFFF')
      .setTitle('Enviado! <:snoopy_coffee:1323869950775132180>')
      .setDescription(`**${interaction.user.username}** enviou **${quantia} pontos** para **${destinatario.username}**!`)
      .addFields(
        { name: '📉 Saldo Atual (Remetente)', value: `${userPoints[remetenteId]} pontos`, inline: true },
        { name: '📈 Saldo Atual (Destinatário)', value: `${userPoints[destinatario.id]} pontos`, inline: true }
      )
      .setFooter({ text: 'A transação foi concluída!', iconURL: 'https://i.ibb.co/2kCbXx7/snoopy.png' })
      .setTimestamp();

    await interaction.reply({ embeds: [confirmEmbed] });

    await loadData();
  },
};
