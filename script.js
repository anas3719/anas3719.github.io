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
  const card = document.createElement("article");
  card.className = "work-card";
  card.dataset.workIndex = index;
  card.dataset.workType = work.type || "video";
  const main = document.createElement("button");
  main.type = "button";
  main.className = "work-card__main";
  const video = getWorkVideo(work);
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

  const footer = document.createElement("span");
  footer.className = "work-card__footer";
  footer.append(brand);
  main.setAttribute("aria-label", `${work.brand} - ${video ? "تشغيل الإعلان" : "دخول المجلد"}`);
  main.title = main.getAttribute("aria-label");
  main.append(type, artwork, footer);
  main.addEventListener("click", () => openWork(work));

  const actions = document.createElement("div");
  actions.className = "work-card__actions";
  const play = createWorkAction("تشغيل الإعلان", "circle-play", () => openVideo(video));
  play.classList.add("work-action--play");
  play.disabled = !video;
  play.setAttribute("aria-label", `تشغيل إعلان ${work.brand}`);
  play.title = video ? `تشغيل إعلان ${work.brand}` : "لم يتم اختيار فيديو رئيسي";
  actions.append(play);
  if (work.type === "folder") {
    const folder = createWorkAction("دخول المجلد", "folder-open", () => window.open(work.url, "_blank", "noopener,noreferrer"));
    folder.classList.add("work-action--folder");
    folder.setAttribute("aria-label", `دخول مجلد ${work.brand}`);
    actions.append(folder);
  }
  card.append(main, actions);
  return card;
}

function createWorkAction(label, icon, onClick) {
  const action = document.createElement("button");
  action.type = "button";
  action.className = "work-action";
  const image = document.createElement("img");
  image.src = `assets/work-brands/${icon}.svg`;
  image.alt = "";
  image.width = 20;
  image.height = 20;
  const text = document.createElement("span");
  text.textContent = label;
  action.append(image, text);
  action.addEventListener("click", onClick);
  return action;
}

function getWorkVideo(work) {
  if (work.type !== "folder") return work.preview ? work : null;
  try {
    const url = new URL(work.featuredVideo?.url);
    const id = url.pathname.match(/^\/file\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1];
    if (url.protocol !== "https:" || url.hostname !== "drive.google.com" || !id) return null;
    const preview = new URL(`https://drive.google.com/file/d/${id}/preview`);
    const resourceKey = url.searchParams.get("resourcekey");
    if (resourceKey) preview.searchParams.set("resourcekey", resourceKey);
    return { brand: work.brand, url: url.href, preview: preview.href };
  } catch (error) {
    return null;
  }
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
  const video = getWorkVideo(work);
  if (video) {
    openVideo(video);
    return;
  }
  if (work.type === "folder") {
    window.open(work.url, "_blank", "noopener,noreferrer");
    return;
  }

  openVideo(work);
}

function openVideo(work) {
  if (!videoModal || !videoFrame || !videoModalTitle || !videoExternalLink) return;
  if (!work?.preview) return;

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
