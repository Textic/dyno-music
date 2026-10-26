// Entry point of the mini player window (mini.html): the player island on its own.

import { createPinia } from "pinia";
import { createApp } from "vue";
import MiniPlayer from "./MiniPlayer.vue";
import { usePlayerStore } from "./stores/player";
import "./styles.css";

createApp(MiniPlayer).use(createPinia()).mount("#app");

const player = usePlayerStore();
player.start().catch((err) => player.log({ level: "error", message: String(err) }));
