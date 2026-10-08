package com.wildgrid.game;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.SystemClock;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONObject;

@CapacitorPlugin(name = "WildgridPlayerId")
public class PlayerIdPlugin extends Plugin {
    private static final String PREFERENCES = "wildgrid-player-id-v1";
    private static final int TIMEOUT_MS = 8000;
    private static final int MAX_RESPONSE_BYTES = 1024;

    @PluginMethod
    public void resolve(PluginCall call) {
        execute(() -> {
            try {
                SharedPreferences preferences = getContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
                String playerId = preferences.getString("playerId", null);
                if (!isValidPlayerId(playerId)) {
                    URL url = new URL(call.getString("apiUrl", ""));
                    if (!"https".equals(url.getProtocol()) || !"179.255.156.84".equals(url.getHost())
                        || !"/api/player-id".equals(url.getPath()) || url.getUserInfo() != null
                        || url.getQuery() != null || url.getRef() != null
                        || (url.getPort() != -1 && url.getPort() != 443)) {
                        throw new IOException("Invalid endpoint");
                    }
                    String androidId = Settings.Secure.getString(getContext().getContentResolver(), Settings.Secure.ANDROID_ID);
                    if (androidId == null || androidId.isEmpty()) {
                        throw new IOException("Device identity unavailable");
                    }
                    byte[] digest = MessageDigest.getInstance("SHA-256").digest(
                        (PREFERENCES + ":" + androidId).getBytes(StandardCharsets.UTF_8));
                    StringBuilder hash = new StringBuilder(64);
                    for (byte value : digest) {
                        hash.append(Character.forDigit((value & 0xff) >>> 4, 16));
                        hash.append(Character.forDigit(value & 0x0f, 16));
                    }
                    playerId = requestPlayerId(url, hash.toString());
                    if (!isValidPlayerId(playerId) || !preferences.edit().putString("playerId", playerId).commit()) {
                        throw new IOException("Player identity unavailable");
                    }
                }
                JSObject result = new JSObject();
                result.put("playerId", playerId);
                call.resolve(result);
            } catch (Exception error) {
                call.reject("无法获取玩家 ID，请联网后重试");
            }
        });
    }

    private String requestPlayerId(URL url, String deviceHash) throws Exception {
        long deadline = SystemClock.elapsedRealtime() + TIMEOUT_MS;
        HttpsURLConnection connection = (HttpsURLConnection) url.openConnection();
        try {
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(TIMEOUT_MS);
            connection.setReadTimeout(TIMEOUT_MS);
            connection.setRequestMethod("POST");
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            connection.setDoOutput(true);
            byte[] body = new JSONObject().put("deviceHash", deviceHash).toString().getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(body.length);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(body);
            }
            connection.setReadTimeout(remainingTimeout(deadline));
            if (connection.getResponseCode() != 200) {
                throw new IOException("Request failed");
            }
            try (InputStream input = connection.getInputStream(); ByteArrayOutputStream response = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[256];
                while (true) {
                    connection.setReadTimeout(remainingTimeout(deadline));
                    int count = input.read(buffer);
                    if (count == -1) break;
                    if (response.size() + count > MAX_RESPONSE_BYTES) {
                        throw new IOException("Response too large");
                    }
                    response.write(buffer, 0, count);
                }
                return new JSONObject(response.toString(StandardCharsets.UTF_8.name())).getString("id");
            }
        } finally {
            connection.disconnect();
        }
    }

    private int remainingTimeout(long deadline) throws IOException {
        long remaining = deadline - SystemClock.elapsedRealtime();
        if (remaining <= 0) throw new IOException("Request timed out");
        return (int) remaining;
    }

    private boolean isValidPlayerId(String value) {
        return value != null && value.matches("[0-9]{6,}") && value.matches(".*[1-9].*");
    }
}
