package com.aitutortwo.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 상태바 영역까지 WebView 확장 + CSS safe-area로 패딩 처리
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}
