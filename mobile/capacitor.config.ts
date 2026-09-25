import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "za.co.acapoliteconsulting.app",
  appName: "Acapolite",
  webDir: "../dist",
  server: {
    androidScheme: "https"
  },
  android: {
    allowMixedContent: false
  }
};

export default config;
