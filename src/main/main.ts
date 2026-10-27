import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";
import { hideNativeMenu } from "./nativeMenu";
import { usePlayerStore } from "./stores/player";
import { useUpdatesStore } from "./stores/updates";
import "./styles.css";

hideNativeMenu();

const app = createApp(App).use(createPinia()).use(router);
app.mount("#app");

const player = usePlayerStore();
player.start().catch((err) => player.log({ level: "error", message: String(err) }));

// Look for a new version once things have settled; quietly, since being offline is normal.
const UPDATE_CHECK_DELAY_MS = 15_000;
setTimeout(() => void useUpdatesStore().checkNow(true), UPDATE_CHECK_DELAY_MS);

