const castMembers = Array.isArray(window.castMembers) ? window.castMembers : [];
const castSections = document.querySelector("#castSections");
const castQuickLinks = document.querySelector("#castQuickLinks");
const castCategoryCards = document.querySelector("#castCategoryCards");
const castOverview = document.querySelector("#castOverview");
const selectedSummary = document.querySelector("#selectedSummary");
const sendCastRequest = document.querySelector("#sendCastRequest");
const whatsappNumber = "966599599527";
const missingValue = "يضاف لاحقًا";
const isCastHomePage = document.body.classList.contains("cast-home-page");
const memberById = new Map(castMembers.map((member) => [member.id, member]));
const selectionStorageKey = "anas-cast-selection-v1";
const selectedCast = new Set(loadStoredSelection());

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

function loadStoredSelection() {
  try {
    const storedValue = window.localStorage.getItem(selectionStorageKey);
    const storedIds = JSON.parse(storedValue || "[]");

    if (!Array.isArray(storedIds)) {
      return [];
    }

    return storedIds.filter((id) => memberById.has(id));
  } catch (error) {
    return [];
  }
}

function saveStoredSelection() {
  try {
    window.localStorage.setItem(
      selectionStorageKey,
      JSON.stringify([...selectedCast].filter((id) => memberById.has(id))),
    );
  } catch (error) {
    // The page still works without persisted selections if storage is unavailable.
  }
}

function setMemberSelected(memberId, isSelected) {
  if (!memberById.has(memberId)) return;

  if (isSelected) {
    selectedCast.add(memberId);
  } else {
    selectedCast.delete(memberId);
  }

  saveStoredSelection();
}

function getSelectedMembers() {
  return categories.flatMap((category) =>
    getMembersByCategory(category.key).filter((member) => selectedCast.has(member.id)),
  );
}

function groupSelectedMembers(selectedMembers) {
  return categories
    .map((category) => ({
      ...category,
      members: selectedMembers.filter((member) => member.category === category.key),
    }))
    .filter((group) => group.members.length);
}

function getSelectionSummary(groups, selectedCount) {
  if (!selectedCount) {
    return "اختر كاست واحد أو أكثر من أي قسم، وتبقى اختياراتك محفوظة أثناء التنقل بين الصفحات.";
  }

  const groupText = groups.map((group) => `${group.label} (${group.members.length})`).join("، ");
  const sectionText =
    groups.length === 1 ? "قسم واحد" : groups.length === 2 ? "قسمين" : `${groups.length} أقسام`;
  return `تم اختيار ${selectedCount} من ${sectionText}: ${groupText}`;
}

function buildWhatsAppHref(selectedMembers) {
  if (!selectedMembers.length) {
    return `https://wa.me/${whatsappNumber}`;
  }

  const messageLines = ["السلام عليكم، أرغب بطلب الكاست التالي:", ""];
  groupSelectedMembers(selectedMembers).forEach((group, groupIndex, groups) => {
    messageLines.push(`${group.label}:`);
    group.members.forEach((member) => messageLines.push(`- ${member.name}`));

    if (groupIndex < groups.length - 1) {
      messageLines.push("");
    }
  });

  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(messageLines.join("\n"))}`;
}

function syncRenderedSelections() {
  document.querySelectorAll(".cast-card").forEach((card) => {
    const isSelected = selectedCast.has(card.dataset.castId);
    const checkbox = card.querySelector('input[type="checkbox"]');

    card.classList.toggle("is-selected", isSelected);
    if (checkbox) {
      checkbox.checked = isSelected;
    }
  });
}

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
  checkbox.checked = selectedCast.has(member.id);
  card.classList.toggle("is-selected", checkbox.checked);
  checkbox.addEventListener("change", () => {
    setMemberSelected(member.id, checkbox.checked);
    syncRenderedSelections();
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
  syncRenderedSelections();
}

function createSelectionDock() {
  if (!document.body.classList.contains("cast-page")) return null;

  const dock = document.createElement("aside");
  const main = document.createElement("div");
  const copy = document.createElement("div");
  const title = document.createElement("strong");
  const summary = document.createElement("span");
  const toggle = document.createElement("button");
  const send = document.createElement("a");
  const panel = document.createElement("div");

  dock.className = "cast-selection-dock is-hidden";
  dock.setAttribute("aria-label", "اختيارات الكاست");
  main.className = "cast-selection-dock__main";
  copy.className = "cast-selection-dock__copy";
  title.className = "cast-selection-dock__title";
  summary.className = "cast-selection-dock__summary";
  toggle.className = "cast-selection-dock__toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  send.className = "button primary";
  send.target = "_blank";
  send.rel = "noreferrer";
  panel.className = "cast-selection-panel";

  title.textContent = "اختياراتي";
  summary.textContent = "لم يتم اختيار كاست بعد";
  toggle.textContent = "عرض";
  send.textContent = "إرسال الطلب";
  send.href = `https://wa.me/${whatsappNumber}`;

  toggle.addEventListener("click", () => {
    const isOpen = dock.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.textContent = isOpen ? "إخفاء" : "عرض";
  });

  send.addEventListener("click", (event) => {
    if (!selectedCast.size) {
      event.preventDefault();
    }
  });

  copy.append(title, summary);
  main.append(copy, toggle, send);
  dock.append(main, panel);
  document.body.appendChild(dock);

  return { dock, panel, send, summary, toggle };
}

