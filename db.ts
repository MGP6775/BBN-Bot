import { load } from "https://deno.land/std@0.204.0/dotenv/mod.ts";
import { MongoClient, ObjectId } from "https://deno.land/x/mongo@v0.32.0/mod.ts";

await load({
    export: true,
});

export const mongoClient = new MongoClient();

await mongoClient.connect(Deno.env.get("DB_URL")!);

const db = mongoClient.database("one_bbn");

export async function findUser(discordId: string) {
    const user = await db.collection("users").findOne({
        authentication: {
            $elemMatch: {
                id: discordId,
                type: "oauth",
                provider: "discord"
            }
        },
        "profile.verified.email": true
    })

    if (!user) return null;
    return user._id;
}

export async function getCoins(discordId: string) {
    const user = await findUser(discordId);
    if (!user) return null;
    const access = await db.collection("@bbn/hosting/access").findOne({
        owner: user
    });
    if (!access) return null;
    return access.coins;
}

export async function setCoins(discordId: string, coins: number) {
    // check if user exists
    const user = await findUser(discordId);
    if (!user) return null;
    // update user
    return await db.collection("@bbn/hosting/access").updateOne({
        owner: user
    }, {
        $set: {
            coins
        }
    });
}

export async function addCoins(discordId: string, coins: number) {
    // check if user exists
    const user = await findUser(discordId);
    if (!user) return null;
    // update user
    return await db.collection("@bbn/hosting/access").updateOne({
        owner: user
    }, {
        $inc: {
            coins
        }
    });
}

export async function removeCoins(discordId: string, coins: number) {
    // check if user exists
    const user = await findUser(discordId);
    if (!user) return null;
    // update user
    return await db.collection("@bbn/hosting/access").updateOne({
        owner: user
    }, {
        $inc: {
            coins: -coins
        }
    });
}

export async function getLastDaily(discordId: string) {
    // check if user exists
    const user = await findUser(discordId);
    if (!user) return null;
    const access = await db.collection("@bbn/hosting/access").findOne({
        owner: user
    });
    if (!access) return null;
    return access.lastDaily;
}

export async function setLastDaily(discordId: string, lastDaily: number) {
    const user = await findUser(discordId);
    if (!user) return null;
    return await db.collection("@bbn/hosting/access").updateOne({
        owner: user
    }, {
        $set: {
            lastDaily
        }
    });
}

export async function getServerURLs(discordId: string) {
    const user = await findUser(discordId);
    if (!user) return null;
    const servers = await db.collection("@bbn/hosting/servers").find({
        user
    }).toArray();
    return servers.map(server => server.identifier ? `https://panel.bbn.music/server/${server.identifier}` : `https://bbn.music/hosting?path=servers/${server._id}/`);
}

export async function lastLogin(discordId: string) {
    const user = await findUser(discordId);
    if (!user) return null;
    const userevent = await db.collection("user-events").findOne({
        type: "auth",
        userId: user
    }, {
        sort: {
            _id: -1
        }
    });
    if (!userevent) return null;
    const location = await fetch(`https://ipinfo.io/${userevent.ip}/json`).then(res => res.json());
    return [ {
        platform: userevent.source.platform,
        platformVersion: userevent.source.platformVersion,
        legacyUserAgent: userevent.source.legacyUserAgent,
    }, location.bogon ? undefined : `${String.fromCodePoint(...(location.country as string).toUpperCase().split('').map(char => 127397 + char.charCodeAt(0)))} ${location.city} (${location.timezone})`, location.timezone ];
}

export async function saveTranscript(transcript: any) {
    await db.collection("@bbn/bot/transcripts").insertOne(transcript);
}

export async function addPartner(member: ObjectId, cpu: number, memory: number, disk: number, slots: number, invite: string) {
    await db.collection("@bbn/bot/partners").insertOne({
        owner: member,
        cpu,
        memory,
        disk,
        slots,
        invite,
        lastinvite: Date.now()
    });
    await db.collection("@bbn/hosting/access").updateOne({
        owner: member
    }, {
        $inc: {
            "limits.memory": memory,
            "limits.disk": disk,
            "limits.cpu": cpu,
            "limits.slots": slots
        }
    });
}

export async function removePartner(member: ObjectId) {
    const partner = await db.collection("@bbn/bot/partners").findOne({
        owner: member
    });
    if (!partner) return null;
    db.collection("@bbn/hosting/access").updateOne({
        owner: member
    }, {
        $inc: {
            "limits.memory": -partner.memory,
            "limits.disk": -partner.disk,
            "limits.cpu": -partner.cpu,
            "limits.slots": -partner.slots

        }
    });
    db.collection("@bbn/bot/partners").deleteOne({
        owner: member
    });
}

export function getPartnerFromInvite(invite: string) {
    return db.collection("@bbn/bot/partners").findOne({
        invite
    });
}
export function getMemberFromBBNId(bbnid: ObjectId) {
    return db.collection("users").findOne({
        _id: bbnid
    }).then(user => user?.authentication.find((auth: any) => auth.type === "oauth" && auth.provider === "discord")?.id);
}

export function updateLastInvite(member: ObjectId) {
    db.collection("@bbn/bot/partners").updateOne({
        owner: member
    }, {
        $set: {
            lastinvite: Date.now()
        }
    })
}

export function getPartners() {
    return db.collection("@bbn/bot/partners").find().toArray();
}