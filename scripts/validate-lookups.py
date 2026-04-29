#!/usr/bin/env python3

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TRACKS_PATH = ROOT / "data/track-data/track-ids.lookup.json"
CARS_PATH = ROOT / "data/car-data/car-ids.lookup.json"
CATALOG_PATH = ROOT / "data/series-catalog.json"

REQUIRED_TRACK_IDS = [572, 573, 574, 575, 576, 577, 578, 580, 584, 585]


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def parse_allowed_cars_from_catalog(path: Path):
    catalog = load_json(path)
    allowed = []
    for season_data in catalog.get("seasons", {}).values():
        for series_data in season_data.get("series", {}).values():
            for car in series_data.get("allowedCars", []):
                allowed.append({
                    "carId": car["carId"],
                    "carClassId": car["carClassId"],
                    "label": car["label"],
                })
    return allowed


def main():
    errors = []

    tracks_json = load_json(TRACKS_PATH)
    cars_json = load_json(CARS_PATH)

    tracks = tracks_json.get("tracks", [])
    cars = cars_json.get("cars", [])
    car_classes = cars_json.get("carClasses", [])
    allowed_cars = parse_allowed_cars_from_catalog(CATALOG_PATH)

    track_ids = [t.get("trackId") for t in tracks]
    if len(track_ids) != len(set(track_ids)):
        errors.append("Duplicate trackId values found in track lookup.")

    car_ids = [c.get("carId") for c in cars]
    if len(car_ids) != len(set(car_ids)):
        errors.append("Duplicate carId values found in car lookup.")

    class_ids = [cc.get("carClassId") for cc in car_classes]
    if len(class_ids) != len(set(class_ids)):
        errors.append("Duplicate carClassId values found in car classes.")

    car_by_id = {c.get("carId"): c for c in cars}
    class_by_id = {cc.get("carClassId"): cc for cc in car_classes}
    track_by_id = {t.get("trackId"): t for t in tracks}

    for required_id in REQUIRED_TRACK_IDS:
        if required_id not in track_by_id:
            errors.append(f"Missing required trackId {required_id} in track lookup.")

    if not allowed_cars:
        errors.append("No allowedCars entries were parsed from data/series-catalog.json.")

    for item in allowed_cars:
        car_id = item["carId"]
        class_id = item["carClassId"]
        label = item["label"]

        if car_id not in car_by_id:
            errors.append(f"Configured allowed carId {car_id} ({label}) not found in cars lookup.")

        if class_id not in class_by_id:
            errors.append(f"Configured allowed carClassId {class_id} ({label}) not found in carClasses.")

    print(f"Tracks: {len(tracks)}")
    print(f"Cars: {len(cars)}")
    print(f"Car classes: {len(car_classes)}")
    print(f"Allowed cars parsed from catalog: {len(allowed_cars)}")

    if errors:
        print("\nLookup validation failed:")
        for err in errors:
            print(f"- {err}")
        return 1

    print("\nLookup validation passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
