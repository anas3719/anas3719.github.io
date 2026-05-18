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

const portfolioWorks = window.portfolioWorks || {};
const works = Array.isArray(portfolioWorks)
  ? { regular: portfolioWorks, ugc: [] }
  : {
      regular: portfolioWorks.regular || [],
      ugc: portfolioWorks.ugc || [],
    };
const workGrid = document.querySelector("#workGrid");
const workTabs = document.querySelectorAll("[data-work-category]");
const showMoreWorks = document.querySelector("#showMoreWorks");
const videoModal = document.querySelector("#videoModal");
const videoFrame = document.querySelector("#videoFrame");
const videoModalTitle = document.querySelector("#videoModalTitle");
const videoExternalLink = document.querySelector("#videoExternalLink");
const initialWorksCount = 18;
const workCategoryLabels = {
  regular: "إعلانات عادية",
  ugc: "UGC",
};
let activeWorkCategory = works.regular.length ? "regular" : "ugc";
let visibleWorksCount = initialWorksCount;

function createWorkCard(work, index) {
  const card = document.createElement("button");
  card.className = "work-card";
  card.type = "button";
  card.dataset.workIndex = index;
  card.dataset.workType = work.type || "video";

  const brand = document.createElement("span");
  brand.className = "work-card__brand";
  brand.textContent = work.brand;

  const type = document.createElement("span");
  type.className = "work-card__type";
  type.textContent = workCategoryLabels[activeWorkCategory] || "أعمال";

  const play = document.createElement("span");
  play.className = "work-card__play";
  play.setAttribute("aria-hidden", "true");
  play.textContent = work.type === "folder" ? "↗" : "▶";

  const label = document.createElement("span");
  label.className = "work-card__label";
  label.textContent = work.type === "folder" ? "فتح مجلد البراند" : "مشاهدة الإعلان";

  card.append(type, brand, play, label);
  card.addEventListener("click", () => openWork(work));
  return card;
}

function getActiveWorks() {
  return works[activeWorkCategory] || [];
}

function renderWorks() {
  if (!workGrid) return;

  const activeWorks = getActiveWorks();
  workGrid.textContent = "";
  workGrid.setAttribute(
    "aria-label",
    `${workCategoryLabels[activeWorkCategory] || "الأعمال"} - أعمال فيديو سابقة`,
  );
  activeWorks.slice(0, visibleWorksCount).forEach((work, index) => {
    workGrid.appendChild(createWorkCard(work, index));
  });

  if (showMoreWorks) {
    showMoreWorks.hidden = visibleWorksCount >= activeWorks.length;
  }
}

function openWork(work) {
  if (work.type === "folder") {
    window.open(work.url, "_blank", "noopener,noreferrer");
    return;
  }

  openVideo(work);
}

function openVideo(work) {
  if (!videoModal || !videoFrame || !videoModalTitle || !videoExternalLink) return;
  if (!work.preview) return;

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

function setWorkCategory(category) {
  if (!works[category] || category === activeWorkCategory) return;

  activeWorkCategory = category;
  visibleWorksCount = initialWorksCount;
  closeVideo();

  workTabs.forEach((tab) => {
    const isActive = tab.dataset.workCategory === category;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  renderWorks();
}

if (showMoreWorks) {
  showMoreWorks.addEventListener("click", () => {
    visibleWorksCount += 18;
    renderWorks();
  });
}

workTabs.forEach((tab) => {
  tab.addEventListener("click", () => setWorkCategory(tab.dataset.workCategory));
});

document.querySelectorAll("[data-close-video]").forEach((control) => {
  control.addEventListener("click", closeVideo);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeVideo();
});

renderWorks();
