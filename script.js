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
const imageModal = document.querySelector("#imageModal");
const imageModalPhoto = document.querySelector("#imageModalPhoto");
const imageDownloadLink = document.querySelector("#imageDownloadLink");
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
  const asset = (window.portfolioBrandAssets || {})[work.brand];
  const artwork = document.createElement("span");
  artwork.className = "work-card__artwork";
  if (asset) {
    card.classList.add("work-card--branded");
    if (asset.ink === "#ffffff") card.classList.add("work-card--light-ink");
    card.style.setProperty("--brand-background", asset.background);
    card.style.setProperty("--brand-ink", asset.ink);
    const logo = document.createElement("img");
    logo.className = "work-card__logo";
    logo.src = `assets/work-brands/${asset.file}`;
    logo.alt = "";
    logo.loading = "lazy";
    logo.decoding = "async";
    let logoFrame;
    if (asset.frame) {
      const [x, y, width, height] = asset.frame;
      logoFrame = document.createElement("span");
      logoFrame.className = "work-card__logo-frame";
      logo.style.width = `${100 / width}%`;
      logo.style.height = `${100 / height}%`;
      logo.style.left = `${-100 * x / width}%`;
      logo.style.top = `${-100 * y / height}%`;
      logo.addEventListener("load", () => {
        logoFrame.style.setProperty("--logo-ratio", (logo.naturalWidth * width) / (logo.naturalHeight * height));
      }, { once: true });
      logoFrame.append(logo);
    }
    logo.addEventListener("error", () => {
      logo.remove();
      artwork.textContent = work.brand;
      card.classList.remove("work-card--branded");
      card.classList.remove("work-card--light-ink");
      card.style.removeProperty("--brand-background");
      card.style.removeProperty("--brand-ink");
    }, { once: true });
    artwork.append(logoFrame || logo);
  } else {
    artwork.textContent = work.brand;
  }

  const brand = document.createElement("span");
  brand.className = "work-card__brand";
  brand.textContent = work.brand;

  const type = document.createElement("span");
  type.className = "work-card__type";
  type.textContent = workCategoryLabels[activeWorkCategory] || "أعمال";

  const play = document.createElement("span");
  play.className = "work-card__play";
  play.setAttribute("aria-hidden", "true");
  play.classList.add(work.type === "folder" ? "work-card__play--folder" : "work-card__play--video");
  const actionIcon = document.createElement("img");
  actionIcon.src = `assets/work-brands/${work.type === "folder" ? "folder-open" : "circle-play"}.svg`;
  actionIcon.alt = "";
  actionIcon.width = 28;
  actionIcon.height = 28;
  play.append(actionIcon);

  const footer = document.createElement("span");
  footer.className = "work-card__footer";
  footer.append(brand, play);
  card.setAttribute("aria-label", `${work.brand} - ${work.type === "folder" ? "فتح مجلد البراند" : "مشاهدة الإعلان"}`);
  card.title = card.getAttribute("aria-label");
  card.append(type, artwork, footer);
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

function openImagePreview(control) {
  if (!imageModal || !imageModalPhoto || !imageDownloadLink) return;

  const image = control.querySelector("img");
  const imageSrc = control.dataset.imageSrc;
  const downloadSrc = control.dataset.downloadSrc || imageSrc;
  if (!imageSrc || !downloadSrc) return;

  imageModalPhoto.src = imageSrc;
  imageModalPhoto.alt = image?.alt || "صورة أنس عمر";
  imageDownloadLink.href = downloadSrc;
  imageDownloadLink.setAttribute("download", control.dataset.downloadName || "anas-omar-photo.jpg");
  imageModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeImagePreview() {
  if (!imageModal || !imageModalPhoto) return;

  imageModal.setAttribute("aria-hidden", "true");
  imageModalPhoto.src = "";
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

document.querySelectorAll("[data-image-src]").forEach((control) => {
  control.addEventListener("click", () => openImagePreview(control));
});

document.querySelectorAll("[data-close-video]").forEach((control) => {
  control.addEventListener("click", closeVideo);
});

document.querySelectorAll("[data-close-image]").forEach((control) => {
  control.addEventListener("click", closeImagePreview);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeVideo();
    closeImagePreview();
  }
});

renderWorks();
