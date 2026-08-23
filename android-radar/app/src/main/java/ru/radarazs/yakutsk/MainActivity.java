package ru.radarazs.yakutsk;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.ViewGroup;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.content.FileProvider;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.Locale;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 4102;
    private static final String LOCAL_ORIGIN = "https://radar.local/";
    private static final String KEY_HEX = "__KEY_HEX__";
    private static final String IV_HEX = "__IV_HEX__";

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private Uri pendingPhotoUri;
    private Uri pendingVideoUri;
    private File pendingPhotoFile;
    private File pendingVideoFile;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.rgb(12, 17, 23));
        getWindow().setNavigationBarColor(Color.rgb(12, 17, 23));

        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setTextZoom(100);
        settings.setUserAgentString(
                "Mozilla/5.0 (Linux; Android) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36 RadarAZS/1.1.4"
        );

        webView.setWebViewClient(new RadarWebViewClient());
        webView.setWebChromeClient(new RadarChromeClient());

        loadRadar();
    }

    private void loadRadar() {
        try {
            byte[] htmlBytes = decryptAsset("radar.bin");
            String html = new String(htmlBytes, StandardCharsets.UTF_8);
            html = html.replace(
                    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">",
                    "<meta name=\"viewport\" content=\"width=1280,user-scalable=yes\">"
            );
            html = html.replace(
                    "</head>",
                    "<script>window.RADAR_NATIVE_APP=true;window.RADAR_NATIVE_VERSION=\"1.1.4\";</script>" +
                            "<style>html,body{min-width:1280px}</style></head>"
            );
            webView.loadDataWithBaseURL(LOCAL_ORIGIN, html, "text/html", "UTF-8", null);
        } catch (Exception e) {
            String escaped = String.valueOf(e.getMessage())
                    .replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;");
            String errorPage =
                    "<!doctype html><html><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>" +
                    "<body style='font-family:sans-serif;padding:24px'><h2>Радар АЗС</h2>" +
                    "<p>Не удалось открыть встроенные данные приложения.</p><pre>" + escaped + "</pre></body></html>";
            webView.loadData(errorPage, "text/html", "UTF-8");
        }
    }

    private byte[] decryptAsset(String assetName) throws Exception {
        byte[] encrypted = readAsset(assetName);
        Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
        SecretKeySpec key = new SecretKeySpec(hexToBytes(KEY_HEX), "AES");
        IvParameterSpec iv = new IvParameterSpec(hexToBytes(IV_HEX));
        cipher.init(Cipher.DECRYPT_MODE, key, iv);
        return cipher.doFinal(encrypted);
    }

    private byte[] readAsset(String assetName) throws Exception {
        try (InputStream input = getAssets().open(assetName);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int n;
            while ((n = input.read(buffer)) != -1) {
                output.write(buffer, 0, n);
            }
            return output.toByteArray();
        }
    }

    private static byte[] hexToBytes(String value) {
        int len = value.length();
        byte[] result = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            result[i / 2] = (byte) ((Character.digit(value.charAt(i), 16) << 4)
                    + Character.digit(value.charAt(i + 1), 16));
        }
        return result;
    }

    private final class RadarWebViewClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();

            if ("radar.local".equalsIgnoreCase(uri.getHost())
                    && ("/privacy.html".equals(uri.getPath()) || "/rights.html".equals(uri.getPath()))) {
                try {
                    String assetName = "/privacy.html".equals(uri.getPath()) ? "privacy.bin" : "rights.bin";
                    byte[] html = decryptAsset(assetName);
                    return new WebResourceResponse(
                            "text/html",
                            "UTF-8",
                            new ByteArrayInputStream(html)
                    );
                } catch (Exception ignored) {
                    return new WebResourceResponse(
                            "text/html",
                            "UTF-8",
                            500,
                            "Local page error",
                            null,
                            new ByteArrayInputStream(
                                    "<!doctype html><meta charset='utf-8'><p>Не удалось открыть страницу.</p>"
                                            .getBytes(StandardCharsets.UTF_8)
                            )
                    );
                }
            }

            if ("radar.local".equalsIgnoreCase(uri.getHost())
                    && "/data/camera-status.json".equals(uri.getPath())) {
                try {
                    byte[] json = decryptAsset("camera-status.bin");
                    return new WebResourceResponse(
                            "application/json",
                            "UTF-8",
                            new ByteArrayInputStream(json)
                    );
                } catch (Exception ignored) {
                    return new WebResourceResponse(
                            "application/json",
                            "UTF-8",
                            500,
                            "Local data error",
                            null,
                            new ByteArrayInputStream("{}".getBytes(StandardCharsets.UTF_8))
                    );
                }
            }
            return null;
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);

            if ("http".equals(scheme) || "https".equals(scheme)) {
                return false;
            }

            if ("mailto".equals(scheme) || "tel".equals(scheme) || "geo".equals(scheme)
                    || "market".equals(scheme)) {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                }
                return true;
            }

            return false;
        }
    }

    private final class RadarChromeClient extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(
                WebView webView,
                ValueCallback<Uri[]> filePathCallback,
                FileChooserParams fileChooserParams
        ) {
            if (MainActivity.this.filePathCallback != null) {
                MainActivity.this.filePathCallback.onReceiveValue(null);
            }
            MainActivity.this.filePathCallback = filePathCallback;

            String[] acceptTypes = fileChooserParams.getAcceptTypes();
            boolean acceptsImage = false;
            boolean acceptsVideo = false;
            boolean acceptsAny = acceptTypes == null || acceptTypes.length == 0;

            if (acceptTypes != null) {
                for (String type : acceptTypes) {
                    if (type == null || type.isBlank() || "*/*".equals(type)) {
                        acceptsAny = true;
                    } else if (type.startsWith("image/")) {
                        acceptsImage = true;
                    } else if (type.startsWith("video/")) {
                        acceptsVideo = true;
                    }
                }
            }

            if (acceptsAny) {
                acceptsImage = true;
                acceptsVideo = true;
            }

            Intent picker = new Intent(Intent.ACTION_GET_CONTENT);
            picker.addCategory(Intent.CATEGORY_OPENABLE);
            picker.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false);

            if (acceptsImage && !acceptsVideo) {
                picker.setType("image/*");
            } else if (acceptsVideo && !acceptsImage) {
                picker.setType("video/*");
            } else {
                picker.setType("*/*");
                picker.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"image/*", "video/*"});
            }

            ArrayList<Intent> captureIntents = new ArrayList<>();

            if (acceptsImage) {
                Intent cameraIntent = createPhotoCaptureIntent();
                if (cameraIntent != null) captureIntents.add(cameraIntent);
            }

            if (acceptsVideo) {
                Intent videoIntent = createVideoCaptureIntent();
                if (videoIntent != null) captureIntents.add(videoIntent);
            }

            Intent chooser = Intent.createChooser(picker, "Выберите фото или видео");
            if (!captureIntents.isEmpty()) {
                chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, captureIntents.toArray(new Intent[0]));
            }

            try {
                startActivityForResult(chooser, FILE_CHOOSER_REQUEST);
                return true;
            } catch (Exception e) {
                MainActivity.this.filePathCallback.onReceiveValue(null);
                MainActivity.this.filePathCallback = null;
                return false;
            }
        }
    }

    private Intent createPhotoCaptureIntent() {
        try {
            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            if (intent.resolveActivity(getPackageManager()) == null) return null;

            pendingPhotoFile = createCaptureFile("IMG_", ".jpg");
            pendingPhotoUri = FileProvider.getUriForFile(
                    this,
                    getPackageName() + ".fileprovider",
                    pendingPhotoFile
            );
            intent.putExtra(MediaStore.EXTRA_OUTPUT, pendingPhotoUri);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            intent.setClipData(ClipData.newRawUri("photo", pendingPhotoUri));
            return intent;
        } catch (Exception ignored) {
            return null;
        }
    }

    private Intent createVideoCaptureIntent() {
        try {
            Intent intent = new Intent(MediaStore.ACTION_VIDEO_CAPTURE);
            if (intent.resolveActivity(getPackageManager()) == null) return null;

            pendingVideoFile = createCaptureFile("VID_", ".mp4");
            pendingVideoUri = FileProvider.getUriForFile(
                    this,
                    getPackageName() + ".fileprovider",
                    pendingVideoFile
            );
            intent.putExtra(MediaStore.EXTRA_OUTPUT, pendingVideoUri);
            intent.putExtra(MediaStore.EXTRA_DURATION_LIMIT, 10);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            intent.setClipData(ClipData.newRawUri("video", pendingVideoUri));
            return intent;
        } catch (Exception ignored) {
            return null;
        }
    }

    private File createCaptureFile(String prefix, String suffix) throws Exception {
        File dir = getExternalCacheDir();
        if (dir == null) dir = getCacheDir();
        String stamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.ROOT).format(new Date());
        return File.createTempFile(prefix + stamp + "_", suffix, dir);
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != FILE_CHOOSER_REQUEST) {
            super.onActivityResult(requestCode, resultCode, data);
            return;
        }

        if (filePathCallback == null) return;

        Uri sourceUri = null;
        boolean capturedVideo = false;
        if (resultCode == RESULT_OK) {
            if (data != null && (data.getData() != null || data.getClipData() != null)) {
                Uri[] picked = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                if (picked != null && picked.length > 0) sourceUri = picked[0];
            } else if (pendingPhotoFile != null && pendingPhotoFile.length() > 0 && pendingPhotoUri != null) {
                sourceUri = pendingPhotoUri;
            } else if (pendingVideoFile != null && pendingVideoFile.length() > 0 && pendingVideoUri != null) {
                sourceUri = pendingVideoUri;
                capturedVideo = true;
            }
        }

        if (sourceUri == null) {
            finishFileChooser(null);
            return;
        }

        String mime = null;
        try {
            mime = getContentResolver().getType(sourceUri);
        } catch (Exception ignored) {
        }
        boolean isVideo = capturedVideo || (mime != null && mime.toLowerCase(Locale.ROOT).startsWith("video/"));
        final Uri selectedUri = sourceUri;

        if (isVideo) {
            setPrivacyStatus("Автозащита видео: проверяю кадры на лица и госномера…");
            PrivacyVideoProcessor.process(this, selectedUri, new PrivacyVideoProcessor.Callback() {
                @Override
                public void onSuccess(Uri safeUri, double durationSeconds, int framesChecked) {
                    finishFileChooser(new Uri[]{safeUri});
                    if (webView != null) {
                        webView.postDelayed(() -> setPrivacyStatus(
                                "Видео проверено: " + framesChecked +
                                        " кадров. Лица и номера не обнаружены. Звук и исходные метаданные удалены."
                        ), 450);
                    }
                }

                @Override
                public void onBlocked(int facesFound, int platesFound) {
                    finishFileChooser(null);
                    setPrivacyStatus(
                            "Видео не принято: обнаружены лица или госномера (лица — " + facesFound +
                                    ", номера — " + platesFound + "). Снимите ролик без людей и читаемых номеров."
                    );
                }

                @Override
                public void onFailure(String message) {
                    finishFileChooser(null);
                    setPrivacyStatus("Видео не выбрано: " + message);
                }
            });
        } else {
            setPrivacyStatus("Автозащита фото: скрываю найденные лица и госномера…");
            PrivacyImageProcessor.process(this, selectedUri, new PrivacyImageProcessor.Callback() {
                @Override
                public void onSuccess(Uri safeUri, int facesHidden, int platesHidden) {
                    finishFileChooser(new Uri[]{safeUri});
                    if (webView != null) {
                        webView.postDelayed(() -> setPrivacyStatus(
                                "Фото защищено: скрыто лиц — " + facesHidden +
                                        ", номеров — " + platesHidden + ". Метаданные удалены."
                        ), 450);
                    }
                }

                @Override
                public void onFailure() {
                    finishFileChooser(null);
                    setPrivacyStatus("Фото не выбрано: не удалось безопасно обработать изображение.");
                }
            });
        }
    }

    private void finishFileChooser(Uri[] result) {
        if (filePathCallback != null) {
            filePathCallback.onReceiveValue(result);
            filePathCallback = null;
        }
        pendingPhotoUri = null;
        pendingVideoUri = null;
        pendingPhotoFile = null;
        pendingVideoFile = null;
    }

    private void setPrivacyStatus(String message) {
        if (webView == null) return;
        String safe = message.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ");
        webView.evaluateJavascript(
                "(function(){var n=document.getElementById('mediaMsg');if(n)n.textContent='" + safe + "';})()",
                null
        );
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.loadUrl("about:blank");
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
