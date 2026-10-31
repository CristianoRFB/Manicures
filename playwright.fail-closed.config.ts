import {defineConfig,devices} from "@playwright/test";

/** No Firebase configured and DEMO explicitly off: real deployments must fail closed. */
export default defineConfig({
  testDir:"./tests/browser",
  testMatch:"live-fail-closed.spec.ts",
  timeout:30_000,
  retries:1,
  fullyParallel:false,
  reporter:[["list"]],
  use:{baseURL:"http://127.0.0.1:5175",trace:"retain-on-failure",screenshot:"only-on-failure"},
  projects:[
    {name:"desktop-live-guard",use:{...devices["Desktop Chrome"]}},
    {name:"mobile-live-guard",use:{...devices["iPhone 13"],browserName:"chromium"}},
  ],
  webServer:{
    command:"npm run dev -- --host 127.0.0.1 --port 5175 --strictPort",
    url:"http://127.0.0.1:5175",
    reuseExistingServer:false,
    timeout:60_000,
    env:{...process.env,VITE_DEMO_MODE:"false",VITE_USE_FIREBASE_EMULATORS:"false",
      VITE_FIREBASE_API_KEY:"",VITE_FIREBASE_AUTH_DOMAIN:"",
      VITE_FIREBASE_PROJECT_ID:"",VITE_FIREBASE_APP_ID:"",
      VITE_FIREBASE_STORAGE_BUCKET:"",VITE_FIREBASE_MESSAGING_SENDER_ID:""},
  },
});
