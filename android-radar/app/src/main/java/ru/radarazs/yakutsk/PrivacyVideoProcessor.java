package ru.radarazs.yakutsk;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.Rect;
import android.media.MediaMetadataRetriever;
import android.net.Uri;

import androidx.core.content.FileProvider;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.effect.Presentation;
import androidx.media3.transformer.Composition;
import androidx.media3.transformer.EditedMediaItem;
import androidx.media3.transformer.Effects;
import androidx.media3.transformer.ExportException;
import androidx.media3.transformer.ExportResult;
import androidx.media3.transformer.Transformer;

import com.google.android.gms.tasks.Tasks;
import com.google.common.collect.ImmutableList;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.face.Face;
import com.google.mlkit.vision.face.FaceDetection;
import com.google.mlkit.vision.face.FaceDetector;
import com.google.mlkit.vision.face.FaceDetectorOptions;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.io.File;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

final class PrivacyVideoProcessor {
    interface Callback {
        void onSuccess(Uri safeUri, double durationSeconds, int framesChecked);
        void onBlocked(int facesFound, int platesFound);
        void onFailure(String message);
    }

    private static final long MAX_DURATION_MS = 10_000L;
    private static final long SAMPLE_STEP_US = 250_000L;
    private static final int SCAN_MAX_WIDTH = 960;
    private static final int SCAN_MAX_HEIGHT = 960;
    private static final Pattern[] PLATE_PATTERNS = new Pattern[]{
            Pattern.compile("^[ABEKMHOPCTYX]\\d{3}[ABEKMHOPCTYX]{2}\\d{2,3}$"),
            Pattern.compile("^\\d{4}[ABEKMHOPCTYX]{2}\\d{2,3}$"),
            Pattern.compile("^[ABEKMHOPCTYX]{2}\\d{4}\\d{2,3}$"),
            Pattern.compile("^[ABEKMHOPCTYX]\\d{4}\\d{2,3}$"),
            Pattern.compile("^\\d{3}[ABEKMHOPCTYX]\\d{2,3}$")
    };

    private PrivacyVideoProcessor() {}

    static void process(Activity activity, Uri sourceUri, Callback callback) {
        new Thread(() -> scan(activity, sourceUri, callback), "radar-video-privacy").start();
    }

