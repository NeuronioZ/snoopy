const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, EmbedBuilder } = require('@discordjs/builders');
const { ChannelType, ButtonStyle } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

const factionsPath = path.resolve(__dirname, 'json', 'factions.json');
let factions = {};

const loadFactions = async () => {
  try {
    const data = await fs.readFile(factionsPath, 'utf-8');
    factions = JSON.parse(data) || {};
  } catch (error) {
    console.error('Erro ao carregar as facções:', error);
  }
};

const saveFactions = async () => {
  try {
    await fs.writeFile(factionsPath, JSON.stringify(factions, null, 2));
    console.log('Facções salvas com sucesso!');
  } catch (error) {
    console.error('Erro ao salvar as facções:', error);
  }
};

const createActionRow = () => {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('accept_request')
      .setLabel('Aceitar')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('decline_request')
      .setLabel('Recusar')
      .setStyle(ButtonStyle.Danger)
  );
};

const createEmbed = (title, description, color = 0x0099ff) => {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('entrarfac')
    .setDescription('Entre em uma facção existente!')
    .addStringOption(option =>
      option.setName('nome').setDescription('Nome da facção').setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const nomeFacao = interaction.options.getString('nome');

    await loadFactions();

    const faccao = Object.values(factions).find(f => f.nome === nomeFacao);

    if (!faccao) {
      return interaction.reply({
        content: 'Essa facção não existe!',
        ephemeral: true
      });
    }

    // Verificar se o usuário já é membro de alguma facção
    const existingFaction = Object.values(factions).find(f => f.membros.includes(userId));
    if (existingFaction) {
      return interaction.reply({
        content: 'Você já é membro de uma facção. Para entrar em outra, saia da facção atual primeiro.',
        ephemeral: true
      });
    }

    if (faccao.membros.includes(userId)) {
      return interaction.reply({
        content: 'Você já é membro dessa facção!',
        ephemeral: true
      });
    }

    if (faccao.lider === userId) {
      return interaction.reply({
        content: 'Você não pode entrar na sua própria facção!',
        ephemeral: true
      });
    }

    if (faccao.membros.length >= 15) {
      return interaction.reply({
        content: 'Esta facção já atingiu o limite de 15 membros!',
        ephemeral: true
      });
    }

    const canalPedidos = interaction.guild.channels.cache.get('1324577740539560018');
    if (!canalPedidos || canalPedidos.type !== ChannelType.GuildText) {
      return interaction.reply({
        content: 'O canal de pedidos de facção não foi encontrado!',
        ephemeral: true
      });
    }

    let message;
    try {
      message = await canalPedidos.send({
        content: `<@${faccao.lider}>, ${interaction.user.tag} deseja entrar na facção **${faccao.nome}**.`,
        components: [createActionRow()]
      });
    } catch (err) {
      console.error('Erro ao enviar a mensagem:', err);
      return interaction.reply({
        content: 'Houve um erro ao tentar enviar seu pedido para o líder da facção.',
        ephemeral: true
      });
    }

    interaction.reply({
      content: `Seu pedido foi enviado para o líder da facção **${faccao.nome}**. Aguarde a resposta!`,
      ephemeral: true
    });

    const filter = i =>
      ['accept_request', 'decline_request'].includes(i.customId) && i.user.id === faccao.lider;

    const collector = message.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async i => {
      try {
        if (i.customId === 'accept_request') {
          faccao.membros.push(userId);
          await saveFactions();

          await i.update({
            content: `Pedido aprovado! ${interaction.user.tag} agora é membro da facção **${faccao.nome}**.`,
            components: [],
          });

          interaction.user.send({
            content: `Seu pedido para entrar na facção **${faccao.nome}** foi aprovado!`,
          }).catch(() => console.error('Não foi possível enviar mensagem ao usuário.'));
        } else if (i.customId === 'decline_request') {
          await i.update({
            content: `Pedido recusado! ${interaction.user.tag} não foi aceito na facção **${faccao.nome}**.`,
            components: [],
          });

          interaction.user.send({
            content: `Seu pedido para entrar na facção **${faccao.nome}** foi recusado.`,
          }).catch(() => console.error('Não foi possível enviar mensagem ao usuário.'));
        }
      } catch (err) {
        console.error('Erro ao processar a resposta do coletor:', err);
      }
    });

    collector.on('end', async collected => {
      if (collected.size === 0) {
        try {
          // Verifica se a mensagem ainda existe antes de tentar editá-la
          const updatedMessage = await message.fetch();
          if (updatedMessage) {
            updatedMessage.edit({
              content: `O pedido de ${interaction.user.tag} para entrar na facção **${faccao.nome}** expirou.`,
              components: [],
            }).catch(console.error);
          }
        } catch (err) {
          console.error('Erro ao editar a mensagem após o fim do coletor:', err);
        }
      }
    });

    // Lógica para quando alguém não for o líder tentar aceitar a solicitação
    const wrongUserFilter = i => ['accept_request', 'decline_request'].includes(i.customId) && i.user.id !== faccao.lider;
    const wrongUserCollector = message.createMessageComponentCollector({ filter: wrongUserFilter, time: 60000 });

    wrongUserCollector.on('collect', async i => {
      await i.reply({
        content: 'Você não tem permissão para aceitar ou recusar este pedido, apenas o líder da facção pode fazer isso.',
        ephemeral: true,
      });
    });
  },
};
