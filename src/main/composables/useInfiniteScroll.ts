import { onBeforeUnmount, ref, shallowRef, watch } from "vue";

/**
 * Calls `load` whenever the sentinel element scrolls into view (with some margin), as long as
 * `hasMore` says there is more and no load is already running. Bind it with `:ref="sentinel"`.
 */
export function useInfiniteScroll(load: () => Promise<void>, hasMore: () => boolean) {
  const element = shallowRef<Element | null>(null);
  const sentinel = (el: unknown) => {
    element.value = el instanceof Element ? el : null;
  };
  const loadingMore = ref(false);
  let observer: IntersectionObserver | null = null;

  async function trigger(): Promise<void> {
    if (loadingMore.value || !hasMore()) return;
    loadingMore.value = true;
    try {
      await load();
    } finally {
      loadingMore.value = false;
    }
    // Still in view after loading (short pages)? Observing again re-reports it.
    if (observer && element.value) {
      observer.unobserve(element.value);
      observer.observe(element.value);
    }
  }

  watch(element, (el) => {
    observer?.disconnect();
    if (!el) return;
    observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void trigger();
    }, { rootMargin: "600px" });
    observer.observe(el);
  });

  onBeforeUnmount(() => observer?.disconnect());
  return { sentinel, loadingMore };
}
