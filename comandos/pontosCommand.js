const fs = require('fs').promises;
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const COLETOR_TEMPO = 60000;

// Caminho do arquivo JSON local
const userPointsPath = path.join(__dirname, 'json', 'userPoints.json');

// Função para garantir que o arquivo JSON exista
const ensureFileExists = async (filePath) => {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, JSON.stringify({}, null, 2));
  }
};

// Carregar dados do arquivo JSON
const loadData = async (filePath) => {
  try {
    await ensureFileExists(filePath);
    const data = await fs.readFile(filePath, 'utf8');
    const parsedData = JSON.parse(data);

    // Converter todos os pontos para inteiros
    for (const key in parsedData) {
      parsedData[key] = Math.floor(parsedData[key]); // Garante que os valores sejam inteiros
    }

    return parsedData;
  } catch (error) {
    console.error('Erro ao carregar o arquivo JSON:', error);
    return {};
  }
};

// Criar embed para exibir ranking
const createEmbed = (data, userId, userPoints, page, pageSize) => {
  const start = page * pageSize;
  const end = start + pageSize;

  const excludedUserIds = [
    '155520075657510912', '627116319074025473', '518196865121124353', 
    '926550212271554561', '526447294007214080', '1252411293386932264', 
    '381562314211721226', '587753735661551650', '480551461651218442'
  ];

  const users = Object.entries(data)
    .filter(([id]) => id !== '1312620873743863949')
    .filter(([id]) => !excludedUserIds.includes(id))
    .sort(([, a], [, b]) => b - a);

  const topList = users.slice(start, end).map(
    ([userId, points], index) => `**${start + index + 1}. <@${userId}>** - ${points.toLocaleString('pt-BR')} Pontos`
  ).join('\n');

  const userIndex = users.findIndex(([id]) => id === userId);
  const userEmbed = userIndex === -1
    ? `Você está fora do top 10, mas tem **${userPoints.toLocaleString('pt-BR')} Pontos**. Continue jogando!`
    : `Você está na posição **${userIndex + 1}** com **${userPoints.toLocaleString('pt-BR')} Pontos**.`;

  const topDescription = topList.length ? `${userEmbed}\n\n${topList}` : 'Nenhum dado de pontos disponível.';

  return new EmbedBuilder()
    .setColor(0xffffff)
    .setTitle('<a:exclamation_white:1323871260274593843> Ranking de Pontos')
    .setDescription(topDescription)
    .setFooter({ text: `Página ${page + 1}` })
    .setTimestamp();
};

// Atualizar os botões de navegação
const updateNavigationRow = (page, data, pageSize) => {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('prev_page')
      .setLabel('⬅️ Anterior')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId('next_page')
      .setLabel('➡️ Próxima')
      .setStyle(ButtonStyle.Primary)
      .setDisabled((page + 1) * pageSize >= Object.keys(data).length)
  );
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pontos')
    .setDescription('Mostra o ranking de pontos no servidor'),

  async execute(interaction) {
    try {
      const userId = interaction.user.id;

      // Carregar dados do arquivo JSON
      const data = await loadData(userPointsPath);
      const userPoints = data[userId] || 0;

      if (Object.keys(data).length === 0) {
        return interaction.reply({ content: '❌ Nenhum dado de pontos disponível.', ephemeral: true });
      }

      const pageSize = 10;
      let page = 0;

      const embed = createEmbed(data, userId, userPoints, page, pageSize);
      const row = updateNavigationRow(page, data, pageSize);

      const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

      const collector = message.createMessageComponentCollector({ time: COLETOR_TEMPO });

      collector.on('collect', async (i) => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({ content: '❌ Apenas quem usou o comando pode interagir com os botões.', ephemeral: true });
        }

        if (i.customId === 'prev_page' && page > 0) {
          page--;
        } else if (i.customId === 'next_page' && (page + 1) * pageSize < Object.keys(data).length) {
          page++;
        }

        const newEmbed = createEmbed(data, userId, userPoints, page, pageSize);
        const newRow = updateNavigationRow(page, data, pageSize);

        await i.update({ embeds: [newEmbed], components: [newRow] });
      });

      collector.on('end', async () => {
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('prev_page')
            .setLabel('⬅️ Anterior')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('next_page')
            .setLabel('➡️ Próxima')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true)
        );

        const embedWithWarning = EmbedBuilder.from(embed)
          .setFooter({ text: 'O tempo de interação terminou.' });

        try {
          await message.edit({ embeds: [embedWithWarning], components: [disabledRow] });
        } catch (error) {
          console.error('Erro ao desativar os botões:', error);
        }
      });

      collector.on('error', (error) => {
        console.error('Erro na interação:', error);
      });
    } catch (error) {
      console.error('Erro ao executar o comando:', error);
      await interaction.reply({
        content: '❌ Houve um erro ao buscar os pontos.',
        ephemeral: true,
      });
    }
  },
};
