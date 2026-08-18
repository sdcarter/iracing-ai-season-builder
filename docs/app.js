const selectorForm = document.getElementById("selectorForm");
const seasonSelect = document.getElementById("seasonSelect");
const seriesSelect = document.getElementById("seriesSelect");
const carSelect = document.getElementById("carSelect");
const fileNameInput = document.getElementById("fileNameInput");
const statusEl = document.getElementById("status");

const TEMPLATE_PATHS = [
  "./assets/templates/default-ai-season-template.json",
  "../data/templates/default-ai-season-template.json"
];

const TRACK_MAP_PATHS = [
  "./assets/track-data/track-ids.lookup.json",
  "../data/track-data/track-ids.lookup.json"
];

const CAR_LOOKUP_PATHS = [
  "./assets/car-data/car-ids.lookup.json",
  "../data/car-data/car-ids.lookup.json"
];

const CAR_CLASS_LOOKUP_PATHS = [
  "./assets/car-data/car-class.lookup.json",
  "../data/car-data/car-class.lookup.json"
];

const REMOTE_SEASON_DATA_URL =
  "https://raw.githubusercontent.com/Girgetto/iracing-calendar/main/data/iracing-season-data.json";

const REMOTE_CAR_NAME_ALIASES = {
  "bmw m2 racing g87": "bmw m2 cs racing",
  "bmw m4 g82 gt4 evo": "bmw m4 g82 gt4",
  "bmw m4 gt3 evo": "bmw m4 gt3 prototype",
  "bmw m hybrid v8 evo": "bmw m hybrid v8",
  "nascar o reilly chevrolet camaro": "nascar xfinity chevrolet camaro",
  "nascar o reilly ford mustang": "nascar xfinity ford mustang",
  "nascar o reilly toyota supra": "nascar xfinity toyota supra",
  "ford gt gt2": "ford gt gt2 gt3"
};

const TRACK_OVERRIDES_BY_REMOTE_SLUG = {
  "echopark-speedway-atlanta-rallycross-short": {
    name: "EchoPark Speedway (Atlanta) - Rallycross Short",
    trackId: 322,
    filepath: ""
  },
  "echopark-speedway-atlanta-rallycross-long": {
    name: "EchoPark Speedway (Atlanta) - Rallycross Long",
    trackId: 323,
    filepath: ""
  }
};

const CATEGORY_ID_BY_REMOTE_CATEGORY = {
  Oval: 1,
  "Dirt Oval": 3,
  "Dirt Road": 4,
  "Sports Car": 5,
  "Formula Car": 6
};

let products = {};
let trackMapByKey = {};
let trackMapBySlug = {};
let trackKeysByLength = [];
let carMapByKey = {};
let currentSeasonLabel = "";
let carClassMappingByCarId = {};

function ensureArray(value) {
  return Array.isArray(value) ? value : [value];
}

function buildDefaultCarSettings(carIds) {
  return carIds.map((carId) => ({
    car_id: carId,
    max_pct_fuel_fill: 100,
    max_dry_tire_sets: 0
  }));
}

function splitTrackLabel(trackLabel) {
  const separator = " - ";
  const separatorIndex = trackLabel.lastIndexOf(separator);

  if (separatorIndex === -1) {
    return {
      fullLabel: trackLabel,
      trackName: trackLabel,
      configName: ""
    };
  }

  return {
    fullLabel: trackLabel,
    trackName: trackLabel.slice(0, separatorIndex).trim(),
    configName: trackLabel.slice(separatorIndex + separator.length).trim()
  };
}

