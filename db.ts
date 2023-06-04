import { Collection, Db, MongoClient } from "mongodb";

export default class DB {
    client: MongoClient;
    db: Db;
    usercollection: Collection;
    accesscollection: Collection;
    servercollection: Collection;
    usereventcollection: Collection;
    constructor(url: string) {
        this.client = new MongoClient(url);
        this.db = this.client.db("one_bbn");
        this.usercollection = this.db.collection("users");
        this.accesscollection = this.db.collection("@bbn/hosting/access");
        this.servercollection = this.db.collection("@bbn/hosting/servers");
        this.usereventcollection = this.db.collection("user-events");
    }

    async connect() {
        await this.client.connect();
    }

    async finduser(discordid: string) {
        const user = await this.usercollection.findOne({
            authentication: {
                $elemMatch: {
                    id: discordid,
                    type: "oauth",
                    provider: "discord"
                }
            },
            "profile.verified.email": true
        })

        if (!user) return null;
        return user._id;
    }

    async getCoins(discordid: string) {
        const user = await this.finduser(discordid);
        if (!user) return null;
        const access = await this.accesscollection.findOne({
            owner: user
        });
        if (!access) return null;
        return access.coins;
    }

    async setCoins(discordid: string, coins: number) {
        // check if user exists
        const user = await this.finduser(discordid);
        if (!user) return null;
        // update user
        return await this.accesscollection.updateOne({
            owner: user
        }, {
            $set: {
                coins: coins
            }
        });
    }

    async addCoins(discordid: string, coins: number) {
        // check if user exists
        const user = await this.finduser(discordid);
        if (!user) return null;
        // update user
        return await this.accesscollection.updateOne({
            owner: user
        }, {
            $inc: {
                coins: coins
            }
        });
    }

    async removeCoins(discordid: string, coins: number) {
        // check if user exists
        const user = await this.finduser(discordid);
        if (!user) return null;
        // update user
        return await this.accesscollection.updateOne({
            owner: user
        }, {
            $inc: {
                coins: -coins
            }
        });
    }

    async getLastDaily(discordid: string) {
        // check if user exists
        const user = await this.finduser(discordid);
        if (!user) return null;
        const access = await this.accesscollection.findOne({
            owner: user
        });
        if (!access) return null;
        return access.lastDaily;
    }

    async setLastDaily(discordid: string, lastDaily: number) {
        const user = await this.finduser(discordid);
        if (!user) return null;
        return await this.accesscollection.updateOne({
            owner: user
        }, {
            $set: {
                lastDaily: lastDaily
            }
        });
    }

    async getServerURLs(discordid: string) {
        const user = await this.finduser(discordid);
        if (!user) return null;
        const servers = await this.servercollection.find({
            user: user
        }).toArray();
        return servers.map(server => `https://panel.bbn.one/server/${server.identifier}`);
    }

    async lastLogin(discordid: string) {
        const user = await this.finduser(discordid);
        if (!user) return null;
        const userevent = await this.usereventcollection.findOne({
            userId: user
        }, {
            sort: {
                _id: -1
            }
        });
        if (!userevent) return null;
        const location = await fetch(`https://ipinfo.io/${userevent.ip}/json`).then(res => res.json());
        return [{
            platform: userevent.source.platform,
            platformVersion: userevent.source.platformVersion,
            legacyUserAgent: userevent.source.legacyUserAgent,
        }, String.fromCodePoint(...(location.country as string).toUpperCase().split('').map(char =>  127397 + char.charCodeAt(0))) + " " + location.city + " (" + location.timezone + ")", location.timezone];
    }
}
