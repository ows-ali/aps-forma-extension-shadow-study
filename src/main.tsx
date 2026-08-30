import { render } from "preact";
import { useState, useEffect } from "preact/hooks";
import i18n, { resolveLocale } from "./i18n/i18n";
import StandaloneLanding from "./components/StandaloneLanding.tsx";

const langOverride = new URLSearchParams(window.location.search).get("lang");
if (langOverride) {
  i18n.changeLanguage(resolveLocale(langOverride));
}

function Root() {
  const isIframe = typeof window !== "undefined" && window.self !== window.top;
  const [AppComp, setAppComp] = useState<any>(null);

  useEffect(() => {
    if (isIframe) {
      Promise.all([
        import("./app.tsx"),
        import("forma-embedded-view-sdk/auto"),
      ])
        .then(([appMod, formaMod]) => {
          setAppComp(() => appMod.default);

          // Register Forma locale update listener safely inside iframe
          const Forma = formaMod.Forma as typeof formaMod.Forma & {
            onLocaleUpdate?: (handler: (payload: { locale: string }) => void) => Promise<unknown>;
            createSubscription?: (
              name: string,
              handler: (payload: { locale: string }) => void,
            ) => Promise<{ unsubscribe: () => void }>;
          };

          const onLocale = ({ locale }: { locale: string }) => {
            i18n.changeLanguage(resolveLocale(locale));
          };

          if (typeof Forma.onLocaleUpdate === "function") {
            void Forma.onLocaleUpdate(onLocale);
          } else if (typeof Forma.createSubscription === "function") {
            void Forma.createSubscription("on-locale-update", onLocale);
          }
        })
        .catch((err) => {
          console.warn("Could not load embedded Forma App:", err);
        });
    }
  }, [isIframe]);

  if (isIframe && AppComp) {
    const Component = AppComp;
    return <Component />;
  }

  if (isIframe) {
    return null;
  }

  return <StandaloneLanding />;
}

render(<Root />, document.getElementById("app")!);
