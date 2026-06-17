const photographers = Array.isArray(window.photographers) ? window.photographers : [];
const photographersGrid = document.querySelector("#photographersGrid");

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
  const card = document.createElement("a");
  const media = document.createElement("div");
  const body = document.createElement("div");
  const name = document.createElement("h3");
  const badge = document.createElement("span");

  card.className = "photographer-card";
  card.href = photographer.folderUrl;
  card.target = "_blank";
  card.rel = "noreferrer";
  card.setAttribute("aria-label", `فتح ملف ${photographer.name}`);

  media.className = "photographer-card__media";

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
  name.textContent = photographer.name;
  badge.textContent = "مصور";
  body.append(name, badge);
  card.append(media, body);

  return card;
}

if (photographersGrid) {
  photographersGrid.replaceChildren(...photographers.map(createPhotographerCard));
}
