export const $ = (id) => document.getElementById(id);
export const element = (tag, text, className) => {
  const item = document.createElement(tag);
  if (text !== undefined) item.textContent = text;
  if (className) item.className = className;
  return item;
};
const cache = new Map();
export function json(path) {
  if (!cache.has(path)) {
    cache.set(
      path,
      fetch(path)
        .then((response) => {
          if (!response.ok) throw Error("Unable to load " + path);
          return response.json();
        })
        .catch((error) => {
          cache.delete(path);
          throw error;
        }),
    );
  }
  return cache.get(path);
}
export function fragment(values) {
  const entries = Object.entries(values).filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  );
  return "#" + new URLSearchParams(entries);
}
export function options(select, entries, value) {
  select.replaceChildren(...entries.map(([id, label]) => new Option(label, id)));
  select.value = value;
}
export function modeName(mode) {
  return mode === "ab" ? "A/B" : "Yes/no";
}
export function name(catalog, id) {
  return catalog.models[id] || id;
}
export function rate(value) {
  return Number.isFinite(value)
    ? value.toLocaleString("en-US", { style: "percent", maximumFractionDigits: 2 })
    : "Unavailable";
}
export function details(label, child) {
  const box = element("details");
  box.append(element("summary", label), child);
  return box;
}
export function anchor(label, url) {
  const link = element("a", label);
  link.href = url;
  return link;
}
