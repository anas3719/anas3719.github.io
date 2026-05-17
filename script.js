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

const works = window.portfolioWorks || [];
const workGrid = document.querySelector("#workGrid");
const showMoreWorks = document.querySelector("#showMoreWorks");
const videoModal = document.querySelector("#videoModal");
const videoFrame = document.querySelector("#videoFrame");
const videoModalTitle = document.querySelector("#videoModalTitle");
const videoExternalLink = document.querySelector("#videoExternalLink");
const initialWorksCount = 18;
let visibleWorksCount = initialWorksCount;

function createWorkCard(work, index) {
  const card = document.createElement("button");
  card.className = "work-card";
  card.type = "button";
  card.dataset.workIndex = index;

  const brand = document.createElement("span");
  brand.className = "work-card__brand";
  brand.textContent = work.brand;

  const play = document.createElement("span");
  play.className = "work-card__play";
  play.setAttribute("aria-hidden", "true");
  play.textContent = "▶";

  const label = document.createElement("span");
  label.className = "work-card__label";
  label.textContent = "مشاهدة الإعلان";

  card.append(brand, play, label);
  card.addEventListener("click", () => openVideo(work));
  return card;
}

function renderWorks() {
  if (!workGrid) return;

  workGrid.textContent = "";
  works.slice(0, visibleWorksCount).forEach((work, index) => {
    workGrid.appendChild(createWorkCard(work, index));
  });

  if (showMoreWorks) {
    showMoreWorks.hidden = visibleWorksCount >= works.length;
  }
}

function openVideo(work) {
  if (!videoModal || !videoFrame || !videoModalTitle || !videoExternalLink) return;

  videoModalTitle.textContent = work.brand;
  videoFrame.src = work.preview;
  videoExternalLink.href = work.url;
  videoModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeVideo() {
  if (!videoModal || !videoFrame) return;

  videoModal.setAttribute("aria-hidden", "true");
  videoFrame.src = "";
  document.body.classList.remove("modal-open");
}

if (showMoreWorks) {
  showMoreWorks.addEventListener("click", () => {
    visibleWorksCount += 18;
    renderWorks();
  });
}

document.querySelectorAll("[data-close-video]").forEach((control) => {
  control.addEventListener("click", closeVideo);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeVideo();
});

renderWorks();
