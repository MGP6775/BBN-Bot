import { ActivityType, CategoryChannel, Client, REST, Routes, TextChannel } from 'npm:discord.js'
import { handleShowcaseMessage, sendBanMessage, sendLeaveMessage, sendPrivateMessage, sendVoice } from './helper.ts';
import { handleInteraction } from "./interactions.ts";
import { PartnerManager } from './partner.ts';
import { findUser } from "./db.ts";
import { linksCategoryID } from './const.ts';

const client = new Client({ intents: 3276799 });

client.on("ready", () => {
    console.log(`Logged in as ${client.user!.tag}!`);
    client.user!.setActivity('bbn.music', { type: ActivityType.Listening });

    const rest = new REST().setToken(Deno.env.get("TOKEN")!);

    (async () => {
        try {
            console.log('Started refreshing application (/) commands.');
            // https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-type
            await rest.put(Routes.applicationCommands(client.user!.id), {
                body:
                    [
                        // {
                        //     name: 'setup',
                        //     description: 'Setup the Voice Locker',
                        // },
                        {
                            name: 'verify',
                            description: 'Verify a User',
                        },
                        {
                            name: 'daily',
                            description: 'Claim your daily reward',
                        },
                        {
                            name: 'balance',
                            description: 'See your current balance',
                            options: [
                                {
                                    name: 'user',
                                    description: 'Check the balance of another user',
                                    type: 9,
                                    required: false,
                                }
                            ]
                        },
                        {
                            name: 'addcoins',
                            description: 'Add coins to a user',
                            options: [
                                {
                                    name: 'user',
                                    description: 'The user to add coins to',
                                    type: 9,
                                    required: true,
                                },
                                {
                                    name: 'coins',
                                    description: 'The amount of coins to add',
                                    type: 4,
                                    required: true,
                                }
                            ]
                        },
                        {
                            name: 'removecoins',
                            description: 'Remove coins from a user',
                            options: [
                                {
                                    name: 'user',
                                    description: 'The user to remove coins from',
                                    type: 9,
                                    required: true,
                                },
                                {
                                    name: 'coins',
                                    description: 'The amount of coins to remove',
                                    type: 4,
                                    required: true,
                                }
                            ]
                        },
                        {
                            name: 'escalate',
                            description: 'Escalate a ticket to the next support level'
                        },
                        {
                            name: 'addpartner',
                            description: 'Add a partner to the partner list',
                            options: [
                                {
                                    name: 'user',
                                    description: 'The user to remove coins from',
                                    type: 9,
                                    required: true,
                                },
                                {
                                    name: 'cpu',
                                    description: 'The amount of cpu to add',
                                    type: 4,
                                    required: true,
                                },
                                {
                                    name: 'ram',
                                    description: 'The amount of ram to add',
                                    type: 4,
                                    required: true,
                                },
                                {
                                    name: 'storage',
                                    description: 'The amount of storage to add',
                                    type: 4,
                                    required: true,
                                },
                                {
                                    name: 'slots',
                                    description: 'The amount of slots to add',
                                    type: 4,
                                    required: true,
                                }
                            ]
                        },
                        {
                            name: 'removepartner',
                            description: 'Remove a partner from the partner list',
                            options: [
                                {
                                    name: 'user',
                                    description: 'The user to remove coins from',
                                    type: 9,
                                    required: true,
                                }
                            ]
                        },
                        {
                            name: 'partners',
                            description: 'List all partners'
                        },
                        {
                            name: "servers",
                            description: "List all servers",
                            options: [
                                {
                                    name: 'user',
                                    description: 'The user to list servers from',
                                    type: 9,
                                    required: true,
                                }
                            ]
                        },
                        {
                            name: "deescalate",
                            description: "Deescalate a ticket to the previous support level",
                        },
                        {
                            name: "steam",
                            description: "View Steam Family games",
                            options: [
                                {
                                    name: 'accesstoken',
                                    description: "Access token for Steam. Found at https://store.steampowered.com/pointssummary/ajaxgetasyncconfig",
                                    required: true,
                                    type: 3
                                },
                                {
                                    name: 'webtoken',
                                    description: "Web token for Steam. Found at https://steamcommunity.com/dev/apikey",
                                    type: 3
                                }
                            ]
                        }
                    ]
            });

            console.log('Successfully reloaded application (/) commands.');
        } catch (error) {
            console.error(error);
        }
    })();
});

const partnerManager = new PartnerManager(client);

client.on('inviteCreate', async () => await partnerManager.cacheInvites());
client.on('inviteDelete', async () => await partnerManager.cacheInvites());

client.on('guildMemberAdd', async (member) => await partnerManager.onMember(member, 'join'));

client.on('guildBanAdd', (ban) => sendBanMessage(ban, true))
client.on('guildBanRemove', (ban) => sendBanMessage(ban, false))

client.on('guildMemberRemove', sendLeaveMessage)
client.on('messageCreate', (message) => sendPrivateMessage(message, client))
client.on('messageCreate', (message) => handleShowcaseMessage(message));

client.on('voiceStateUpdate', sendVoice);

client.on('interactionCreate', (interaction) => handleInteraction(interaction));

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (oldMember.premiumSince !== newMember.premiumSince && newMember.premiumSince) {
        const dbuser = await findUser(newMember.id);
        if (dbuser) {
            (await newMember.guild.channels.fetch(Deno.env.get("GENERAL_CHANNEL")!) as TextChannel).send(`<@${newMember.id}> will now get a 10x /daily reward for the duration of their boost!`);
        } else {
            if (newMember.guild.channels.cache.find((channel) => channel.name === `link-${newMember.id}`))
                return;

            const channel = await newMember.guild.channels.create({
                name: `link-${newMember.id}`,
                parent: await newMember.guild.channels.fetch(linksCategoryID) as CategoryChannel,
            });
            await channel.permissionOverwrites.create(newMember, { ViewChannel: true });
            await channel.send({ content: `<@${newMember.id}> Looks like you just boosted the server! Unfortunately, you are not linked to your BBN account yet. Please send your Email address to this channel to link your account. Our Team will respond as soon as possible.`, allowedMentions: { users: [ newMember.id ] } });
        }
    }
})

client.login(Deno.env.get("TOKEN")!).then(() => {
    console.log('Logged in');
    partnerManager.cacheInvites();
});