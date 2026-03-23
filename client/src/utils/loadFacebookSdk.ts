export function loadFacebookSdk(appId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.FB) {
      resolve();
      return;
    }
    const w = window as Window & {
      fbAsyncInit?: () => void;
    };
    w.fbAsyncInit = () => {
      try {
        window.FB!.init({
          appId,
          cookie: true,
          xfbml: true,
          version: "v18.0",
        });
        resolve();
      } catch (e) {
        reject(e);
      }
    };
    if (document.getElementById("facebook-jssdk")) {
      const t = setInterval(() => {
        if (window.FB) {
          clearInterval(t);
          resolve();
        }
      }, 100);
      setTimeout(() => {
        clearInterval(t);
        if (!window.FB) {
          reject(new Error("Facebook SDK timeout"));
        }
      }, 15_000);
      return;
    }
    const s = document.createElement("script");
    s.id = "facebook-jssdk";
    s.async = true;
    s.src = "https://connect.facebook.net/en_US/sdk.js";
    s.onerror = () => reject(new Error("Facebook SDK failed to load"));
    document.body.appendChild(s);
  });
}
