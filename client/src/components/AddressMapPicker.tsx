import { useCallback, useEffect, useRef, useState } from "react";
import { loadGoogleMapsScript } from "@/utils/loadGoogleMaps";

export type MapAddress = {
  formatted: string;
  lat: number;
  lng: number;
};

type Props = {
  label: string;
  value: MapAddress | null;
  onChange: (v: MapAddress) => void;
  disabled?: boolean;
};

async function reverseGeocodeOpenStreetMap(lat: number, lng: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "AuroraGadgetsShop/1.0 (address-picker)",
    },
  });
  if (!res.ok) {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
  const j = (await res.json()) as { display_name?: string };
  return j.display_name ?? `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

export function AddressMapPicker({
  label,
  value,
  onChange,
  disabled,
}: Props) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [manualText, setManualText] = useState(value?.formatted ?? "");
  const [latIn, setLatIn] = useState(value ? String(value.lat) : "");
  const [lngIn, setLngIn] = useState(value ? String(value.lng) : "");
  const [mapErr, setMapErr] = useState<string | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);

  useEffect(() => {
    if (value) {
      setManualText(value.formatted);
      setLatIn(String(value.lat));
      setLngIn(String(value.lng));
    }
  }, [value?.formatted, value?.lat, value?.lng]);

  const applyCoords = useCallback(async (lat: number, lng: number) => {
    const formatted = await reverseGeocodeOpenStreetMap(lat, lng);
    onChangeRef.current({ lat, lng, formatted });
    setManualText(formatted);
    setLatIn(String(lat));
    setLngIn(String(lng));
    if (markerRef.current) {
      markerRef.current.setPosition({ lat, lng });
    }
    if (mapObjRef.current) {
      mapObjRef.current.panTo({ lat, lng });
    }
  }, []);

  useEffect(() => {
    if (!apiKey || disabled || !mapRef.current) {
      return;
    }
    let cancelled = false;
    void loadGoogleMapsScript(apiKey)
      .then(() => {
        if (cancelled || !mapRef.current) {
          return;
        }
        const lat = value?.lat ?? 23.8103;
        const lng = value?.lng ?? 90.4125;
        const map = new google.maps.Map(mapRef.current, {
          center: { lat, lng },
          zoom: 14,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        mapObjRef.current = map;
        const marker = new google.maps.Marker({
          position: { lat, lng },
          map,
          draggable: true,
        });
        markerRef.current = marker;
        const geocoder = new google.maps.Geocoder();
        const syncFromMarker = () => {
          const p = marker.getPosition();
          if (!p) {
            return;
          }
          geocoder.geocode({ location: p }, (results, status) => {
            if (status === "OK" && results?.[0]) {
              onChangeRef.current({
                lat: p.lat(),
                lng: p.lng(),
                formatted: results[0].formatted_address ?? "",
              });
              setManualText(results[0].formatted_address ?? "");
              setLatIn(String(p.lat()));
              setLngIn(String(p.lng()));
            } else {
              void applyCoords(p.lat(), p.lng());
            }
          });
        };
        marker.addListener("dragend", syncFromMarker);
        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) {
            return;
          }
          marker.setPosition(e.latLng);
          syncFromMarker();
        });
      })
      .catch(() => setMapErr("Could not load Google Maps."));

    return () => {
      cancelled = true;
      mapObjRef.current = null;
      markerRef.current = null;
    };
  }, [apiKey, disabled, applyCoords]);

  function useGps() {
    if (!navigator.geolocation) {
      setMapErr("Geolocation is not supported in this browser.");
      return;
    }
    setGpsBusy(true);
    setMapErr(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await applyCoords(pos.coords.latitude, pos.coords.longitude);
        } finally {
          setGpsBusy(false);
        }
      },
      () => {
        setGpsBusy(false);
        setMapErr(
          "Could not read GPS location. Allow location access or pick on the map."
        );
      },
      { enableHighAccuracy: true, timeout: 15_000 }
    );
  }

  function applyManual() {
    const lat = Number(latIn);
    const lng = Number(lngIn);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setMapErr("Enter valid latitude and longitude.");
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setMapErr("Coordinates are out of range.");
      return;
    }
    onChange({
      lat,
      lng,
      formatted: manualText.trim() || `${lat}, ${lng}`,
    });
    setMapErr(null);
    if (markerRef.current) {
      markerRef.current.setPosition({ lat, lng });
    }
    if (mapObjRef.current) {
      mapObjRef.current.panTo({ lat, lng });
    }
  }

  return (
    <fieldset className="space-y-2 rounded-xl border border-border p-3" disabled={disabled}>
      <legend className="px-1 text-sm font-medium text-ink">{label}</legend>
      {apiKey ? (
        <>
          <p className="text-xs text-muted">
            Click the map or drag the pin to set the location. Use GPS to jump to your device
            position.
          </p>
          {mapErr ? <p className="text-xs text-red-600">{mapErr}</p> : null}
          <div ref={mapRef} className="h-48 w-full rounded-lg bg-bg md:h-56" />
        </>
      ) : (
        <>
          <p className="text-xs text-muted">
            Add <code className="text-ink">VITE_GOOGLE_MAPS_API_KEY</code> for an interactive map.
            You can still enter the address and coordinates manually, or use GPS to fill
            coordinates.
          </p>
          {mapErr ? <p className="text-xs text-red-600">{mapErr}</p> : null}
        </>
      )}
      <div>
        <label className="text-xs font-medium text-muted">Address (full text)</label>
        <textarea
          className="mt-1 min-h-20 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          placeholder="Street, area, city, postal code…"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">
          Latitude
          <input
            type="number"
            step="any"
            className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-2 text-sm"
            value={latIn}
            onChange={(e) => setLatIn(e.target.value)}
          />
        </label>
        <label className="text-xs text-muted">
          Longitude
          <input
            type="number"
            step="any"
            className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-2 text-sm"
            value={lngIn}
            onChange={(e) => setLngIn(e.target.value)}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void useGps()}
          disabled={gpsBusy || disabled}
          className="rounded-lg border border-border bg-bg px-3 py-2 text-xs font-medium hover:bg-surface disabled:opacity-50"
        >
          {gpsBusy ? "Getting location…" : "Use device GPS"}
        </button>
        <button
          type="button"
          onClick={() => applyManual()}
          disabled={disabled}
          className="rounded-lg bg-ink px-3 py-2 text-xs font-medium text-white hover:opacity-90"
        >
          Apply coordinates
        </button>
      </div>
    </fieldset>
  );
}
