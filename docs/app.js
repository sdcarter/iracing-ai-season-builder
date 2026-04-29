const selectorForm = document.getElementById("selectorForm");
const seasonSelect = document.getElementById("seasonSelect");
const seriesSelect = document.getElementById("seriesSelect");
const carSelect = document.getElementById("carSelect");
const fileNameInput = document.getElementById("fileNameInput");
const statusEl = document.getElementById("status");

const CATALOG_PATHS = [
  "./assets/series-catalog.json",
  "../data/series-catalog.json"
];

const TRACK_MAP_PATHS = [
  "./assets/track-data/track-ids.lookup.json",
  "../data/track-data/track-ids.lookup.json"
];

function getSchedulePdfPaths(seasonCode) {
  const filename = `${seasonCode}.pdf`;
  return [
    `./assets/schedule/${filename}`,
    `../data/schedule/${filename}`
  ];
}

function getTemplatePaths(templateFilename) {
  return [
    `./assets/templates/${templateFilename}`,
    `../data/templates/${templateFilename}`
  ];
}

let products = {};

function getSelectedSeriesConfig() {
  const seasonBucket = products[seasonSelect.value];
  return seasonBucket && seasonBucket[seriesSelect.value] ? seasonBucket[seriesSelect.value] : null;
}

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

function buildTrackMapByKey(trackMapJson) {
  if (trackMapJson && typeof trackMapJson.trackIdsByNormalizedName === "object") {
    return trackMapJson.trackIdsByNormalizedName;
  }

  const tracks = Array.isArray(trackMapJson?.tracks) ? trackMapJson.tracks : [];
  return Object.fromEntries(
    tracks.map((track) => [normalizeTrackName(track.name), track])
  );
}

function formatSeasonCodeForPdfSearch(seasonCode) {
  const match = /^([0-9]{4})s([0-9]+)$/i.exec(seasonCode || "");
  if (!match) {
    return seasonCode;
  }

  return `${match[1]} Season ${Number.parseInt(match[2], 10)}`;
}

