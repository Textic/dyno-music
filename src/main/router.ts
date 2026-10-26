import { createRouter, createWebHashHistory } from "vue-router";
import HomeView from "./views/HomeView.vue";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/search", name: "search", component: () => import("./views/SearchView.vue") },
    { path: "/library/:tab?", name: "library", component: () => import("./views/LibraryView.vue") },
    { path: "/history", name: "history", component: () => import("./views/HistoryView.vue") },
    { path: "/settings", name: "settings", component: () => import("./views/SettingsView.vue") },
    /** Albums, playlists, artists and "See all" pages, by InnerTube browse id. */
    { path: "/browse/:id", name: "browse", component: () => import("./views/BrowseView.vue") },
  ],
});
