import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.arnaventerprises.aems",
  appName: "AEMS",
  webDir: "out",
  server: {
    url: "https://www.arnav-enterprises.com",
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#0F172A",
    },
  },
};

export default config;
