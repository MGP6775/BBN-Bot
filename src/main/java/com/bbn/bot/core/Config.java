package com.bbn.bot.core;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

public class Config {

    private Path file;
    private JSONObject config;

    public Config(String path) {
        this.file = Paths.get(path);
    }

    public void load() {
        try {
            config = new JSONObject(new String(Files.readAllBytes(file)));
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    public String getToken() {
        return config.getString("Token");
    }

    public String getGitHubToken() {
        return config.getString("GitHubToken");
    }

    public JSONArray getBotIDs() {
        return config.getJSONArray("BotIDs");
    }

    public String getAPIKey() {
        return config.getString("APIKey");
    }

    public String getPageID() {
        return config.getString("PageID");
    }

    public String getDCGID() {
        return config.getString("DCG-ID");
    }

    public String getDCRID() {
        return config.getString("DCR-ID");
    }

    public String getSMTPServer() {
        return config.getString("SMTP-Server");
    }

    public String getEMail() {
        return config.getString("E-Mail");
    }

    public String getUsername() {
        return config.getString("Username");
    }

    public String getPassword() {
        return config.getString("Password");
    }

}
