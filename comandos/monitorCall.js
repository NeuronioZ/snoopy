const fs = require('fs').promises;
const path = require('path');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { joinVoiceChannel, VoiceConnectionStatus } = require('@discordjs/voice');
const { EmbedBuilder } = require('discord.js');

const userPointsPath = path.resolve(__dirname, 'json', 'userPoints.json');
const callChannelId = '1325261285302210651';
const pointsToGive = 20;
const notificationChannelId = '1324577740539560018';
let botVoiceConnection = null;

const usersInCall = {};
const callTimePath = path.resolve(__dirname, 'json', 'callTime.json');

const loadData = async (path) => {
  try {
    const data = await fs.readFile(path, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Erro ao carregar dados de ${path}:`, error);
    return {};
  }
};

const saveData = async (path, data) => {
  try {
    await fs.writeFile(path, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Erro ao salvar dados em ${path}:`, error);
  }
};

const addPoints = async (userId, points, userPoints, client) => {
  if (!userPoints[userId]) {
    userPoints[userId] = 0;
  }

  const member = await client.guilds.cache.get('1187947032183308389').members.fetch(userId);
  const hasSpecialRole = member.roles.cache.has('1322606733801033779');

  if (hasSpecialRole) {
    points *= 2;
  }

  userPoints[userId] += points;
  await saveData(userPointsPath, userPoints);

  const channel = client.channels.cache.get(notificationChannelId);
  if (channel) {
    const user = await client.users.fetch(userId);
    channel.send(`<:Exclamation:1324588791989669929> ┃ ${user}, você ganhou ${points} pontos!`);
  }
};

const ensureBotInCall = async (client) => {
  try {
    const guild = await client.guilds.fetch('1187947032183308389');
    const channel = guild.channels.cache.get(callChannelId);

    if (!channel) {
      console.log("Call channel não encontrado.");
      return;
    }

    if (channel.members.has(client.user.id)) {
      console.log('Bot já está na call.');
      return;
    }

    botVoiceConnection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
    });

    botVoiceConnection.on(VoiceConnectionStatus.Ready, () => {
      console.log('Bot está pronto para interagir no canal de voz.');
    });

    botVoiceConnection.on(VoiceConnectionStatus.Disconnected, () => {
      console.log('Bot desconectado do canal de voz.');
    });

    botVoiceConnection.on('error', (error) => {
      console.error('Erro ao tentar conectar na call:', error);
    });

  } catch (error) {
    console.error('Erro ao fazer o bot entrar na call:', error);
  }
};

const givePointsToUsersInCall = async (client, userPoints, callTimeData) => {
  const guild = await client.guilds.fetch('1187947032183308389');
  const channel = guild.channels.cache.get(callChannelId);

  if (!channel) return;

  const now = Date.now();

  for (const member of channel.members.values()) {
    const userId = member.id;

    if (!usersInCall[userId]) {
      usersInCall[userId] = { joinTime: now, totalTime: 0, lastChecked: now };
    }

    usersInCall[userId].totalTime = now - usersInCall[userId].joinTime;

    if (now - usersInCall[userId].lastChecked >= 60 * 60 * 1000) {
      await addPoints(userId, pointsToGive, userPoints, client);
      usersInCall[userId].lastChecked = now;
    }

    callTimeData[userId] = usersInCall[userId].totalTime;
    await saveData(callTimePath, callTimeData);
  }
};

const startMonitoringCall = (client) => {
  setInterval(async () => {
    const userPoints = await loadData(userPointsPath);
    const callTimeData = await loadData(callTimePath);

    ensureBotInCall(client);
    givePointsToUsersInCall(client, userPoints, callTimeData);
  }, 60 * 1000); // Monitorando a call a cada 1 minuto
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('monitorcall')
    .setDescription('Monitora a call do canal de voz e permite que o bot entre na call.'),

  async execute(interaction) {
    const { client } = interaction;

    await ensureBotInCall(client);

    startMonitoringCall(client);

    interaction.reply('Bot entrou na call e está monitorando a permanência dos usuários!');
  },
};
