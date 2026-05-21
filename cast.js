const castMembers = Array.isArray(window.castMembers) ? window.castMembers : [];
const castSections = document.querySelector("#castSections");
const castQuickLinks = document.querySelector("#castQuickLinks");
const castCategoryCards = document.querySelector("#castCategoryCards");
const castOverview = document.querySelector("#castOverview");
const selectedSummary = document.querySelector("#selectedSummary");
const sendCastRequest = document.querySelector("#sendCastRequest");
const selectedCast = new Set();
const whatsappNumber = "966599599527";
const missingValue = "يضاف لاحقًا";
const isCastHomePage = document.body.classList.contains("cast-home-page");

const categories = [
  { key: "men", label: "شباب", anchor: "men", group: "شباب" },
  { key: "women", label: "بنات", anchor: "women", group: "بنات" },
  { key: "boys", label: "اطفال اولاد", anchor: "boys", group: "اطفال" },
  { key: "girls", label: "اطفال بنات", anchor: "girls", group: "اطفال" },
  { key: "seniorMen", label: "كبار سن رجال", anchor: "senior-men", group: "كبار سن" },
  { key: "seniorWomen", label: "كبار سن سيدات", anchor: "senior-women", group: "كبار سن" },
];

const mainCategories = [
  {
    label: "شباب",
    href: "cast-men.html",
    description: "كل ملفات كاست الشباب في صفحة مستقلة.",
    keys: ["men"],
  },
  {
    label: "بنات",
    href: "cast-women.html",
    description: "كل ملفات كاست البنات في صفحة مستقلة.",
    keys: ["women"],
  },
  {
    label: "اطفال اولاد",
    href: "cast-boys.html",
    description: "ملفات اطفال الاولاد في صفحة مستقلة.",
    keys: ["boys"],
  },
  {
    label: "اطفال بنات",
    href: "cast-girls.html",
    description: "ملفات اطفال البنات في صفحة مستقلة.",
    keys: ["girls"],
  },
  {
    label: "كبار سن رجال",
    href: "cast-senior-men.html",
    description: "قسم مستقل لكبار سن رجال عند إضافة الأسماء له.",
    keys: ["seniorMen"],
  },
  {
    label: "كبار سن سيدات",
    href: "cast-senior-women.html",
    description: "قسم مستقل لكبار سن سيدات عند إضافة الأسماء له.",
    keys: ["seniorWomen"],
  },
];

const categoryLabels = categories.reduce((labels, category) => {
  labels[category.key] = category.label;
  return labels;
}, {});

function getDisplayValue(value, emptyValue = missingValue) {
  return value && String(value).trim() ? value : emptyValue;
}

function hasCompleteDetails(member) {
  return ["age", "height", "weight", "nationality", "speaking"].every((key) =>
    member[key] && String(member[key]).trim(),
  );
}

function getCompletionOrder(member, originalIndex) {
  const order = Number(member.completedOrder);
  return Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER + originalIndex;
}

function getMembersByCategory(categoryKey) {
  return castMembers
    .map((member, index) => ({ member, index }))
    .filter(({ member }) => member.category === categoryKey)
    .sort((first, second) => {
      const firstComplete = hasCompleteDetails(first.member);
      const secondComplete = hasCompleteDetails(second.member);

      if (firstComplete !== secondComplete) {
        return firstComplete ? -1 : 1;
      }

      if (firstComplete && secondComplete) {
        return (
          getCompletionOrder(first.member, first.index) -
            getCompletionOrder(second.member, second.index) ||
          first.index - second.index
        );
      }

      return first.index - second.index;
    })
    .map(({ member }) => member);
}

function getDisplayPhotoUrl(photoUrl) {
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

function createInfoItem(label, value, emptyValue = missingValue) {
  const wrapper = document.createElement("div");
  const term = document.createElement("dt");
  const detail = document.createElement("dd");

  term.textContent = label;
  detail.textContent = getDisplayValue(value, emptyValue);
  wrapper.append(term, detail);
  return wrapper;
}

function createMedia(member) {
  const mediaLink = document.createElement("a");
  mediaLink.className = "cast-card__media";
  mediaLink.href = member.folderUrl;
  mediaLink.target = "_blank";
  mediaLink.rel = "noreferrer";
  mediaLink.setAttribute("aria-label", `فتح ملف ${member.name} في Google Drive`);

  if (member.photoUrl) {
    const image = document.createElement("img");
    image.src = getDisplayPhotoUrl(member.photoUrl);
    image.alt = `صورة ${member.name}`;
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => {
      const fallback = document.createElement("div");
      fallback.className = "cast-card__fallback";
      fallback.textContent = member.name;
      mediaLink.replaceChildren(fallback);
    });
    mediaLink.appendChild(image);
    return mediaLink;
  }

  const fallback = document.createElement("div");
  fallback.className = "cast-card__fallback";
  fallback.textContent = member.name;
  mediaLink.appendChild(fallback);
  return mediaLink;
}