const selectionDock = createSelectionDock();

function createSelectionGroup(group) {
  const wrapper = document.createElement("div");
  const heading = document.createElement("strong");
  const list = document.createElement("ul");

  wrapper.className = "cast-selection-group";
  heading.textContent = group.label;

  group.members.forEach((member) => {
    const item = document.createElement("li");
    const name = document.createElement("span");
    const remove = document.createElement("button");

    name.textContent = member.name;
    remove.type = "button";
    remove.dataset.removeCast = member.id;
    remove.setAttribute("aria-label", `حذف ${member.name} من الاختيارات`);
    remove.textContent = "حذف";

    item.append(name, remove);
    list.appendChild(item);
  });

  wrapper.append(heading, list);
  return wrapper;
}

function createSectionNav() {
  const nav = document.createElement("nav");
  const label = document.createElement("span");

  nav.className = "cast-selection-nav";
  nav.setAttribute("aria-label", "الانتقال بين أقسام الكاست");
  label.textContent = "أضف من قسم آخر";
  nav.appendChild(label);

  mainCategories.forEach((category) => {
    const link = document.createElement("a");
    link.href = category.href;
    link.textContent = category.label;
    nav.appendChild(link);
  });

  return nav;
}

function renderSelectionPanel(groups) {
  if (!selectionDock) return;

  const clearButton = document.createElement("button");
  clearButton.className = "cast-selection-clear";
  clearButton.type = "button";
  clearButton.textContent = "مسح الاختيارات";
  clearButton.addEventListener("click", () => {
    selectedCast.clear();
    saveStoredSelection();
    syncRenderedSelections();
    updateRequestSummary();
  });

  selectionDock.panel.replaceChildren(
    ...groups.map(createSelectionGroup),
    createSectionNav(),
    clearButton,
  );

  selectionDock.panel.querySelectorAll("[data-remove-cast]").forEach((button) => {
    button.addEventListener("click", () => {
      setMemberSelected(button.dataset.removeCast, false);
      syncRenderedSelections();
      updateRequestSummary();
    });
  });
}

function updateSelectionDock(selectedMembers, groups, whatsappHref) {
  if (!selectionDock) return;

  const hasSelection = selectedMembers.length > 0;
  selectionDock.dock.classList.toggle("is-hidden", !hasSelection);
  document.body.classList.toggle("has-cast-selection", hasSelection);
  selectionDock.summary.textContent = hasSelection
    ? getSelectionSummary(groups, selectedMembers.length)
    : "لم يتم اختيار كاست بعد";
  selectionDock.send.href = whatsappHref;
  selectionDock.send.classList.toggle("is-disabled", !hasSelection);
  selectionDock.send.setAttribute("aria-disabled", String(!hasSelection));

  if (hasSelection) {
    renderSelectionPanel(groups);
  } else {
    selectionDock.dock.classList.remove("is-open");
    selectionDock.toggle.setAttribute("aria-expanded", "false");
    selectionDock.toggle.textContent = "عرض";
    selectionDock.panel.replaceChildren();
  }
}

function updateRequestSummary() {
  const selectedMembers = getSelectedMembers();
  const groups = groupSelectedMembers(selectedMembers);
  const whatsappHref = buildWhatsAppHref(selectedMembers);

  updateSelectionDock(selectedMembers, groups, whatsappHref);

  if (!selectedMembers.length) {
    if (selectedSummary) {
      selectedSummary.textContent =
        "اختر كاست واحد أو أكثر من أي قسم، وتبقى اختياراتك محفوظة أثناء التنقل بين الصفحات.";
    }

    if (sendCastRequest) {
      sendCastRequest.href = `https://wa.me/${whatsappNumber}`;
      sendCastRequest.classList.add("is-disabled");
      sendCastRequest.setAttribute("aria-disabled", "true");
    }

    return;
  }

  if (selectedSummary) {
    selectedSummary.textContent = getSelectionSummary(groups, selectedMembers.length);
  }

  if (sendCastRequest) {
    sendCastRequest.href = whatsappHref;
    sendCastRequest.classList.remove("is-disabled");
    sendCastRequest.setAttribute("aria-disabled", "false");
  }
}

if (sendCastRequest) {
  sendCastRequest.addEventListener("click", (event) => {
    if (!selectedCast.size) {
      event.preventDefault();
    }
  });
}

window.addEventListener("storage", (event) => {
  if (event.key !== selectionStorageKey) return;

  selectedCast.clear();
  loadStoredSelection().forEach((id) => selectedCast.add(id));
  syncRenderedSelections();
  updateRequestSummary();
});

renderOverview();
renderQuickLinks();
renderCategoryCards();
renderSections();
updateRequestSummary();
