package ru.radarazs.yakutsk;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Rect;
import android.net.Uri;

import androidx.core.content.FileProvider;
import androidx.exifinterface.media.ExifInterface;

import com.google.android.gms.tasks.Tasks;
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
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

final class PrivacyImageProcessor {
    interface Callback {
        void onSuccess(Uri safeUri, int facesHidden, int platesHidden);
        void onFailure();
    }

    private static final int MAX_DIMENSION = 1920;
    private static final Pattern[] PLATE_PATTERNS = new Pattern[]{
            Pattern.compile("^[ABEKMHOPCTYX]\\d{3}[ABEKMHOPCTYX]{2}\\d{2,3}$"),
            Pattern.compile("^\\d{4}[ABEKMHOPCTYX]{2}\\d{2,3}$"),
            Pattern.compile("^[ABEKMHOPCTYX]{2}\\d{4}\\d{2,3}$"),
            Pattern.compile("^[ABEKMHOPCTYX]\\d{4}\\d{2,3}$"),
            Pattern.compile("^\\d{3}[ABEKMHOPCTYX]\\d{2,3}$")
    };

    private PrivacyImageProcessor() {}

    static void process(Activity activity, Uri sourceUri, Callback callback) {
        new Thread(() -> {
            Bitmap bitmap = null;
            FaceDetector faceDetector = null;
            TextRecognizer textRecognizer = null;
            try {
                bitmap = decodeOrientedBitmap(activity, sourceUri);
                if (bitmap == null) throw new IllegalStateException("decode failed");
                Bitmap safe = bitmap.copy(Bitmap.Config.ARGB_8888, true);
                if (safe == null) throw new IllegalStateException("copy failed");
                if (safe != bitmap) bitmap.recycle();
                bitmap = safe;

                InputImage image = InputImage.fromBitmap(bitmap, 0);
                FaceDetectorOptions options = new FaceDetectorOptions.Builder()
                        .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE)
                        .setMinFaceSize(0.05f)
                        .build();
                faceDetector = FaceDetection.getClient(options);
                textRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);

                List<Face> faces = Tasks.await(faceDetector.process(image), 30, TimeUnit.SECONDS);
                Text text = Tasks.await(textRecognizer.process(image), 30, TimeUnit.SECONDS);

                List<Rect> faceRects = new ArrayList<>();
                for (Face face : faces) {
                    faceRects.add(expand(face.getBoundingBox(), bitmap.getWidth(), bitmap.getHeight(), 0.28f));
                }

                List<Rect> plateRects = new ArrayList<>();
                for (Text.TextBlock block : text.getTextBlocks()) {
                    for (Text.Line line : block.getLines()) {
                        Rect lineRect = line.getBoundingBox();
                        if (lineRect != null && looksLikePlate(line.getText(), lineRect)) {
                            addIfDistinct(plateRects, expand(lineRect, bitmap.getWidth(), bitmap.getHeight(), 0.20f));
                            continue;
                        }
                        for (Text.Element element : line.getElements()) {
                            Rect elementRect = element.getBoundingBox();
                            if (elementRect != null && looksLikePlate(element.getText(), elementRect)) {
                                addIfDistinct(plateRects, expand(elementRect, bitmap.getWidth(), bitmap.getHeight(), 0.24f));
                            }
                        }
                    }
                }

                for (Rect rect : faceRects) pixelate(bitmap, rect);
                for (Rect rect : plateRects) pixelate(bitmap, rect);

                File dir = activity.getExternalCacheDir();
                if (dir == null) dir = activity.getCacheDir();
                File output = File.createTempFile("SAFE_", ".jpg", dir);
                try (FileOutputStream stream = new FileOutputStream(output)) {
                    if (!bitmap.compress(Bitmap.CompressFormat.JPEG, 88, stream)) {
                        throw new IllegalStateException("encode failed");
                    }
                }
                Uri safeUri = FileProvider.getUriForFile(
                        activity,
                        activity.getPackageName() + ".fileprovider",
                        output
                );
                int faceCount = faceRects.size();
                int plateCount = plateRects.size();
                activity.runOnUiThread(() -> callback.onSuccess(safeUri, faceCount, plateCount));
            } catch (Exception ignored) {
                activity.runOnUiThread(callback::onFailure);
            } finally {
                if (faceDetector != null) faceDetector.close();
                if (textRecognizer != null) textRecognizer.close();
                if (bitmap != null && !bitmap.isRecycled()) bitmap.recycle();
            }
        }, "radar-photo-privacy").start();
    }

    private static Bitmap decodeOrientedBitmap(Activity activity, Uri uri) throws Exception {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        try (InputStream in = activity.getContentResolver().openInputStream(uri)) {
            BitmapFactory.decodeStream(in, null, bounds);
        }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw new IllegalArgumentException("bad image");

        int sample = 1;
        int longest = Math.max(bounds.outWidth, bounds.outHeight);
        while (longest / sample > MAX_DIMENSION * 2) sample *= 2;

        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inSampleSize = sample;
        options.inPreferredConfig = Bitmap.Config.ARGB_8888;
        Bitmap bitmap;
        try (InputStream in = activity.getContentResolver().openInputStream(uri)) {
            bitmap = BitmapFactory.decodeStream(in, null, options);
        }
        if (bitmap == null) throw new IllegalArgumentException("bad image");

        int orientation = ExifInterface.ORIENTATION_NORMAL;
        try (InputStream in = activity.getContentResolver().openInputStream(uri)) {
            if (in != null) {
                ExifInterface exif = new ExifInterface(in);
                orientation = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
            }
        } catch (Exception ignored) {
        }

        Matrix matrix = new Matrix();
        switch (orientation) {
            case ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90);
            case ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180);
            case ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270);
            case ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.postScale(-1, 1);
            case ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.postScale(1, -1);
            case ExifInterface.ORIENTATION_TRANSPOSE -> { matrix.postScale(-1, 1); matrix.postRotate(270); }
            case ExifInterface.ORIENTATION_TRANSVERSE -> { matrix.postScale(-1, 1); matrix.postRotate(90); }
            default -> { }
        }
        if (!matrix.isIdentity()) {
            Bitmap rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), matrix, true);
            if (rotated != bitmap) bitmap.recycle();
            bitmap = rotated;
        }

        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        int max = Math.max(width, height);
        if (max > MAX_DIMENSION) {
            float scale = MAX_DIMENSION / (float) max;
            Bitmap scaled = Bitmap.createScaledBitmap(bitmap, Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)), true);
            if (scaled != bitmap) bitmap.recycle();
            bitmap = scaled;
        }
        return bitmap;
    }

    private static Rect expand(Rect source, int width, int height, float fraction) {
        int dx = Math.max(8, Math.round(source.width() * fraction));
        int dy = Math.max(8, Math.round(source.height() * fraction));
        return new Rect(
                Math.max(0, source.left - dx),
                Math.max(0, source.top - dy),
                Math.min(width, source.right + dx),
                Math.min(height, source.bottom + dy)
        );
    }

    private static void pixelate(Bitmap bitmap, Rect rect) {
        Rect r = new Rect(
                Math.max(0, rect.left), Math.max(0, rect.top),
                Math.min(bitmap.getWidth(), rect.right), Math.min(bitmap.getHeight(), rect.bottom)
        );
        if (r.width() < 4 || r.height() < 4) return;
        Bitmap crop = Bitmap.createBitmap(bitmap, r.left, r.top, r.width(), r.height());
        int smallW = Math.max(6, r.width() / 18);
        int smallH = Math.max(6, r.height() / 18);
        Bitmap tiny = Bitmap.createScaledBitmap(crop, smallW, smallH, false);
        Bitmap mosaic = Bitmap.createScaledBitmap(tiny, r.width(), r.height(), false);
        Canvas canvas = new Canvas(bitmap);
        Paint paint = new Paint();
        paint.setFilterBitmap(false);
        canvas.drawBitmap(mosaic, r.left, r.top, paint);
        crop.recycle();
        if (tiny != crop) tiny.recycle();
        if (mosaic != tiny && mosaic != crop) mosaic.recycle();
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

    private static void addIfDistinct(List<Rect> list, Rect candidate) {
        for (Rect existing : list) {
            Rect intersection = new Rect();
            if (intersection.setIntersect(existing, candidate)) {
                long overlap = (long) intersection.width() * intersection.height();
                long smaller = Math.min((long) existing.width() * existing.height(), (long) candidate.width() * candidate.height());
                if (smaller > 0 && overlap > smaller * 0.60) return;
            }
        }
        list.add(candidate);
    }
}