function normalizeValue(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[()]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeTrackName(value) {
  return normalizeValue(value);
}

function normalizeCarName(value) {
  return normalizeValue(value);
}

function slugifyTrackName(value) {
  return normalizeValue(value).replace(/\s+/g, "-");
}

function sanitizeFileName(value, fallbackName) {
  const cleaned = (value || "")
    .trim()
    .replace(/\.json$/i, "")
    .replace(/[^a-z0-9-_ ]+/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned || fallbackName;
}

function getOutputFileStem(seasonCode, seriesCode) {
  const seasonBucket = products[seasonCode] || {};
  const seriesConfig = seasonBucket[seriesCode] || null;
  const seriesLabel = seriesConfig?.label || seriesCode;
  const seriesSlug = sanitizeFileName(seriesLabel, seriesCode).toLowerCase();
  return `${seriesSlug}--${seasonCode}`;
}

function parseSeasonCodeFromRemote(metadata) {
  const year = Number.parseInt(metadata?.seasonYear, 10);
  const seasonNumber = Number.parseInt(metadata?.seasonNumber, 10);

  if (!Number.isInteger(year) || !Number.isInteger(seasonNumber)) {
    throw new Error("Remote season metadata is missing seasonYear or seasonNumber.");
  }

  return `${year}s${seasonNumber}`;
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function getSelectedSeriesConfig() {
  const seasonBucket = products[seasonSelect.value];
  return seasonBucket && seasonBucket[seriesSelect.value] ? seasonBucket[seriesSelect.value] : null;
}

async function fetchJsonFromAnyPath(paths) {
  const orderedPaths = ensureArray(paths);
  let lastErrorMessage = "No paths configured.";

  for (const path of orderedPaths) {
    const response = await fetch(path, { cache: "no-store" });
    if (response.ok) {
      return response.json();
    }

    lastErrorMessage = `${path} -> HTTP ${response.status}`;
  }

  throw new Error(`Could not fetch JSON from any path. Last failure: ${lastErrorMessage}`);
}

async function fetchRemoteSeasonData() {
  const response = await fetch(REMOTE_SEASON_DATA_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Remote season fetch failed with HTTP ${response.status}.`);
  }

  return response.json();
}

function buildTrackIndexes(trackMapJson) {
  const tracks = Array.isArray(trackMapJson?.tracks) ? trackMapJson.tracks : [];
  trackMapByKey = Object.fromEntries(
    tracks.map((track) => [normalizeTrackName(track.name), track])
  );
  trackMapBySlug = Object.fromEntries(tracks.map((track) => [slugifyTrackName(track.name), track]));

  Object.entries(TRACK_OVERRIDES_BY_REMOTE_SLUG).forEach(([slug, track]) => {
    trackMapBySlug[slug] = track;
    trackMapByKey[normalizeTrackName(track.name)] = track;
  });

  trackKeysByLength = Object.keys(trackMapByKey).sort((left, right) => right.length - left.length);
}

function pickPreferredCar(entries) {
  return entries.find((entry) => entry.retired === false) || entries[0] || null;
}

function buildCarClassLookup(carClassLookupJson) {
  const mappings = Array.isArray(carClassLookupJson?.mappings) ? carClassLookupJson.mappings : [];
  carClassMappingByCarId = Object.fromEntries(
    mappings
      .filter((mapping) => Number.isInteger(mapping.carId) && Number.isInteger(mapping.carClassId))
      .map((mapping) => [mapping.carId, mapping])
  );
}

function buildCarIndexes(carLookupJson) {
  const cars = Array.isArray(carLookupJson?.cars) ? carLookupJson.cars : [];
  const buckets = new Map();

  cars.forEach((car) => {
    const explicitMapping = carClassMappingByCarId[car.carId] || null;
    const resolvedCarClassId =
      Number.isInteger(car.carClassId) && car.carClassId > 0
        ? car.carClassId
        : explicitMapping?.carClassId || null;
    const key = normalizeCarName(car.name);
    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key).push({
      ...car,
      carClassId: resolvedCarClassId,
      carClassFamily: explicitMapping?.family || null,
      carClassConfidence:
        Number.isInteger(car.carClassId) && car.carClassId > 0
          ? "native"
          : explicitMapping?.confidence || null,
      carClassSource: explicitMapping?.source || null,
      carClassEvidence: explicitMapping?.evidence || null
    });
  });

  carMapByKey = Object.fromEntries(
    [...buckets.entries()].map(([key, entries]) => [key, pickPreferredCar(entries)])
  );
}

function getRemoteCarNameCandidates(remoteCarName) {
  const normalized = normalizeCarName(remoteCarName);
  const candidates = new Set([normalized]);
  const directAlias = REMOTE_CAR_NAME_ALIASES[normalized];
  if (directAlias) {
    candidates.add(directAlias);
  }

  if (normalized.includes(" evo ")) {
    candidates.add(normalized.replace(/\bevo\b/g, "").replace(/\s+/g, " ").trim());
  }

  return [...candidates].filter(Boolean);
}

function resolveAllowedCars(remoteSeries) {
  const remoteCarNames = String(remoteSeries?.car || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const allowedCars = [];
  const unresolvedCarNames = [];
  const seenCarIds = new Set();

  remoteCarNames.forEach((carName) => {
    const matchedCar = getRemoteCarNameCandidates(carName)
      .map((candidate) => carMapByKey[candidate])
      .find(Boolean);

    if (!matchedCar) {
      unresolvedCarNames.push(carName);
      return;
    }

    if (seenCarIds.has(matchedCar.carId)) {
      return;
    }

    seenCarIds.add(matchedCar.carId);
    allowedCars.push({
      carId: matchedCar.carId,
      label: matchedCar.name,
      carClassId: matchedCar.carClassId,
      carClassFamily: matchedCar.carClassFamily,
      carClassConfidence: matchedCar.carClassConfidence,
      carClassSource: matchedCar.carClassSource,
      carClassEvidence: matchedCar.carClassEvidence
    });
  });

  return {
    allowedCars,
    unresolvedCarNames
  };
}

function parseConditions(conditionsText) {
  const text = String(conditionsText || "");
  const tempMatch = text.match(/(-?\d+)\u00b0F/i);
  const rainMatch = text.match(/Rain chance\s+([^,\n]+)/i);
  const hasRollingStart = /Rolling start/i.test(text);
  const hasStandingStart = /Standing start/i.test(text);
  const cautionsDisabled = /Cautions disabled/i.test(text);
  const cautioningEnabled = /advisory cautions|enforced cautions|full course cautions/i.test(text);

  return {
    tempF: tempMatch ? Number.parseInt(tempMatch[1], 10) : null,
    rainChance:
      rainMatch && rainMatch[1]
        ? rainMatch[1].toLowerCase() === "none"
          ? 0
          : Number.parseInt(rainMatch[1], 10)
        : null,
    rollingStart: hasRollingStart ? true : hasStandingStart ? false : null,
    fullCourseCautions: cautionsDisabled ? false : cautioningEnabled ? true : null
  };
}

function buildWeekRowsFromRemoteSeries(remoteSeries) {
  const schedule = Array.isArray(remoteSeries?.schedule) ? remoteSeries.schedule : [];

  return [...schedule]
    .sort((left, right) => Number(left.week) - Number(right.week))
    .map((week) => {
      const trackLabel = String(week.track || "").trim();
      const trackParts = splitTrackLabel(trackLabel);
      const conditions = parseConditions(week.conditions);
      const raceDateTime = typeof week.raceDateTime === "string" ? week.raceDateTime : null;

      return {
        weekNumber: Number.parseInt(week.week, 10),
        weekDate: typeof week.startDate === "string" ? week.startDate.slice(0, 10) : "",
        trackLabel: trackParts.fullLabel,
        trackName: trackParts.trackName,
        configName: trackParts.configName,
        trackKey: normalizeTrackName(trackParts.fullLabel),
        baseTrackKey: normalizeTrackName(trackParts.trackName),
        remoteTrackId: typeof week.trackId === "string" ? week.trackId : "",
        simulatedStartTime: raceDateTime ? raceDateTime.replace(/Z$/, "") : null,
        raceTimeOfDay: raceDateTime ? raceDateTime.slice(11, 19) : null,
        tempF: conditions.tempF,
        rainChance: conditions.rainChance,
        rollingStart: conditions.rollingStart,
        fullCourseCautions: conditions.fullCourseCautions,
        raceLengthMinutes: Number.isInteger(week.durationMinutes) ? week.durationMinutes : null,
        raceLengthLaps: Number.isInteger(week.durationLaps) ? week.durationLaps : null
      };
    });
}

function findTrackByPrefix(normalizedTrackName) {
  const matchedKey = trackKeysByLength.find(
    (trackKey) =>
      normalizedTrackName.startsWith(trackKey) || trackKey.startsWith(normalizedTrackName)
  );

  return matchedKey ? trackMapByKey[matchedKey] : null;
}

function resolveTrack(row) {
  const overrideMatch = row.remoteTrackId ? trackMapBySlug[row.remoteTrackId] : null;
  if (overrideMatch) {
    return overrideMatch;
  }

  const exactMatch = trackMapByKey[row.trackKey];
  if (exactMatch) {
    return exactMatch;
  }

  const slugMatch = trackMapBySlug[slugifyTrackName(row.trackLabel)];
  if (slugMatch) {
    return slugMatch;
  }

  const prefixMatch = findTrackByPrefix(row.trackKey);
  if (prefixMatch) {
    return prefixMatch;
  }

  if (row.baseTrackKey) {
    const baseMatch = trackMapByKey[row.baseTrackKey] || findTrackByPrefix(row.baseTrackKey);
    if (baseMatch) {
      return baseMatch;
    }
  }

  return null;
}

function getCategoryId(remoteCategory) {
  return CATEGORY_ID_BY_REMOTE_CATEGORY[remoteCategory] || 5;
}

function buildWeatherFromWeek(templateWeather, weekRow) {
  if (!templateWeather || typeof templateWeather !== "object") {
    return templateWeather;
  }

  return {
    ...templateWeather,
    simulated_start_time: weekRow.simulatedStartTime || templateWeather.simulated_start_time,
    temp_value: Number.isInteger(weekRow.tempF) ? weekRow.tempF : templateWeather.temp_value,
    track_water: Number.isInteger(weekRow.rainChance) && weekRow.rainChance > 0 ? 1 : 0
  };
}

function updateRaceLengthFromWeek(payload, weekRow) {
  if (Number.isInteger(weekRow.raceLengthMinutes) && weekRow.raceLengthMinutes > 0) {
    return {
      ...payload,
      race_laps: 0,
      race_length_type: 2,
      race_length: weekRow.raceLengthMinutes
    };
  }

  if (Number.isInteger(weekRow.raceLengthLaps) && weekRow.raceLengthLaps > 0) {
    return {
      ...payload,
      race_laps: weekRow.raceLengthLaps,
      race_length_type: 1,
      race_length: weekRow.raceLengthLaps
    };
  }

  return payload;
}

function updateSessionFlagsFromWeek(payload, weekRow) {
  return {
    ...payload,
    rolling_starts:
      typeof weekRow.rollingStart === "boolean" ? weekRow.rollingStart : payload.rolling_starts,
    full_course_cautions:
      typeof weekRow.fullCourseCautions === "boolean"
        ? weekRow.fullCourseCautions
        : payload.full_course_cautions
  };
}

function buildGeneratedFrom(seriesConfig, weekRows) {
  return {
    source: "runtime-generic-template-plus-community-season-data",
    sourceUrl: REMOTE_SEASON_DATA_URL,
    generatedAtUtc: new Date().toISOString(),
    remoteSeriesId: seriesConfig.remoteSeriesId,
    remoteCategory: seriesConfig.remoteCategory,
    seasonCode: seriesConfig.seasonCode,
    warnings: seriesConfig.warnings,
    unresolvedCarNames: seriesConfig.unresolvedCarNames,
    carsWithClassIds: seriesConfig.knownCarClassCount,
    carsWithVerifiedClassIds: seriesConfig.verifiedCarClassCount,
    carsWithInferredClassIds: seriesConfig.inferredCarClassCount,
    weeksParsed: weekRows.length
  };
}

function createSeasonFromTemplate(templateJson, weekRows, seriesConfig, selectedCarId) {
  if (!Array.isArray(templateJson.events) || templateJson.events.length === 0) {
    throw new Error("Template has no events array to clone from.");
  }

  if (!seriesConfig || !Array.isArray(seriesConfig.allowedCars) || seriesConfig.allowedCars.length === 0) {
    throw new Error("Series has no resolved cars in the upstream feed.");
  }

  const selectedCar = seriesConfig.allowedCars.find((car) => car.carId === selectedCarId);
  if (!selectedCar) {
    throw new Error("Selected driver car is not valid for this series.");
  }

  const unresolved = weekRows.filter((row) => {
    const mapped = resolveTrack(row);
    return !mapped || !Number.isInteger(mapped.trackId) || mapped.trackId <= 0;
  });
  if (unresolved.length > 0) {
    const missingList = unresolved.map((row) => row.trackLabel).join(" | ");
    throw new Error(`Track IDs missing for: ${missingList}`);
  }

  const baseEvent = { ...templateJson.events[0] };
  const rosterCarIds = seriesConfig.allowedCars.map((car) => car.carId);
  const knownCarClassIds = [...new Set(seriesConfig.allowedCars.map((car) => car.carClassId).filter(Number.isInteger))];
  const firstWeek = weekRows[0];
  const firstTrack = resolveTrack(firstWeek);

  let updated = {
    ...templateJson,
    category_id: getCategoryId(seriesConfig.remoteCategory),
    carId: selectedCar.carId,
    car_name: selectedCar.label,
    carSettings: buildDefaultCarSettings(rosterCarIds),
    event_count: weekRows.length,
    name: seriesConfig.label,
    rosterName: seriesConfig.label,
    next_track_name: firstTrack?.name || firstWeek.trackLabel,
    official: false,
    weather: buildWeatherFromWeek(templateJson.weather, firstWeek)
  };

  updated = updateSessionFlagsFromWeek(updated, firstWeek);
  updated = updateRaceLengthFromWeek(updated, firstWeek);

  if (knownCarClassIds.length === 1) {
    updated.aiCarClassId = knownCarClassIds[0];
  } else if (knownCarClassIds.length > 1) {
    updated.aiCarClassIds = knownCarClassIds;
  }

  if (Number.isInteger(selectedCar.carClassId)) {
    updated.userCarClassId = selectedCar.carClassId;
  }

  const newEvents = weekRows.map((row) => {
    const mappedTrack = resolveTrack(row);
    return {
      ...baseEvent,
      trackId: mappedTrack.trackId,
      eventId: crypto.randomUUID()
    };
  });

  return {
    ...updated,
    events: newEvents,
    generatedFrom: {
      ...buildGeneratedFrom(seriesConfig, weekRows),
      selectedCarClassConfidence: selectedCar.carClassConfidence || null,
      selectedCarClassFamily: selectedCar.carClassFamily || null,
      selectedCarClassSource: selectedCar.carClassSource || null
    }
  };
}

function buildConsoleScheduleRows(seriesConfig) {
  return seriesConfig.schedule.map((row) => {
    const mappedTrack = resolveTrack(row);

    return {
      raceWeekNum: row.weekNumber,
      trackId: mappedTrack?.trackId || null,
      trackName: mappedTrack?.name || row.trackLabel,
      raceTimeOfDay: row.raceTimeOfDay,
      cars: seriesConfig.allowedCars.map((car) => car.label).join(", ")
    };
  });
}

function logSelectedSeriesScheduleToConsole() {
  const seriesConfig = getSelectedSeriesConfig();
  if (!seriesConfig || !Array.isArray(seriesConfig.schedule) || seriesConfig.schedule.length === 0) {
    return;
  }

  const rows = buildConsoleScheduleRows(seriesConfig);
  console.groupCollapsed(
    `[iRacing AI] ${seriesConfig.label} (${seriesConfig.seasonCode}) mapped ${rows.length}-week schedule`
  );
  console.table(rows);
  console.groupEnd();
}

function getSelectionStatus(seriesConfig) {
  if (!seriesConfig) {
    return {
      message: "No series selected.",
      isError: true
    };
  }

  const parts = [
    `Latest upstream season: ${currentSeasonLabel || seriesConfig.seasonCode}.`,
    "AI-enabled support is not exposed by the upstream feed, so generated downloads are best-effort."
  ];

  if (seriesConfig.allowedCars.length === 0) {
    parts.push("This series cannot be generated yet because no concrete cars could be resolved from the upstream feed.");
  } else {
    parts.push(`Resolved ${seriesConfig.allowedCars.length} car(s) for this series.`);
    if (seriesConfig.verifiedCarClassCount > 0 || seriesConfig.inferredCarClassCount > 0) {
      parts.push(
        `${seriesConfig.knownCarClassCount} car(s) have class IDs (${seriesConfig.verifiedCarClassCount} verified, ${seriesConfig.inferredCarClassCount} inferred).`
      );
    } else {
      parts.push("No class IDs are known yet for this series.");
    }
  }

  if (seriesConfig.unresolvedCarNames.length > 0) {
    parts.push(`Skipped upstream car labels: ${seriesConfig.unresolvedCarNames.join(", ")}.`);
  }

  if (seriesConfig.unresolvedTrackCount > 0) {
    parts.push(
      `${seriesConfig.unresolvedTrackCount} track(s) are still unmapped, so download will fail until those lookups are added.`
    );
  }

  return {
    message: parts.join(" "),
    isError: seriesConfig.allowedCars.length === 0 || seriesConfig.unresolvedTrackCount > 0
  };
}

function applySelectionStatus() {
  const seriesConfig = getSelectedSeriesConfig();
  const status = getSelectionStatus(seriesConfig);
  setStatus(status.message, status.isError);
}

function refreshCarChoices() {
  const selectedSeries = getSelectedSeriesConfig();
  carSelect.replaceChildren();

  if (!selectedSeries || !Array.isArray(selectedSeries.allowedCars) || selectedSeries.allowedCars.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No cars resolved from upstream feed";
    carSelect.appendChild(option);
    carSelect.disabled = true;
    return;
  }

  selectedSeries.allowedCars.forEach((car) => {
    const option = document.createElement("option");
    option.value = String(car.carId);
    option.textContent = car.label;
    carSelect.appendChild(option);
  });

  carSelect.disabled = false;
}

function refreshOutputFileName() {
  fileNameInput.value = `${getOutputFileStem(seasonSelect.value, seriesSelect.value)}.json`;
}

function refreshSeasonChoices() {
  seasonSelect.replaceChildren();
  const seasonCodes = Object.keys(products);

  seasonCodes.forEach((seasonCode) => {
    const option = document.createElement("option");
    option.value = seasonCode;
    option.textContent = seasonCode;
    seasonSelect.appendChild(option);
  });

  seasonSelect.disabled = true;
}

function refreshSeriesChoices() {
  seriesSelect.replaceChildren();
  const seasonBucket = products[seasonSelect.value] || {};
  const seriesEntries = Object.entries(seasonBucket);

  seriesEntries.forEach(([seriesCode, config]) => {
    const option = document.createElement("option");
    option.value = seriesCode;
    option.textContent = config.label || seriesCode;
    seriesSelect.appendChild(option);
  });

  seriesSelect.disabled = seriesEntries.length === 0;
}

async function downloadJson(seasonCode, seriesCode) {
  const seasonBucket = products[seasonCode];
  const item = seasonBucket && seasonBucket[seriesCode];
  const selectedCarId = Number.parseInt(carSelect.value, 10);

  if (!item) {
    setStatus("Selected series is not available.", true);
    return;
  }

  if (!Number.isInteger(selectedCarId) || selectedCarId <= 0) {
    setStatus("Choose the car you intend to drive.", true);
    return;
  }

  setStatus("Generating season JSON from generic template + community season data...");

  try {
    const templateJson = await fetchJsonFromAnyPath(TEMPLATE_PATHS);
    const weekRows = item.schedule;

    if (!Array.isArray(weekRows) || weekRows.length === 0) {
      throw new Error("No schedule rows were loaded for this series.");
    }

    const generatedJson = createSeasonFromTemplate(templateJson, weekRows, item, selectedCarId);
    const jsonText = JSON.stringify(generatedJson, null, 2);
    const blob = new Blob([jsonText], { type: "application/json" });
    const blobUrl = URL.createObjectURL(blob);

    const fileName = `${getOutputFileStem(seasonCode, seriesCode)}.json`;
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(blobUrl);

    setStatus(`Generated and downloaded ${item.label} for ${seasonCode}.`);
  } catch (error) {
    setStatus(`Download failed: ${error.message}`, true);
  }
}

function buildSeriesWarnings(remoteSeries, resolution, schedule) {
  const warnings = [];

  if (resolution.unresolvedCarNames.length > 0) {
    warnings.push(`Unresolved car labels: ${resolution.unresolvedCarNames.join(", ")}`);
  }

  const unresolvedTracks = schedule.filter((row) => !resolveTrack(row));
  if (unresolvedTracks.length > 0) {
    warnings.push(
      `Unresolved tracks: ${unresolvedTracks.map((row) => row.trackLabel).join(" | ")}`
    );
  }

  if (!remoteSeries?.category) {
    warnings.push("Remote category was missing; default category_id fallback will be used.");
  }

  warnings.push("Upstream feed does not expose AI-enabled support or full hosted-series settings.");
  return warnings;
}

function sortSeriesEntries(entries) {
  return entries.sort((left, right) => {
    const leftConfig = left[1];
    const rightConfig = right[1];
    const categoryCompare = String(leftConfig.remoteCategory || "").localeCompare(
      String(rightConfig.remoteCategory || "")
    );

    if (categoryCompare !== 0) {
      return categoryCompare;
    }

    return leftConfig.label.localeCompare(rightConfig.label);
  });
}

async function loadProducts() {
  const [trackLookupJson, carLookupJson, carClassLookupJson, remoteSeasonData] = await Promise.all([
    fetchJsonFromAnyPath(TRACK_MAP_PATHS),
    fetchJsonFromAnyPath(CAR_LOOKUP_PATHS),
    fetchJsonFromAnyPath(CAR_CLASS_LOOKUP_PATHS),
    fetchRemoteSeasonData()
  ]);

  buildTrackIndexes(trackLookupJson);
  buildCarClassLookup(carClassLookupJson);
  buildCarIndexes(carLookupJson);

  const seasonCode = parseSeasonCodeFromRemote(remoteSeasonData.metadata);
  currentSeasonLabel = remoteSeasonData?.metadata?.season || seasonCode;

  const seriesEntries = sortSeriesEntries(
    (remoteSeasonData.series || []).map((remoteSeries) => {
      const resolution = resolveAllowedCars(remoteSeries);
      const schedule = buildWeekRowsFromRemoteSeries(remoteSeries);
      const warnings = buildSeriesWarnings(remoteSeries, resolution, schedule);

      return [
        remoteSeries.id,
        {
          label: remoteSeries.name || remoteSeries.id,
          templatePaths: TEMPLATE_PATHS,
          allowedCars: resolution.allowedCars,
          knownCarClassCount: resolution.allowedCars.filter((car) => Number.isInteger(car.carClassId)).length,
          verifiedCarClassCount: resolution.allowedCars.filter(
            (car) => Number.isInteger(car.carClassId) && car.carClassConfidence === "verified"
          ).length,
          inferredCarClassCount: resolution.allowedCars.filter(
            (car) => Number.isInteger(car.carClassId) && car.carClassConfidence === "inferred"
          ).length,
          unresolvedCarNames: resolution.unresolvedCarNames,
          unresolvedTrackCount: schedule.filter((row) => !resolveTrack(row)).length,
          remoteCategory: remoteSeries.category || "Unranked",
          remoteSeriesId: remoteSeries.id,
          seasonCode,
          schedule,
          warnings
        }
      ];
    })
  );

  products = {
    [seasonCode]: Object.fromEntries(seriesEntries)
  };
}

async function init() {
  setStatus("Loading latest community season data...");

  try {
    await loadProducts();
  } catch (err) {
    setStatus(`Failed to load season data: ${err.message}`, true);
    return;
  }

  refreshSeasonChoices();
  refreshSeriesChoices();
  refreshCarChoices();
  refreshOutputFileName();
  logSelectedSeriesScheduleToConsole();
  applySelectionStatus();
}

selectorForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await downloadJson(seasonSelect.value, seriesSelect.value);
});

seasonSelect.addEventListener("change", () => {
  refreshSeriesChoices();
  refreshCarChoices();
  refreshOutputFileName();
  logSelectedSeriesScheduleToConsole();
  applySelectionStatus();
});

seriesSelect.addEventListener("change", () => {
  refreshCarChoices();
  refreshOutputFileName();
  logSelectedSeriesScheduleToConsole();
  applySelectionStatus();
});

init();
