// Entry point of the mini player window (mini.html): the player island on its own.

import { createPinia } from "pinia";
import { createApp } from "vue";
import MiniPlayer from "./MiniPlayer.vue";
import { hideNativeMenu } from "./nativeMenu";
import { reportErrors } from "./reportErrors";
import { usePlayerStore } from "./stores/player";
import "./styles.css";

hideNativeMenu();

const app = createApp(MiniPlayer).use(createPinia());
reportErrors(app);
app.mount("#app");

const player = usePlayerStore();
player.start().catch((err) => player.log({ level: "error", message: String(err) }));
