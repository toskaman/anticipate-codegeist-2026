import React, { useEffect, useState } from "react";
import { ForgeClient } from "./api/ForgeClient";
import CoreWorkspace from "./CoreWorkspace";
import "./style.css";
const client = new ForgeClient(async (resolver, input) =>
  (await import("@forge/bridge")).invoke(resolver, input),
);
export default function ForgeApp() {
  const [theme, setTheme] = useState("light");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    const sync = () =>
      setTheme(
        document.documentElement.getAttribute("data-color-mode") === "dark"
          ? "dark"
          : "light",
      );
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-color-mode"],
    });
    import("@forge/bridge")
      .then(({ view }) => view.theme.enable())
      .then(() => {
        if (active) sync();
      })
      .catch(() => {
        if (active)
          setNotice(
            "Host theme unavailable outside a supported Forge installation.",
          );
      });
    return () => {
      active = false;
      observer.disconnect();
    };
  }, []);
  return <CoreWorkspace client={client} theme={theme} hostNotice={notice} />;
}
