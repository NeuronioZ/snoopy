const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');

require('dotenv').config(); // Carregar variáveis de ambiente do arquivo .env

// Constantes de autenticação e IDs
const TOKEN = process.env.TOKEN || 'MTMxMjYyMDg3Mzc0Mzg2Mzk0OQ.GZ4Ppb.6fUWGY5PqYne-GHGDqzHZMD-2seOqTFhYHgwHk';
const CLIENT_ID = process.env.CLIENT_ID || '1312620873743863949';

if (!TOKEN || !CLIENT_ID) {
  console.error('Erro: TOKEN ou CLIENT_ID não definidos.');
  process.exit(1);
}

// Arquivos de dados
const userMessagesFile = path.resolve(__dirname, 'json', 'userMessages.json');
const userPointsFile = path.resolve(__dirname, 'json', 'userPoints.json');

// Estruturas de dados
let userMessages = {};
let userPoints = {};
const cooldowns = new Map();
const cooldownTime = 2 * 60 * 1000; // 2 minutos

// Funções para garantir que o diretório e os arquivos existam
const ensureDirectoryAndFiles = async () => {
  const jsonDir = path.resolve(__dirname, 'json');

  try {
    await fs.promises.mkdir(jsonDir, { recursive: true });

    const files = [
      { path: userMessagesFile, defaultData: JSON.stringify({}, null, 2) },
      { path: userPointsFile, defaultData: JSON.stringify({}, null, 2) },
    ];

    for (const { path, defaultData } of files) {
      const fileExists = await fs.promises
        .access(path)
        .then(() => true)
        .catch(() => false);

      if (!fileExists) {
        await fs.promises.writeFile(path, defaultData);
      }
    }
  } catch (error) {
    console.error('Erro ao garantir diretório e arquivos:', error);
  }
};

// Funções para carregar e salvar dados
const loadData = async () => {
  try {
    await ensureDirectoryAndFiles();

    userMessages = JSON.parse(await fs.promises.readFile(userMessagesFile, 'utf-8')) || {};
    userPoints = JSON.parse(await fs.promises.readFile(userPointsFile, 'utf-8')) || {};
  } catch (error) {
    console.error('Erro ao carregar os dados:', error);
  }
};

const saveMessagesData = async () => {
  try {
    await fs.promises.writeFile(
      userMessagesFile,
      JSON.stringify(userMessages, null, 2)
    );
  } catch (error) {
    console.error('Erro ao salvar os dados de mensagens:', error);
  }
};

const savePointsData = async () => {
  try {
    await fs.promises.writeFile(
      userPointsFile,
      JSON.stringify(userPoints, null, 2)
    );
  } catch (error) {
    console.error('Erro ao salvar os dados de pontos:', error);
  }
};

// Inicializando o cliente do Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Inicializando client.commands
client.commands = new Map();
const commands = [];
const commandNames = new Set();

// Carregar os comandos da pasta "comandos"
const commandsPath = path.join(__dirname, 'comandos');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if (command.data && typeof command.execute === 'function') {
    if (!commandNames.has(command.data.name)) {
      commands.push(command.data);
      client.commands.set(command.data.name, command);
      commandNames.add(command.data.name);
    } else {
      console.error(`Erro: O comando '${command.data.name}' no arquivo '${file}' já foi registrado.`);
    }
  } else {
    console.error(`O comando ${file} não possui a propriedade 'data' ou 'execute' correta.`);
  }
}

// Registrar os comandos no Discord
const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    console.log('Iniciando registro de comandos...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Comandos registrados com sucesso!');
  } catch (error) {
    console.error('Erro ao registrar comandos:', error);
  }
})();

// Evento de login do bot
client.once('ready', () => {
  console.log(`Bot logado como ${client.user.tag}`);
  loadData();

  setInterval(() => {
    sendRandomMessages();
  }, 15 * 60 * 1000); // 15 minutos

  setInterval(() => {
    cleanOldMessages();
  }, 60 * 60 * 1000); // 1 hora
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const userId = message.author.id;

  if (!Array.isArray(userMessages[userId])) userMessages[userId] = [];
  userMessages[userId].push({ content: message.content, timestamp: Date.now() });

  if (userMessages[userId].length > 100) userMessages[userId].shift();

  await saveMessagesData();

  const now = Date.now();
  if (cooldowns.has(userId) && now < cooldowns.get(userId)) return;

  const regex = /\btaxa\s+(\d+)\b/i;
  const match = message.content.match(regex);

  if (match) {
    const valorDesejado = parseInt(match[1], 10);

    if (valorDesejado > 2000) {
      await message.reply('O limite máximo por passe é de **2.858!** dog lê os bagui..');
      return;
    }

    const taxa = 0.7;
    const valorBruto = Math.ceil(valorDesejado / taxa);

    await message.reply(`Pra receber **${valorDesejado} Robux** na tua conta, cê precisa por **${valorBruto} no preço do passe jão**`);
  }
});

// Evento de interação para comandos
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (command) {
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error('Erro ao executar comando:', error);
      await interaction.reply({
        content: 'Ocorreu um erro ao tentar executar esse comando.',
        ephemeral: true,
      });
    }
  } else {
    await interaction.reply({
      content: 'Comando não encontrado!',
      ephemeral: true,
    });
  }
});

// Login do bot
client.login(TOKEN);
