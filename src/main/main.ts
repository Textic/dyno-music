import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";
import { usePlayerStore } from "./stores/player";
import "./styles.css";

const app = createApp(App).use(createPinia()).use(router);
app.mount("#app");

const player = usePlayerStore();
player.start().catch((err) => player.log({ level: "error", message: String(err) }));
