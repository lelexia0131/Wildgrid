package com.wildgrid.game;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(ClipboardPlugin.class);
        registerPlugin(PlayerIdPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
