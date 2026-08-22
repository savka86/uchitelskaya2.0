#!/usr/bin/env python3
"""Experimental queue monitor for public STNG camera share pages.

The monitor opens each official public camera page, captures the visible frame,
counts vehicle-like objects with a small YOLO model and publishes JSON consumed
by the Fuel Radar UI. Counts are estimates, not an official queue measurement.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright
from ultralytics import YOLO


CAMERAS = [
    {
        "id": "mozh31",
        "name": "АГЗС №1 — ул. Можайского, 31",
        "url": "https://lk-b2b.camera.rt.ru/sl/POVtkjuH7",
    },
    {
        "id": "vil4",
        "name": "АГЗС №3 — Вилюйский тракт, 4 км, 6г",
        "url": "https://lk-b2b.camera.rt.ru/sl/H0oMBC_pE",
    },
    {
        "id": "nik16",
        "name": "АГЗС №2 — пр. Михаила Николаева, 16а",
        "url": "https://lk-b2b.camera.rt.ru/sl/LL24Sq0y5",
    },
    {
        "id": "zhatai",
        "name": "АГЗС — п. Жатай",
        "url": "https://lk-b2b.camera.rt.ru/sl/wtVzcSfmx",
    },
]

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
TMP_DIR = ROOT / ".camera-tmp"
OUTPUT = DATA_DIR / "camera-status.json"
VEHICLE_CLASSES = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}


def queue_level(count: int) -> str:
    if count <= 2:
        return "свободно"
    if count <= 7:
        return "есть машины"
    return "заметная очередь"


def camera_frame_state(page) -> dict | None:
    return page.evaluate(
        """
        () => {
          const v = document.querySelector('video');
          if (!v) return null;
          v.muted = true;
          v.play().catch(() => {});
          return {
            ready_state: v.readyState,
            current_time: v.currentTime,
            width: v.videoWidth,
            height: v.videoHeight,
            paused: v.paused
          };
        }
        """
    )


def detect_vehicles(model: YOLO, image_path: Path) -> tuple[int, list[dict]]:
    prediction = model.predict(
        source=str(image_path),
        imgsz=1280,
        conf=0.15,
        iou=0.45,
        verbose=False,
    )[0]
    vehicles: list[dict] = []
    if prediction.boxes is None:
        return 0, vehicles
    for box in prediction.boxes:
        class_id = int(box.cls.item())
        if class_id not in VEHICLE_CLASSES:
            continue
        vehicles.append(
            {
                "type": VEHICLE_CLASSES[class_id],
                "confidence": round(float(box.conf.item()), 3),
            }
        )
    return len(vehicles), vehicles


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    model = YOLO("yolov8n.pt")
    checked_at = datetime.now(timezone.utc).isoformat()
    observations: list[dict] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            args=["--autoplay-policy=no-user-gesture-required"],
        )
        context = browser.new_context(
            viewport={"width": 1365, "height": 900},
            user_agent=(
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "Chrome/131.0 Safari/537.36 FuelRadarCameraMonitor/1.0"
            ),
        )

        for camera in CAMERAS:
            page = context.new_page()
            image_path = TMP_DIR / f"{camera['id']}.png"
            result = {
                "id": camera["id"],
                "name": camera["name"],
                "source_url": camera["url"],
                "checked_at": checked_at,
                "online": False,
                "vehicles_visible": None,
                "queue_level": "камера недоступна",
                "experimental": True,
            }
            try:
                page.goto(camera["url"], wait_until="domcontentloaded", timeout=45_000)
                page.wait_for_timeout(8_000)
                before = camera_frame_state(page)
                page.wait_for_timeout(2_500)
                after = camera_frame_state(page)
                if not after or after.get("ready_state", 0) < 3:
                    raise RuntimeError("video element did not become ready")

                # Capture the video itself so the detector does not count cars
                # drawn in page chrome, logos or nearby recommendations.
                page.locator("video").screenshot(path=str(image_path))
                count, detections = detect_vehicles(model, image_path)
                progressed = bool(
                    before
                    and after.get("current_time", 0) > before.get("current_time", 0)
                )
                result.update(
                    {
                        "online": True,
                        "stream_progressed": progressed,
                        "frame_width": after.get("width"),
                        "frame_height": after.get("height"),
                        "vehicles_visible": count,
                        "queue_level": queue_level(count),
                        "detections": detections,
                    }
                )
            except Exception as exc:
                result["error"] = str(exc)[:240]
            finally:
                observations.append(result)
                page.close()

        context.close()
        browser.close()

    payload = {
        "checked_at": checked_at,
        "source": "Официальные публичные камеры АО «Сахатранснефтегаз»",
        "method": "public camera frame + YOLOv8n",
        "disclaimer": (
            "Экспериментальная оценка количества видимых автомобилей. "
            "Это не официальный размер очереди; часть машин может находиться вне кадра."
        ),
        "cameras": observations,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
