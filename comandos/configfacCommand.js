const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

const factionsPath = path.resolve(__dirname, 'json', 'factions.json');
let factions = {};

const loadFactions = async () => {
  try {
    if (await fileExists(factionsPath)) {
      const data = await fs.readFile(factionsPath, 'utf-8');
      factions = data ? JSON.parse(data) : {};
    } else {
      factions = {};
    }
  } catch (error) {
    console.error('Erro ao carregar os dados de facções:', error);
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

const saveFactionsData = async () => {
  try {
    await fs.writeFile(factionsPath, JSON.stringify(factions, null, 2));
  } catch (error) {
    console.error('Erro ao salvar os dados de facções:', error);
  }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('configfac')
    .setDescription('Configuração da sua facção')
    .addIntegerOption(option =>
      option
        .setName('remover')
        .setDescription('Número do membro para remover')
        .setRequired(false)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;

    await loadFactions();
    const faccao = Object.values(factions).find(f => f.lider === userId);

    if (!faccao) {
      return interaction.reply({ content: 'Você não é o líder de nenhuma facção!', ephemeral: true });
    }

    const removerNumero = interaction.options.getInteger('remover');
    if (removerNumero) {
      const membroARemover = faccao.membros[removerNumero - 1];

      if (!membroARemover) {
        return interaction.reply({ content: 'Número inválido! Escolha um número válido da lista.', ephemeral: true });
      }

      if (membroARemover === userId) {
        return interaction.reply({ content: 'Você não pode se remover da sua própria facção!', ephemeral: true });
      }

      faccao.membros = faccao.membros.filter(id => id !== membroARemover);
      await saveFactionsData();

      return interaction.reply({ content: `Membro <@${membroARemover}> removido da facção ${faccao.nome}.`, ephemeral: true });
    }

    const membrosNumerados = faccao.membros
      .map((id, index) => `${index + 1} - <@${id}>`)
      .join('\n') || 'Nenhum membro.';

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(`Configuração da facção ${faccao.nome}`)
      .setDescription(faccao.descricao || 'Sem descrição disponível.')
      .addFields({ name: 'Membros', value: membrosNumerados })
      .setFooter({ text: `Líder: <@${faccao.lider}>` })
      .setThumbnail(faccao.imagem);

    return interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  },
};