function createCastCard(member) {
  const card = document.createElement("article");
  card.className = "cast-card";
  card.dataset.castId = member.id;

  const media = createMedia(member);
  const body = document.createElement("div");
  body.className = "cast-card__body";

  const header = document.createElement("div");
  header.className = "cast-card__header";

  const title = document.createElement("h3");
  title.textContent = member.name;

  const category = document.createElement("span");
  category.className = "cast-card__category";
  category.textContent = categoryLabels[member.category] || "الكاست";

  header.append(title, category);

  const infoList = document.createElement("dl");
  infoList.className = "cast-card__info";
  infoList.append(
    createInfoItem("العمر", member.age),
    createInfoItem("الطول", member.height),
    createInfoItem("الوزن", member.weight),
    createInfoItem("الجنسية", member.nationality),
    createInfoItem("متحدث/غير متحدث", member.speaking),
    createInfoItem("ملاحظة", member.note, ""),
  );

  const selectLabel = document.createElement("label");
  selectLabel.className = "cast-select";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.value = member.id;
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      selectedCast.add(member.id);
      card.classList.add("is-selected");
    } else {
      selectedCast.delete(member.id);
      card.classList.remove("is-selected");
    }

    updateRequestSummary();
  });

  const selectText = document.createElement("span");
  selectText.textContent = "اختيار الكاست";

  selectLabel.append(checkbox, selectText);
  body.append(header, infoList, selectLabel);
  card.append(media, body);
  return card;
}

function renderOverview() {
  if (!castOverview) return;

  const groups = [
    { label: "شباب", count: getMembersByCategory("men").length },
    { label: "بنات", count: getMembersByCategory("women").length },
    { label: "اطفال اولاد", count: getMembersByCategory("boys").length },
    { label: "اطفال بنات", count: getMembersByCategory("girls").length },
    { label: "كبار سن رجال", count: getMembersByCategory("seniorMen").length },
    { label: "كبار سن سيدات", count: getMembersByCategory("seniorWomen").length },
  ];

  castOverview.replaceChildren(
    ...groups.map((group) => {
      const item = document.createElement("div");
      const number = document.createElement("strong");
      const label = document.createElement("span");
      number.textContent = group.count;
      label.textContent = group.label;
      item.append(number, label);
      return item;
    }),
  );
}

function renderQuickLinks() {
  if (!castQuickLinks) return;

  castQuickLinks.replaceChildren(
    ...categories.map((category) => {
      const link = document.createElement("a");
      link.href = `#${category.anchor}`;
      link.textContent = `${category.label} (${getMembersByCategory(category.key).length})`;
      return link;
    }),
  );
}

function renderCategoryCards() {
  if (!castCategoryCards) return;

  castCategoryCards.replaceChildren(
    ...mainCategories.map((category) => {
      const count = category.keys.reduce((total, key) => total + getMembersByCategory(key).length, 0);
      const card = document.createElement("a");
      const title = document.createElement("strong");
      const meta = document.createElement("span");
      const description = document.createElement("p");
      const action = document.createElement("em");

      card.className = "cast-category-card";
      card.href = category.href;
      card.setAttribute("aria-label", `فتح قسم ${category.label}`);
      title.textContent = category.label;
      meta.textContent = `${count} ملف`;
      description.textContent = category.description;
      action.textContent = "فتح القسم";

      if (isCastHomePage) {
        card.append(title);
      } else {
        card.append(title, meta, description, action);
      }

      return card;
    }),
  );
}

function renderSections() {
  if (!castSections) return;

  const allowedCategories = (document.body.dataset.categories || "")
    .split(",")
    .map((category) => category.trim())
    .filter(Boolean);
  const visibleCategories = allowedCategories.length
    ? categories.filter((category) => allowedCategories.includes(category.key))
    : categories;

  const sectionNodes = visibleCategories.map((category) => {
    const members = getMembersByCategory(category.key);
    const section = document.createElement("section");
    section.id = category.anchor;
    section.className = "section cast-section";

    const heading = document.createElement("div");
    heading.className = "section-heading";

    const titleBlock = document.createElement("div");
    const eyebrow = document.createElement("p");
    const title = document.createElement("h2");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = category.group;
    title.textContent = category.label;
    titleBlock.append(eyebrow, title);

    const count = document.createElement("span");
    count.className = "cast-count";
    count.textContent = `${members.length} ملف`;
    heading.append(titleBlock, count);

    const grid = document.createElement("div");
    grid.className = "cast-grid";

    if (members.length) {
      members.forEach((member) => grid.appendChild(createCastCard(member)));
    } else {
      const empty = document.createElement("p");
      empty.className = "cast-empty";
      empty.textContent = "القسم جاهز، وسيتم نقل الأسماء له بعد المراجعة.";
      grid.appendChild(empty);
    }

    section.append(heading, grid);
    return section;
  });

  castSections.replaceChildren(...sectionNodes);
}

function updateRequestSummary() {
  if (!selectedSummary || !sendCastRequest) return;

  const selectedMembers = castMembers.filter((member) => selectedCast.has(member.id));

  if (!selectedMembers.length) {
    selectedSummary.textContent = "اختر كاست واحد أو أكثر لتجهيز رسالة واتساب.";
    sendCastRequest.href = `https://wa.me/${whatsappNumber}`;
    sendCastRequest.classList.add("is-disabled");
    sendCastRequest.setAttribute("aria-disabled", "true");
    return;
  }

  const names = selectedMembers.map((member) => `${member.name} (${categoryLabels[member.category]})`);
  selectedSummary.textContent = `تم اختيار ${selectedMembers.length}: ${names.join("، ")}`;

  const messageLines = [
    "السلام عليكم، أرغب بطلب الكاست التالي:",
    "",
    ...selectedMembers.map((member) => `- ${member.name} - ${categoryLabels[member.category]}`),
  ];

  sendCastRequest.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(messageLines.join("\n"))}`;
  sendCastRequest.classList.remove("is-disabled");
  sendCastRequest.setAttribute("aria-disabled", "false");
}

if (sendCastRequest) {
  sendCastRequest.addEventListener("click", (event) => {
    if (!selectedCast.size) {
      event.preventDefault();
    }
  });
}

renderOverview();
renderQuickLinks();
renderCategoryCards();
renderSections();
updateRequestSummary();
