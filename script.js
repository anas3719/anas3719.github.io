const fallbackLabels = {
  hero: "Portfolio",
};

document.querySelectorAll("img[data-fallback]").forEach((image) => {
  image.addEventListener("error", () => {
    const label = fallbackLabels[image.dataset.fallback] || image.dataset.fallback;
    const fallback = document.createElement("div");
    fallback.className = "image-fallback";
    fallback.setAttribute("role", "img");
    fallback.setAttribute("aria-label", image.alt);
    fallback.textContent = label;
    image.replaceWith(fallback);
  });
});
