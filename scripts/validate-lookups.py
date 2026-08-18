#!/usr/bin/env python3

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TRACKS_PATH = ROOT / "data/track-data/track-ids.lookup.json"
CARS_PATH = ROOT / "data/car-data/car-ids.lookup.json"
CAR_CLASS_LOOKUP_PATH = ROOT / "data/car-data/car-class.lookup.json"

REQUIRED_TRACK_IDS = [572, 573, 574, 575, 576, 577, 578, 580, 584, 585, 586, 587, 589]
VALID_CLASS_CONFIDENCE = {"verified", "inferred"}


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def main():
    errors = []

    tracks_json = load_json(TRACKS_PATH)
    cars_json = load_json(CARS_PATH)
    class_lookup_json = load_json(CAR_CLASS_LOOKUP_PATH)

    tracks = tracks_json.get("tracks", [])
    cars = cars_json.get("cars", [])
    car_classes = cars_json.get("carClasses", [])
    class_mappings = class_lookup_json.get("mappings", [])

    track_ids = [t.get("trackId") for t in tracks]
    if len(track_ids) != len(set(track_ids)):
        errors.append("Duplicate trackId values found in track lookup.")

    car_ids = [c.get("carId") for c in cars]
    if len(car_ids) != len(set(car_ids)):
        errors.append("Duplicate carId values found in car lookup.")

    class_ids = [cc.get("carClassId") for cc in car_classes]
    if len(class_ids) != len(set(class_ids)):
        errors.append("Duplicate carClassId values found in car classes.")

    mapped_car_ids = [mapping.get("carId") for mapping in class_mappings]
    if len(mapped_car_ids) != len(set(mapped_car_ids)):
        errors.append("Duplicate carId values found in car class lookup mappings.")

    car_by_id = {c.get("carId"): c for c in cars}
    class_by_id = {cc.get("carClassId"): cc for cc in car_classes}
    track_by_id = {t.get("trackId"): t for t in tracks}

    for required_id in REQUIRED_TRACK_IDS:
        if required_id not in track_by_id:
            errors.append(f"Missing required trackId {required_id} in track lookup.")

    for mapping in class_mappings:
        car_id = mapping.get("carId")
        class_id = mapping.get("carClassId")
        label = mapping.get("label", "unknown")
        confidence = mapping.get("confidence")
        source = mapping.get("source")
        evidence = mapping.get("evidence")

        if car_id not in car_by_id:
            errors.append(f"Mapped carId {car_id} ({label}) not found in car lookup.")

        if class_id not in class_by_id:
            errors.append(f"Mapped carClassId {class_id} ({label}) not found in carClasses.")

        if confidence not in VALID_CLASS_CONFIDENCE:
            errors.append(
                f"Mapped carId {car_id} ({label}) has invalid confidence {confidence!r}; expected one of {sorted(VALID_CLASS_CONFIDENCE)}."
            )

        if not isinstance(source, str) or not source.strip():
            errors.append(f"Mapped carId {car_id} ({label}) is missing a non-empty source.")

        if not isinstance(evidence, str) or not evidence.strip():
            errors.append(f"Mapped carId {car_id} ({label}) is missing non-empty evidence.")

    print(f"Tracks: {len(tracks)}")
    print(f"Cars: {len(cars)}")
    print(f"Car classes: {len(car_classes)}")
    print(f"Car class mappings: {len(class_mappings)}")

    if errors:
        print("\nLookup validation failed:")
        for err in errors:
            print(f"- {err}")
        return 1

    print("\nLookup validation passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
