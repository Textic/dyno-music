import { createRouter, createWebHashHistory } from "vue-router";
import HomeView from "./views/HomeView.vue";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/search", name: "search", component: () => import("./views/SearchView.vue") },
    { path: "/diagnostics", name: "diagnostics", component: () => import("./views/DiagnosticsView.vue") },
  ],
});
