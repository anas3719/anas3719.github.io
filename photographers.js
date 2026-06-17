const photographers = Array.isArray(window.photographers) ? window.photographers : [];
const photographersGrid = document.querySelector("#photographersGrid");
const photographerSelectedSummary = document.querySelector("#photographerSelectedSummary");
const sendPhotographerRequest = document.querySelector("#sendPhotographerRequest");
const photographerById = new Map(photographers.map((photographer) => [photographer.id, photographer]));
const photographerSelectionStorageKey = "anas-photographer-selection-v1";
const selectedPhotographers = new Set(loadStoredPhotographerSelection());
const whatsappNumber = "966599599527";

function loadStoredPhotographerSelection() {
  try {
    const storedIds = JSON.parse(
      window.localStorage.getItem(photographerSelectionStorageKey) || "[]",
    );

    if (!Array.isArray(storedIds)) {
      return [];
    }

    return storedIds.filter((id) => photographerById.has(id));
  } catch (error) {
    return [];
  }
}

function saveStoredPhotographerSelection() {
  try {
    window.localStorage.setItem(
      photographerSelectionStorageKey,
      JSON.stringify([...selectedPhotographers].filter((id) => photographerById.has(id))),
    );
  } catch (error) {
    // The page still works without persisted selections if storage is unavailable.
  }
}

function getSelectedPhotographers() {
  return photographers.filter((photographer) => selectedPhotographers.has(photographer.id));
}

function buildPhotographerWhatsAppHref(selectedItems) {
  if (!selectedItems.length) {
    return `https://wa.me/${whatsappNumber}`;
  }

  const messageLines = [
    "السلام عليكم، أرغب بطلب المصورين التاليين:",
    "",
    ...selectedItems.map((photographer) => `- ${photographer.name}`),
  ];

  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(messageLines.join("\n"))}`;
}

function updatePhotographerRequestSummary() {
  const selectedItems = getSelectedPhotographers();
  const count = selectedItems.length;

  if (photographerSelectedSummary) {
    photographerSelectedSummary.textContent = count
      ? `تم اختيار ${count} من المصورين: ${selectedItems.map((photographer) => photographer.name).join("، ")}`
      : "اختر مصور واحد أو أكثر لتجهيز رسالة واتساب.";
  }

  if (sendPhotographerRequest) {
    sendPhotographerRequest.href = buildPhotographerWhatsAppHref(selectedItems);
    sendPhotographerRequest.classList.toggle("is-disabled", !count);
    sendPhotographerRequest.setAttribute("aria-disabled", count ? "false" : "true");
  }
}

function syncPhotographerCards() {
  document.querySelectorAll(".photographer-card").forEach((card) => {
    const isSelected = selectedPhotographers.has(card.dataset.photographerId);
    const checkbox = card.querySelector('input[type="checkbox"]');

    card.classList.toggle("is-selected", isSelected);
    if (checkbox) {
      checkbox.checked = isSelected;
    }
  });
}

function getPhotographerPhotoUrl(photoUrl) {
  if (!photoUrl) return "";

  try {
    const url = new URL(photoUrl);
    const driveId = url.searchParams.get("id");

    if (url.hostname === "drive.google.com" && driveId) {
      return `https://lh3.googleusercontent.com/d/${driveId}=w1000`;
    }
  } catch (error) {
    return photoUrl;
  }

  return photoUrl;
}

function createPhotographerCard(photographer) {
  const card = document.createElement("article");
  const media = document.createElement("a");
  const body = document.createElement("div");
  const name = document.createElement("a");
  const badge = document.createElement("span");
  const workLink = document.createElement("a");
  const selectLabel = document.createElement("label");
  const selectText = document.createElement("span");
  const checkbox = document.createElement("input");

  card.className = "photographer-card";
  card.dataset.photographerId = photographer.id;

  media.className = "photographer-card__media";
  media.href = photographer.folderUrl;
  media.target = "_blank";
  media.rel = "noreferrer";
  media.setAttribute("aria-label", `فتح ملف ${photographer.name}`);

  if (photographer.photoUrl) {
    const image = document.createElement("img");
    const fallback = document.createElement("span");

    image.src = getPhotographerPhotoUrl(photographer.photoUrl);
    image.alt = photographer.name;
    image.loading = "lazy";
    fallback.className = "photographer-card__fallback";
    fallback.textContent = photographer.name;

    image.addEventListener(
      "error",
      () => {
        media.replaceChildren(fallback);
      },
      { once: true },
    );

    media.appendChild(image);
  } else {
    const fallback = document.createElement("span");
    fallback.className = "photographer-card__fallback";
    fallback.textContent = photographer.name;
    media.appendChild(fallback);
  }

  body.className = "photographer-card__body";
  name.className = "photographer-card__name";
  name.href = photographer.folderUrl;
  name.target = "_blank";
  name.rel = "noreferrer";
  name.textContent = photographer.name;
  badge.textContent = "مصور";
  workLink.className = "photographer-card__work-link";
  workLink.href = photographer.folderUrl;
  workLink.target = "_blank";
  workLink.rel = "noreferrer";
  workLink.textContent = "اضغط لرؤية الاعمال";

  selectLabel.className = "photographer-select";
  selectText.textContent = "اختيار المصور";
  checkbox.type = "checkbox";
  checkbox.checked = selectedPhotographers.has(photographer.id);
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      selectedPhotographers.add(photographer.id);
    } else {
      selectedPhotographers.delete(photographer.id);
    }

    saveStoredPhotographerSelection();
    syncPhotographerCards();
    updatePhotographerRequestSummary();
  });
  selectLabel.append(selectText, checkbox);

  body.append(name, badge, workLink, selectLabel);
  card.append(media, body);

  return card;
}

if (photographersGrid) {
  photographersGrid.replaceChildren(...photographers.map(createPhotographerCard));
  syncPhotographerCards();
  updatePhotographerRequestSummary();
}