    private static void scan(Activity activity, Uri sourceUri, Callback callback) {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        FaceDetector faceDetector = null;
        TextRecognizer textRecognizer = null;
        try {
            retriever.setDataSource(activity, sourceUri);
            String durationRaw = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
            long durationMs = durationRaw == null ? 0 : Long.parseLong(durationRaw);
            if (durationMs <= 0) throw new IllegalArgumentException("Не удалось определить длительность видео");
            if (durationMs > MAX_DURATION_MS + 100) {
                activity.runOnUiThread(() -> callback.onFailure("Видео должно быть не длиннее 10 секунд"));
                return;
            }

            FaceDetectorOptions options = new FaceDetectorOptions.Builder()
                    .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
                    .setMinFaceSize(0.04f)
                    .build();
            faceDetector = FaceDetection.getClient(options);
            textRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);

            int framesChecked = 0;
            int facesFound = 0;
            int platesFound = 0;
            long durationUs = durationMs * 1000L;

            for (long timeUs = 0; timeUs <= durationUs; timeUs += SAMPLE_STEP_US) {
                Bitmap frame = null;
                try {
                    if (android.os.Build.VERSION.SDK_INT >= 27) {
                        frame = retriever.getScaledFrameAtTime(
                                Math.min(timeUs, Math.max(0, durationUs - 1)),
                                MediaMetadataRetriever.OPTION_CLOSEST,
                                SCAN_MAX_WIDTH,
                                SCAN_MAX_HEIGHT
                        );
                    } else {
                        frame = retriever.getFrameAtTime(
                                Math.min(timeUs, Math.max(0, durationUs - 1)),
                                MediaMetadataRetriever.OPTION_CLOSEST
                        );
                    }
                    if (frame == null) continue;
                    framesChecked++;

                    InputImage image = InputImage.fromBitmap(frame, 0);
                    List<Face> faces = Tasks.await(faceDetector.process(image), 12, TimeUnit.SECONDS);
                    if (faces != null && !faces.isEmpty()) {
                        facesFound += faces.size();
                    }

                    Text text = Tasks.await(textRecognizer.process(image), 12, TimeUnit.SECONDS);
                    platesFound += countPlateLikeText(text);

                    if (facesFound > 0 || platesFound > 0) {
                        int finalFaces = facesFound;
                        int finalPlates = platesFound;
                        activity.runOnUiThread(() -> callback.onBlocked(finalFaces, finalPlates));
                        return;
                    }
                } finally {
                    if (frame != null && !frame.isRecycled()) frame.recycle();
                }
            }

            if (framesChecked < 3) {
                activity.runOnUiThread(() -> callback.onFailure("Не удалось достаточно надёжно проверить видео"));
                return;
            }

            int checked = framesChecked;
            double durationSeconds = Math.round((durationMs / 1000.0) * 1000.0) / 1000.0;
            activity.runOnUiThread(() -> transcode(activity, sourceUri, durationSeconds, checked, callback));
        } catch (Exception e) {
            String message = e.getMessage();
            if (message == null || message.isBlank()) message = "Не удалось безопасно проверить видео";
            String finalMessage = message;
            activity.runOnUiThread(() -> callback.onFailure(finalMessage));
        } finally {
            try { retriever.release(); } catch (Exception ignored) {}
            if (faceDetector != null) faceDetector.close();
            if (textRecognizer != null) textRecognizer.close();
        }
    }

    private static void transcode(
            Activity activity,
            Uri sourceUri,
            double durationSeconds,
            int framesChecked,
            Callback callback
    ) {
        try {
            File dir = activity.getExternalCacheDir();
            if (dir == null) dir = activity.getCacheDir();
            File output = File.createTempFile("SAFEVID_", ".mp4", dir);
            if (output.exists() && !output.delete()) {
                callback.onFailure("Не удалось подготовить безопасную копию видео");
                return;
            }

            MediaItem mediaItem = MediaItem.fromUri(sourceUri);
            EditedMediaItem editedMediaItem = new EditedMediaItem.Builder(mediaItem)
                    .setRemoveAudio(true)
                    .setEffects(new Effects(
                            ImmutableList.of(),
                            ImmutableList.of(Presentation.createForHeight(720))
                    ))
                    .build();

            Transformer.Listener listener = new Transformer.Listener() {
                @Override
                public void onCompleted(Composition composition, ExportResult result) {
                    if (!output.exists() || output.length() <= 0) {
                        callback.onFailure("Не удалось создать безопасную копию видео");
                        return;
                    }
                    Uri safeUri = FileProvider.getUriForFile(
                            activity,
                            activity.getPackageName() + ".fileprovider",
                            output
                    );
                    callback.onSuccess(safeUri, durationSeconds, framesChecked);
                }

                @Override
                public void onError(Composition composition, ExportResult result, ExportException exception) {
                    if (output.exists()) output.delete();
                    callback.onFailure("Не удалось перекодировать видео на этом устройстве");
                }
            };

            Transformer transformer = new Transformer.Builder(activity)
                    .setVideoMimeType(MimeTypes.VIDEO_H264)
                    .addListener(listener)
                    .build();
            transformer.start(editedMediaItem, output.getAbsolutePath());
        } catch (Exception e) {
            callback.onFailure("Не удалось подготовить безопасное видео");
        }
    }

    private static int countPlateLikeText(Text text) {
        int count = 0;
        for (Text.TextBlock block : text.getTextBlocks()) {
            for (Text.Line line : block.getLines()) {
                Rect lineRect = line.getBoundingBox();
                if (lineRect != null && looksLikePlate(line.getText(), lineRect)) {
                    count++;
                    continue;
                }
                for (Text.Element element : line.getElements()) {
                    Rect rect = element.getBoundingBox();
                    if (rect != null && looksLikePlate(element.getText(), rect)) {
                        count++;
                        break;
                    }
                }
            }
        }
        return count;
    }

    private static boolean looksLikePlate(String raw, Rect rect) {
        String value = normalizePlate(raw);
        if (value.length() < 6 || value.length() > 10) return false;
        if (rect.width() < rect.height() * 1.35f) return false;
        for (Pattern pattern : PLATE_PATTERNS) {
            if (pattern.matcher(value).matches()) return true;
        }
        int digits = 0;
        int letters = 0;
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (Character.isDigit(c)) digits++;
            else if ("ABEKMHOPCTYX".indexOf(c) >= 0) letters++;
            else return false;
        }
        return value.length() >= 7 && value.length() <= 9 && digits >= 4 && letters >= 1 && letters <= 3
                && rect.width() >= rect.height() * 2.0f;
    }

    private static String normalizePlate(String raw) {
        String source = raw == null ? "" : raw.toUpperCase(Locale.ROOT).replaceAll("[^A-ZА-Я0-9]", "");
        StringBuilder out = new StringBuilder(source.length());
        for (int i = 0; i < source.length(); i++) {
            char c = source.charAt(i);
            out.append(switch (c) {
                case 'А' -> 'A'; case 'В' -> 'B'; case 'Е' -> 'E'; case 'К' -> 'K';
                case 'М' -> 'M'; case 'Н' -> 'H'; case 'О' -> 'O'; case 'Р' -> 'P';
                case 'С' -> 'C'; case 'Т' -> 'T'; case 'У' -> 'Y'; case 'Х' -> 'X';
                default -> c;
            });
        }
        return out.toString();
    }
}
