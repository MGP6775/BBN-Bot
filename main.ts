import { ActivityType, Client, REST, Routes } from 'npm:discord.js'
import { sendBanMessage, sendLeaveMessage, sendPrivateMessage, sendVoice } from './helper.ts';
import { handleInteraction } from "./interactions.ts";

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
                            name: 'escalate',
                            description: 'Escalate a ticket to the next support level'
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

client.on('guildBanAdd', (ban) => sendBanMessage(ban, true))
client.on('guildBanRemove', (ban) => sendBanMessage(ban, false))

client.on('guildMemberRemove', sendLeaveMessage)
client.on('messageCreate', (message) => sendPrivateMessage(message, client))

client.on('voiceStateUpdate', sendVoice);

client.on('interactionCreate', (interaction) => handleInteraction(interaction));

client.login(Deno.env.get("TOKEN")!).then(() => {
    console.log('Logged in');
});