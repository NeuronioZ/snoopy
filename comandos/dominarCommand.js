const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

const factionsPath = path.resolve(__dirname, 'json', 'factions.json');
const dominatePath = path.resolve(__dirname, 'json', 'dominar.json');
const userPointsPath = path.resolve(__dirname, 'json', 'userPoints.json');

// Áreas fixas
const FIXED_AREAS = {
  sao_paulo: { faction: null, factionLeader: null, lastAttempt: null },
  parana: { faction: null, factionLeader: null, lastAttempt: null },
  belo_horizonte: { faction: null, factionLeader: null, lastAttempt: null },
  santa_catarina: { faction: null, factionLeader: null, lastAttempt: null }
};

// Função para carregar dados do arquivo JSON
const loadData = async (filePath, defaultData = {}) => {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return data ? JSON.parse(data) : defaultData;
  } catch (error) {
    if (error.code === 'ENOENT') {
      await saveData(filePath, defaultData); // Cria o arquivo vazio com dados padrão
      return defaultData;
    }
    console.error(`Erro ao carregar dados de ${filePath}:`, error);
    return defaultData;
  }
};

// Função para salvar dados no arquivo JSON
const saveData = async (filePath, data) => {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Erro ao salvar dados de ${filePath}:`, error);
  }
};

// Função para normalizar os nomes das áreas
const normalizeAreaName = (area) => {
  return area.toLowerCase().replace(/ /g, '_'); // Substitui espaços por "_" e converte para minúsculas
};

// Configurar áreas fixas
const initializeAreas = async () => {
  let areas = await loadData(dominatePath, FIXED_AREAS);

  // Garante que todas as áreas fixas estão presentes
  areas = { ...FIXED_AREAS, ...areas };
  await saveData(dominatePath, areas);
  return areas;
};

// Função para distribuir pontos periodicamente
const distributePoints = async () => {
  const areas = await loadData(dominatePath);
  const userPoints = await loadData(userPointsPath);
  const factions = await loadData(factionsPath);

  for (const area in areas) {
    const areaData = areas[area];
    if (areaData.faction) {
      const faction = Object.values(factions).find(f => f.nome === areaData.faction);
      if (faction) {
        faction.membros.forEach(memberId => {
          userPoints[memberId] = (userPoints[memberId] || 0) + 1; // Adiciona 1 ponto
        });
      }
    }
  }

  await saveData(userPointsPath, userPoints);
  console.log('Pontos distribuídos com sucesso!');
};

// Configura o intervalo de 10 minutos para distribuir pontos
setInterval(distributePoints, 10 * 60 * 1000); // 10 minutos

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dominar')
    .setDescription('Tente dominar uma área para sua facção.')
    .addStringOption(option =>
      option.setName('area')
        .setDescription('Escolha a área para dominar.')
        .setRequired(true)
        .addChoices(
          { name: 'São Paulo', value: 'sao_paulo' },
          { name: 'Paraná', value: 'parana' },
          { name: 'Belo Horizonte', value: 'belo_horizonte' },
          { name: 'Santa Catarina', value: 'santa_catarina' }
        )
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const area = normalizeAreaName(interaction.options.getString('area'));

    // Carregar dados
    const factions = await loadData(factionsPath);
    let areas = await initializeAreas();

    // Verificar se o usuário pertence a uma facção
    const userFaction = Object.values(factions).find(faction => faction.membros.includes(userId));
    if (!userFaction) {
      return interaction.reply({ content: 'Você não faz parte de uma facção!', ephemeral: true });
    }

    const now = Date.now();
    const successChance = Math.random() <= 0.75; // 75% de chance de sucesso

    // Verificar se já passou 1 hora desde a última tentativa de dominar a área
    const areaData = areas[area];
    if (areaData.lastAttempt && (now - areaData.lastAttempt) < 3600000) { // 1 hora
      const timeLeft = Math.ceil((3600000 - (now - areaData.lastAttempt)) / 60000); // Tempo restante em minutos
      return interaction.reply({
        content: `❌ Você deve esperar **${timeLeft} minutos** antes de tentar dominar a área **${area.replace(/_/g, ' ')}** novamente.`,
        ephemeral: true
      });
    }

    if (successChance) {
      if (areaData.faction && areaData.faction !== userFaction.nome) {
        const oldFactionName = areaData.faction;
        const oldFaction = Object.values(factions).find(f => f.nome === oldFactionName);

        if (oldFaction) {
          const oldFactionLeader = oldFaction.lider;

          const channel = interaction.guild.channels.cache.get(interaction.channelId);
          channel.send(`⚠️ <@${oldFactionLeader}>, sua facção "${oldFactionName}" perdeu a área **${area.replace(/_/g, ' ')}** para a facção "${userFaction.nome}"!`);
        }
      }

      // Atualizar domínio da área
      areas[area] = {
        faction: userFaction.nome,
        factionLeader: userFaction.lider,
        lastAttempt: now
      };

      await saveData(dominatePath, areas);

      return interaction.reply({
        content: `🎉 Sua facção "${userFaction.nome}" dominou a área **${area.replace(/_/g, ' ')}**!`,
        ephemeral: false
      });
    } else {
      areas[area].lastAttempt = now;
      await saveData(dominatePath, areas);

      return interaction.reply({
        content: `❌ Sua facção falhou em dominar a área **${area.replace(/_/g, ' ')}**. Tente novamente depois de 1 hora!`,
        ephemeral: false
      });
    }
  }
};
