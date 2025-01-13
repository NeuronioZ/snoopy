const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

const userPointsPath = path.resolve(__dirname, 'json', 'userPoints.json');
const cooldownsPath = path.resolve(__dirname, 'json', 'cooldowns.json');

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

const categories = {
  bot: {
    title: '😉 Sobre o Bot',
    description:
      "<:white_dash:1323871271297089627> **Criador:** **Felipe**\n" +
      "<:white_dash:1323871271297089627> Este bot foi criado para trazer diversão e interatividade ao servidor! Ele possui:\n\n" +
      "<:white_star:1323871287625383956> Um sistema de pontos.\n" +
      "<:white_star:1323871287625383956> Loja de prêmios.\n" +
      "<:white_star:1323871287625383956> Apostas e muitos comandos diferentes para diversão!\n",
  },
  ganhar_pontos: {
    title: '❤️ Como Ganhar Pontos',
    description:
      "<:white_dash:1323871271297089627> **Evento:** Preste atenção no Chat geral que Staffs podem lançar eventos lá!\n\n" +
      "<:white_dash:1323871271297089627> **Resgate:** Use o comando `/resgatar` a cada **5 horas** para ganhar de **5 a 50 pontos** aleatórios.\n\n" +
      "<:white_dash:1323871271297089627> **Roubo:** Se tiver coragem, use /roubar para tentar roubar uma pessoa. Mas cuidado com as consequências!",
  },
  loja: {
    title: '🏪 Loja de Prêmios',
    description:
      "<:white_dot:1323871280021110835> Troque seus pontos por prêmios incríveis usando `/loja`.\n\n" +
      "<:white_dot:1323871280021110835> Confira o que está disponível e compre facilmente.\n\n" +
      "<:white_dot:1323871280021110835> Veja seu histórico de compras com `/historico`.",
  },
  comandos: {
    title: '💢 Comandos Disponíveis',
    description:
      "<:white_star:1323871287625383956> **`/pix`** - Envie pontos para outro usuário.\n\n" +
      "<:white_star:1323871287625383956> **`/dominar`** - Domine um território para sua facção!\n\n" +
      "<:white_star:1323871287625383956> **`/aposta`** - Aposte pontos com outro usuário.\n\n" +
      "<:white_star:1323871287625383956> **`/foguetinho`** - O clássico foguetinho! Comando de aposta!\n\n" +
      "<:white_star:1323871287625383956> **`/blackjack`** - Sinta-se em um cassino jogando BlackJack 21!\n\n" +
      "<:white_star:1323871287625383956> **`/roubar`** - Roube alguém!\n\n" +
      "<:white_star:1323871287625383956> **`/mines`** - Tente a sorte jogando mines!\n\n" +
      "<:white_star:1323871287625383956> **`/roubos`** - Veja quem te roubou!\n\n" +
      "<:white_star:1323871287625383956> **`/loja`** - Veja a loja de pontos!\n\n" +
      "<:white_star:1323871287625383956> **`/faccao`** - Cria uma faccao por 300 pontos!\n\n" +
      "<:white_star:1323871287625383956> **`/faccoes`** - Mostra o placar de facções!\n\n" +
      "<:white_star:1323871287625383956> **`/sairfac`** - Sai da facção atual!\n\n" +
      "<:white_star:1323871287625383956> **`/entrarfac`** - Peça para entrar em uma facção!\n\n" +
      "<:white_star:1323871287625383956> **`/infofac`** - Veja as informações de uma facção!\n\n" +
      "<:white_star:1323871287625383956> **`/configfac`** - Se você for dono de facção, você pode administrar ela!\n\n" +
      "<:white_star:1323871287625383956> **`/pontos`** - Veja o **Top 10** usuários com mais pontos.\n\n" +
      "<:white_star:1323871287625383956> **`/historico`** - Confira suas compras realizadas na loja.\n\n" +
      "<:white_star:1323871287625383956> **`/stats`** - Veja suas estatísticas aqui!\n\n" +
      "<:white_star:1323871287625383956> **`/resgatar`** - Resgate pontos a cada 5 horas.\n\n",
  },
  eventos: {
    title: '✨ Eventos Temáticos',
    description:
      "<:white_dash:1323871271297089627> O bot se adapta a eventos ao longo do ano, como **Natal**, usando decorações especiais, reações festivas, e um clima temático no servidor!",
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sobre')
    .setDescription('Saiba tudo sobre o bot e seus comandos!'),

  async execute(interaction) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('sobre_menu')
      .setPlaceholder('📜 Escolha uma categoria para saber mais')
      .addOptions(
        Object.entries(categories).map(([key, value]) => ({
          label: value.title.replace(/🎄|🎅|🎁|🛍️|📜|❄️/, '').trim(),
          description: `Saiba mais sobre ${value.title.toLowerCase()}.`,
          value: key,
        }))
      );

    const row = new ActionRowBuilder().addComponents(menu);

    const initialEmbed = new EmbedBuilder()
      .setTitle('<:snoopy_coffee:1323869950775132180> Sobre o Bot')
      .setDescription('<:white_dot:1323871280021110835> Selecione uma categoria no menu abaixo para explorar cada funcionalidade do bot!')
      .setColor('#ffffff')
      .setFooter({ text: 'Oie, prazer Snoopy!', iconURL: interaction.user.displayAvatarURL() })
      .setThumbnail('https://example.com/thumbnail.png')
      .setTimestamp();

    const replyMessage = await interaction.reply({
      embeds: [initialEmbed],
      components: [row],
      ephemeral: false,
    });

    const collector = replyMessage.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60000,
    });

    collector.on('collect', async (menuInteraction) => {
      if (menuInteraction.user.id !== interaction.user.id) {
        return menuInteraction.reply({
          content: 'Somente quem usou o comando pode interagir com este menu.',
          ephemeral: true,
        });
      }

      const selected = menuInteraction.values[0];
      const category = categories[selected];

      const categoryEmbed = new EmbedBuilder()
        .setTitle(category.title)
        .setDescription(category.description)
        .setColor('#ffffff')
        .setFooter({ text: 'Snoopy', iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

      try {
        await menuInteraction.update({ embeds: [categoryEmbed], components: [row] });
      } catch (error) {
        console.error('Erro ao atualizar a mensagem:', error);
        return menuInteraction.reply({
          content: '❌ Ocorreu um erro ao tentar mostrar as informações da categoria.',
          ephemeral: true,
        });
      }
    });

    collector.on('end', async () => {
      try {
        await replyMessage.edit({ components: [] });
      } catch (error) {
        console.error('Erro ao remover componentes após o término do coletor:', error);
      }
    });
  },
};
