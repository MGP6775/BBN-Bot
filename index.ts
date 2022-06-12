import { Client, Intents } from 'discord.js'
import * as config from './config.json'

import { sendBanMessage, handleRules, sendJoinMessage, sendLeaveMessage, sendPrivateMessage } from './helper';

const allIntents = new Intents(32767);
const client = new Client({ intents: allIntents, partials: ['CHANNEL'] });

client.on('ready', () => {
    console.log(`Logged in as ${client.user!.tag}!`);
});

client.on('guildBanAdd', (ban) => sendBanMessage(ban, true))
client.on('guildBanRemove', (ban) => sendBanMessage(ban, false))

client.on('guildMemberAdd', sendJoinMessage);
client.on('guildMemberUpdate', handleRules)
client.on('guildMemberRemove', sendLeaveMessage)

client.on('messageCreate', (message) => sendPrivateMessage(message, client))

client.login(config.token);