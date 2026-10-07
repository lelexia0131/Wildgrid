package com.wildgrid.game;

import android.content.ClipData;
import android.content.ClipboardManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WildgridClipboard")
public class ClipboardPlugin extends Plugin {
    private static final int MAX_TEXT_LENGTH = 32768;

    @PluginMethod
    public void writeText(PluginCall call) {
        String text = call.getString("text");
        if (text == null || text.length() > MAX_TEXT_LENGTH) {
            call.reject("地图代码无效或过长");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                ClipboardManager clipboard = getContext().getSystemService(ClipboardManager.class);
                clipboard.setPrimaryClip(ClipData.newPlainText("野格地图代码", text));
                call.resolve();
            } catch (RuntimeException error) {
                call.reject("无法复制地图代码，请再次点击复制", error);
            }
        });
    }

    @PluginMethod
    public void readText(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                ClipboardManager clipboard = getContext().getSystemService(ClipboardManager.class);
                ClipData clip = clipboard.getPrimaryClip();
                CharSequence value = clip != null && clip.getItemCount() > 0 ? clip.getItemAt(0).getText() : null;
                String text = value == null ? "" : value.toString();
                if (text.length() > MAX_TEXT_LENGTH) {
                    call.reject("地图代码过长，请检查复制的内容");
                    return;
                }
                JSObject result = new JSObject();
                result.put("text", text);
                call.resolve(result);
            } catch (RuntimeException error) {
                call.reject("无法读取剪贴板，请长按输入框粘贴", error);
            }
        });
    }
}