function getSeriesLabelCandidates(seriesConfig, seasonCode) {
  const seriesLabel = seriesConfig?.label || "";
  const explicitCandidates = ensureArray(seriesConfig?.pdfLabelCandidates || []).filter(Boolean);
  if (explicitCandidates.length > 0) {
    return explicitCandidates;
  }

  const seasonText = formatSeasonCodeForPdfSearch(seasonCode);
  return [
    `${seriesLabel} by Sim-Lab - ${seasonText}`,
    `${seriesLabel} by Sim-Lab`,
    seriesLabel
  ];
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

function resolveTrack(row, trackMapByKey) {
  const exactMatch = trackMapByKey[row.trackKey];
  if (exactMatch) {
    return exactMatch;
  }

  // If the PDF specifies a layout, require a layout-specific mapping.
  if (row.configName) {
    return null;
  }

  if (row.baseTrackKey) {
    const baseMatch = trackMapByKey[row.baseTrackKey];
    if (baseMatch) {
      return baseMatch;
    }
  }

  return null;
}

function refreshCarChoices() {
  const selectedSeries = getSelectedSeriesConfig();
  carSelect.replaceChildren();

  if (!selectedSeries || !Array.isArray(selectedSeries.allowedCars) || selectedSeries.allowedCars.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No cars configured";
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

  seasonSelect.disabled = seasonCodes.length === 0;
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

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function normalizeTrackName(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseWeekRowsFromSeriesText(seriesText) {
  const weekPattern = /Week\s+(\d+)\s+\(([^)]+)\)\s+(.+?)\n\(([^)]+)\)([\s\S]*?)(?=\nWeek\s+\d+\s+\(|$)/g;
  const rows = [];
  let match;

  while ((match = weekPattern.exec(seriesText)) !== null) {
    const weekNumber = Number(match[1]);
    const weekDate = match[2];
    const trackLabel = match[3].replace(/\s+/g, " ").trim();
    const trackParts = splitTrackLabel(trackLabel);
    const startInfo = match[4];
    const tail = match[5] || "";

    const sessionMatch = startInfo.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/);
    const tempMatch = tail.match(/(-?\d+)\u00b0F/);
    const rainMatch = tail.match(/Rain chance\s+([^,\n]+)/i);
    const minsMatch = tail.match(/(\d+)\s+mins/i);
    const lapsMatch = tail.match(/(\d+)\s+laps/i);

    rows.push({
      weekNumber,
      weekDate,
      trackLabel: trackParts.fullLabel,
      trackName: trackParts.trackName,
      configName: trackParts.configName,
      trackKey: normalizeTrackName(trackParts.fullLabel),
      baseTrackKey: normalizeTrackName(trackParts.trackName),
      simulatedStartTime:
        sessionMatch && sessionMatch[1] && sessionMatch[2]
          ? `${sessionMatch[1]}T${sessionMatch[2]}:00`
          : null,
      tempF: tempMatch ? Number(tempMatch[1]) : null,
      rainChance:
        rainMatch && rainMatch[1]
          ? rainMatch[1].toLowerCase() === "none"
            ? 0
            : Number.parseInt(rainMatch[1], 10)
          : null,
      raceLengthMinutes: minsMatch ? Number(minsMatch[1]) : null,
      raceLengthLaps: lapsMatch ? Number(lapsMatch[1]) : null
    });
  }

  return rows;
}

async function extractSeriesTextFromPdf(pdfPath, seriesLabelCandidates) {
  const loadingTask = window.pdfjsLib.getDocument(pdfPath);
  const pdf = await loadingTask.promise;
  let fallbackText = null;

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join("\n");

    const hasSeriesText = seriesLabelCandidates.some((candidate) => text.includes(candidate));
    if (hasSeriesText) {
      if (/Week\s+1\s+\(/.test(text)) {
        return text;
      }

      if (fallbackText === null) {
        fallbackText = text;
      }
    }
  }

  if (fallbackText !== null) {
    return fallbackText;
  }

  throw new Error(`Series section not found in PDF for labels: ${seriesLabelCandidates.join(" | ")}.`);
}

async function extractSeriesTextFromAnyPdf(pdfPaths, seriesLabelCandidates) {
  const orderedPaths = ensureArray(pdfPaths);
  let lastErrorMessage = "No paths configured.";

  for (const path of orderedPaths) {
    try {
      return await extractSeriesTextFromPdf(path, seriesLabelCandidates);
    } catch (error) {
      lastErrorMessage = `${path} -> ${error.message}`;
    }
  }

  throw new Error(`Could not parse schedule PDF from any path. Last failure: ${lastErrorMessage}`);
}

function createSeasonFromTemplate(templateJson, weekRows, trackMapByKey, seriesConfig, selectedCarId) {
  if (!Array.isArray(templateJson.events) || templateJson.events.length === 0) {
    throw new Error("Template has no events array to clone from.");
  }

  if (!seriesConfig || !Array.isArray(seriesConfig.allowedCars) || seriesConfig.allowedCars.length === 0) {
    throw new Error("Series has no configured car roster.");
  }

  const selectedCar = seriesConfig.allowedCars.find((car) => car.carId === selectedCarId);
  if (!selectedCar) {
    throw new Error("Selected driver car is not valid for this series.");
  }

  const unresolved = weekRows.filter((row) => {
    const mapped = resolveTrack(row, trackMapByKey);
    return !mapped || !Number.isInteger(mapped.trackId) || mapped.trackId <= 0;
  });
  if (unresolved.length > 0) {
    const missingList = unresolved.map((row) => row.trackLabel).join(" | ");
    throw new Error(`Track IDs missing for: ${missingList}`);
  }

  const baseEvent = { ...templateJson.events[0] };
  const updated = {
    ...templateJson,
    carId: selectedCar.carId,
    car_name: selectedCar.label,
    userCarClassId: selectedCar.carClassId
  };

  const newEvents = weekRows.map((row) => {
    const mappedTrack = resolveTrack(row, trackMapByKey);
    return {
      ...baseEvent,
      trackId: mappedTrack.trackId,
      eventId: crypto.randomUUID()
    };
  });

  return {
    ...updated,
    event_count: newEvents.length,
    events: newEvents,
    generatedFrom: {
      source: "runtime-template-plus-pdf",
      generatedAtUtc: new Date().toISOString(),
      weeksParsed: weekRows.length
    }
  };
}

async function downloadJson(seasonCode, seriesCode) {
  const seasonBucket = products[seasonCode];
  const item = seasonBucket && seasonBucket[seriesCode];
  const selectedCarId = Number.parseInt(carSelect.value, 10);

  if (!item) {
    setStatus("Selected season/series is not available.", true);
    return;
  }

  if (!Number.isInteger(selectedCarId) || selectedCarId <= 0) {
    setStatus("Choose the car you intend to drive.", true);
    return;
  }

  setStatus("Generating season JSON from template + PDF...");

  try {
    const [templateJson, trackMapJson] = await Promise.all([
      fetchJsonFromAnyPath(item.templatePaths),
      fetchJsonFromAnyPath(item.trackMapPaths)
    ]);
    const seriesText = await extractSeriesTextFromAnyPdf(
      item.schedulePdfPaths,
      getSeriesLabelCandidates(item, seasonCode)
    );
    const weekRows = parseWeekRowsFromSeriesText(seriesText);

    if (weekRows.length === 0) {
      throw new Error("No week rows were parsed for this series.");
    }

    const generatedJson = createSeasonFromTemplate(
      templateJson,
      weekRows,
      buildTrackMapByKey(trackMapJson),
      item,
      selectedCarId
    );
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

async function loadCatalog() {
  let lastError = "No catalog paths tried.";

  for (const path of CATALOG_PATHS) {
    try {
      const response = await fetch(path, { cache: "no-store" });
      if (response.ok) {
        const catalog = await response.json();
        products = {};

        for (const [seasonCode, seasonData] of Object.entries(catalog.seasons || {})) {
          products[seasonCode] = {};

          for (const [seriesCode, seriesData] of Object.entries(seasonData.series || {})) {
            products[seasonCode][seriesCode] = {
              label: seriesData.label,
              templatePaths: getTemplatePaths(seriesData.templateFilename),
              schedulePdfPaths: getSchedulePdfPaths(seasonCode),
              trackMapPaths: TRACK_MAP_PATHS,
              pdfLabelCandidates: seriesData.pdfLabelCandidates || [],
              allowedCars: seriesData.allowedCars || []
            };
          }
        }

        return;
      }

      lastError = `${path} -> HTTP ${response.status}`;
    } catch (err) {
      lastError = `${path} -> ${err.message}`;
    }
  }

  throw new Error(`Could not load series catalog. Last failure: ${lastError}`);
}

async function init() {
  try {
    await loadCatalog();
  } catch (err) {
    setStatus(`Failed to load series catalog: ${err.message}`, true);
    return;
  }

  refreshSeasonChoices();
  refreshSeriesChoices();
  refreshCarChoices();
  refreshOutputFileName();
}

selectorForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await downloadJson(seasonSelect.value, seriesSelect.value);
});

seasonSelect.addEventListener("change", () => {
  refreshSeriesChoices();
  refreshCarChoices();
  refreshOutputFileName();
});
seriesSelect.addEventListener("change", () => {
  refreshCarChoices();
  refreshOutputFileName();
});

init();