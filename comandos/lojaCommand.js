const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

const userPointsPath = path.resolve(__dirname, 'json', 'userPoints.json');
const tokensFilePath = path.resolve(__dirname, 'json', 'tokens.json');
const userHistoryPath = path.resolve(__dirname, 'json', 'purchaseHistory.json');

const loadJsonFile = async (filePath, defaultValue = {}) => {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Erro ao carregar o arquivo ${filePath}:`, error);
    return defaultValue;
  }
};

const saveJsonFile = async (filePath, data) => {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Erro ao salvar o arquivo ${filePath}:`, error);
  }
};

const generateUniqueToken = () => `ROBUX-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

const addPurchaseToHistory = async (userId, productName, price) => {
  try {
    const userHistory = await loadJsonFile(userHistoryPath);
    if (!userHistory[userId]) userHistory[userId] = [];
    userHistory[userId].push({
      product: productName,
      date: new Date().toLocaleString(),
      price: price,
    });
    await saveJsonFile(userHistoryPath, userHistory);
  } catch (error) {
    console.error('Erro ao adicionar compra ao histórico:', error);
  }
};

const storeItems = [
  { name: '100 Robux', price: 550, description: '100 Robux taxados.', isRobux: true },
  { name: 'Cargo Bloxy Cola', price: 950, description: 'Cargo que dobra seus pontos', isRole: true, roleId: '1322606733801033779' },
  { name: '300 Robux', price: 1200, description: 'Compre 300 Robux!', isRobux: true },
  { name: 'Cargo Anjo', price: 3500, description: 'Cargo acima de Cliente!', isRole: true, roleId: '1323461314982711296' },
  { name: 'Cargo Demon', price: 12000, description: 'Cargo acima de Anjo!', isRole: true, roleId: '1325980053368082452' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loja')
    .setDescription('Veja os itens disponíveis para comprar com seus pontos'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const userPoints = await loadJsonFile(userPointsPath);
    const tokens = await loadJsonFile(tokensFilePath);
    const userHistory = await loadJsonFile(userHistoryPath);
    const userPontos = userPoints[userId] || 0;
    const userPurchases = userHistory[userId] || [];

    const options = storeItems.map((item, index) => {
      const alreadyPurchased = userPurchases.some((purchase) => purchase.product === item.name);
      return {
        label: `${item.name} - ${item.price} pontos`,
        value: `${index}`,
        description: alreadyPurchased ? 'Já comprado!' : item.description,
        disabled: alreadyPurchased,
      };
    });

    const embed = new EmbedBuilder()
      .setColor('#FFFFFF')
      .setTitle('Lojinha Snoopy <:snoopy_snooze:1323869958735921183>')
      .setDescription(`<:white_dot:1323871280021110835> Você tem **${userPontos}** pontos.\nEscolha o item que deseja comprar:`)
      .setImage('https://i.ibb.co/jrk5xyH/f033b9ef0ac9c207e43eff37bc28c648.png')
      .setFooter({ text: 'Use /sobre se tiver dúvidas!', iconURL: 'https://i.ibb.co/2kCbXx7/snoopy.png' })
      .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('selectItem')
      .setPlaceholder('Selecione um item')
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });

    const filter = (selectInteraction) => selectInteraction.user.id === userId;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async (selectInteraction) => {
      try {
        if (selectInteraction.customId === 'selectItem') {
          const itemIndex = parseInt(selectInteraction.values[0]);
          const selectedItem = storeItems[itemIndex];
          const alreadyPurchased = userPurchases.some((purchase) => purchase.product === selectedItem.name);

          if (alreadyPurchased) {
            return selectInteraction.reply({
              content: `Você já comprou o produto **${selectedItem.name}** e não pode comprá-lo novamente.`,
              ephemeral: true,
            });
          }

          // Verificar se o usuário já tem o cargo
          if (selectedItem.isRole) {
            const member = await interaction.guild.members.fetch(userId);
            const hasRole = member.roles.cache.has(selectedItem.roleId);

            if (hasRole) {
              return selectInteraction.reply({
                content: `Você já possui o cargo **${selectedItem.name}**.`,
                ephemeral: true,
              });
            }
          }

          if (userPontos < selectedItem.price) {
            return selectInteraction.reply({
              content: 'Você não tem pontos suficientes para comprar este item.',
              ephemeral: true,
            });
          }

          userPoints[userId] = userPontos - selectedItem.price;
          await saveJsonFile(userPointsPath, userPoints);
          addPurchaseToHistory(userId, selectedItem.name, selectedItem.price);

          if (selectedItem.isRobux) {
            const token = generateUniqueToken();
            tokens[token] = { userId, product: selectedItem.name, used: false };
            await saveJsonFile(tokensFilePath, tokens);

            await selectInteraction.reply({
              content: `🎉 Você comprou **${selectedItem.name}** por **${selectedItem.price} pontos**!\nSeu token: \`${token}\`\nUse-o para resgatar seus Robux criando um ticket.`,
              ephemeral: true,
            });
          } else if (selectedItem.isRole) {
            const role = interaction.guild.roles.cache.get(selectedItem.roleId);
            if (!role) {
              return selectInteraction.reply({
                content: 'Erro: Cargo não encontrado.',
                ephemeral: true,
              });
            }
            const member = await interaction.guild.members.fetch(userId);
            await member.roles.add(role);
            await selectInteraction.reply({
              content: `🎉 Você comprou o cargo **${selectedItem.name}**!`,
              ephemeral: true,
            });
          } else {
            await selectInteraction.reply({
              content: `🎉 Você comprou **${selectedItem.name}**!`,
              ephemeral: true,
            });
          }
        }
      } catch (error) {
        console.error('Erro ao processar a compra:', error);
        if (selectInteraction.deferred || selectInteraction.replied) {
          return; // Se a interação já foi respondida ou adiada, não tente responder novamente
        }
        await selectInteraction.reply({
          content: 'Ocorreu um erro ao processar sua compra. Tente novamente mais tarde.',
          ephemeral: true,
        });
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time') {
        row.components[0].setDisabled(true);
        await interaction.editReply({
          content: '⏰ O tempo para a compra acabou. Tente novamente mais tarde.',
          components: [row],
        });
      }
    });

    collector.on('error', (error) => {
      console.error('Erro no coletor:', error);
    });
  },
};
