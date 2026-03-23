export function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (window.google?.maps) {
    return Promise.resolve();
  }
  const existing = document.querySelector(
    'script[data-shop-google-maps="1"]'
  ) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      if (window.google?.maps) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Google Maps script failed")),
        { once: true }
      );
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.dataset.shopGoogleMaps = "1";
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps script failed"));
    document.head.appendChild(script);
  });
}
