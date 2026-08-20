(function () {
  "use strict";

  const repository = {
    owner: "anas3719",
    name: "anas3719.github.io",
    branch: "main",
  };

  const githubTokenStorageKey = "cast-admin-github-token";
  const categoryLabels = {
    regular: "الإعلانات العادية",
    ugc: "UGC",
  };

  const elements = {
    syncStatus: document.querySelector("#sync-status"),
    reloadData: document.querySelector("#reload-data"),
    githubConnect: document.querySelector("#github-connect"),
    publishChanges: document.querySelector("#publish-changes"),
    categoryButtons: [...document.querySelectorAll(".work-category-button")],
    regularCount: document.querySelector("#regular-count"),
    ugcCount: document.querySelector("#ugc-count"),
    workSearch: document.querySelector("#work-search"),
    directoryTitle: document.querySelector("#directory-title"),
    worksCount: document.querySelector("#works-count"),
    worksList: document.querySelector("#works-list"),
    emptyList: document.querySelector("#empty-list"),
    addWork: document.querySelector("#add-work"),
    emptyAddWork: document.querySelector("#empty-add-work"),
    editorPanel: document.querySelector(".editor-panel"),
    editorEmpty: document.querySelector("#editor-empty"),
    workForm: document.querySelector("#work-form"),
    editorMode: document.querySelector("#editor-mode"),
    editorTitle: document.querySelector("#editor-title"),
    completionStatus: document.querySelector("#completion-status"),
    workBrand: document.querySelector("#work-brand"),
    workUrl: document.querySelector("#work-url"),
    categoryInputs: [...document.querySelectorAll('input[name="category"]')],
    typeInputs: [...document.querySelectorAll('input[name="workType"]')],
    previewFrame: document.querySelector("#work-preview-frame"),
    previewPlaceholder: document.querySelector("#work-preview-placeholder"),
    openWorkLink: document.querySelector("#open-work-link"),
    formError: document.querySelector("#form-error"),
    deleteWork: document.querySelector("#delete-work"),
    cancelEdit: document.querySelector("#cancel-edit"),
    githubDialog: document.querySelector("#github-dialog"),
    githubForm: document.querySelector("#github-form"),
    githubToken: document.querySelector("#github-token"),
    rememberToken: document.querySelector("#remember-token"),
    githubError: document.querySelector("#github-error"),
    confirmGithub: document.querySelector("#confirm-github"),
    disconnectGithub: document.querySelector("#disconnect-github"),
    closeGithubDialog: document.querySelector("#close-github-dialog"),
    cancelGithub: document.querySelector("#cancel-github"),
    toggleToken: document.querySelector("#toggle-token"),
    deleteDialog: document.querySelector("#delete-dialog"),
    deleteWorkName: document.querySelector("#delete-work-name"),
    cancelDelete: document.querySelector("#cancel-delete"),
    confirmDelete: document.querySelector("#confirm-delete"),
    toast: document.querySelector("#toast"),
  };

  let works = { regular: [], ugc: [] };
  let activeCategory = "regular";
  let selectedIndex = null;
  let isNewWork = false;
  let dataDirty = false;
  let formDirty = false;
  let baseDataSource = "";
  let baseIndexSource = "";
  let githubToken = loadStoredGithubToken();
  let publishAfterConnection = false;
  let toastTimer = null;
  let worksSortable = null;

  function initializeIcons() {
    if (window.lucide) {
      window.lucide.createIcons({ attrs: { "aria-hidden": "true" } });
    }
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function setSyncStatus(message, state = "") {
    elements.syncStatus.textContent = message;
    if (state) elements.syncStatus.dataset.state = state;
    else delete elements.syncStatus.dataset.state;
  }

  function setBusy(isBusy) {
    document.body.classList.toggle("is-busy", isBusy);
    elements.publishChanges.disabled = isBusy || !dataDirty || formDirty;
  }

  function showToast(message, state = "") {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    if (state) elements.toast.dataset.state = state;
    else delete elements.toast.dataset.state;
    toastTimer = window.setTimeout(() => {
      elements.toast.hidden = true;
    }, 4200);
  }

  function loadStoredGithubToken() {
    try {
      return localStorage.getItem(githubTokenStorageKey)
        || sessionStorage.getItem(githubTokenStorageKey)
        || "";
    } catch (error) {
      return "";
    }
  }

  function storeGithubToken(token, rememberOnDevice) {
    try {
      if (rememberOnDevice) {
        localStorage.setItem(githubTokenStorageKey, token);
        sessionStorage.removeItem(githubTokenStorageKey);
      } else {
        sessionStorage.setItem(githubTokenStorageKey, token);
        localStorage.removeItem(githubTokenStorageKey);
      }
    } catch (error) {
      sessionStorage.setItem(githubTokenStorageKey, token);
    }
  }

  function clearStoredGithubToken() {
    try {
      localStorage.removeItem(githubTokenStorageKey);
      sessionStorage.removeItem(githubTokenStorageKey);
    } catch (error) {
      // The in-memory connection is still cleared.
    }
  }

  function encodeBase64Utf8(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return window.btoa(binary);
  }

  async function githubRequest(path, options = {}) {
    const response = await fetch(`https://api.github.com${path}`, {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${githubToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error("رمز GitHub غير صحيح أو انتهت صلاحيته");
      if (response.status === 403) throw new Error("رمز GitHub لا يملك صلاحية تعديل المستودع");
      if (response.status === 404) throw new Error("تعذر الوصول إلى مستودع الموقع بهذا الرمز");
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || "تعذر الاتصال بـ GitHub");
    }

    if (response.status === 204) return null;
    return response.json();
  }

  function rawGithubUrl(path) {
    return `https://raw.githubusercontent.com/${repository.owner}/${repository.name}/${repository.branch}/${path}`;
  }

  async function fetchGithubRaw(path) {
    const response = await fetch(`${rawGithubUrl(path)}?admin=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`تعذر تحميل ${path}`);
    return response.text();
  }

  function loadSourceIntoWindow(source) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([source], { type: "text/javascript" });
      const url = URL.createObjectURL(blob);
      const script = document.createElement("script");
      script.src = url;
      script.onload = () => {
        URL.revokeObjectURL(url);
        script.remove();
        resolve();
      };
      script.onerror = () => {
        URL.revokeObjectURL(url);
        script.remove();
        reject(new Error("ملف بيانات الأعمال غير صالح"));
      };
      document.head.append(script);
    });
  }

  function normalizeWorks(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      regular: (Array.isArray(source.regular) ? source.regular : []).map(normalizeWork).filter(Boolean),
      ugc: (Array.isArray(source.ugc) ? source.ugc : []).map(normalizeWork).filter(Boolean),
    };
  }

  function normalizeWork(work) {
    if (!work || !String(work.brand || "").trim() || !String(work.url || "").trim()) return null;
    const type = work.type === "folder" ? "folder" : "video";
    const normalized = {
      brand: String(work.brand).trim(),
      type,
      url: String(work.url).trim(),
    };
    if (type === "video") normalized.preview = String(work.preview || derivePreviewUrl(work.url)).trim();
    return normalized;
  }

  function serializeWorks(value) {
    return `window.portfolioWorks = ${JSON.stringify(value, null, 2)};\n`;
  }

  function extractDriveId(value, type) {
    const input = String(value || "").trim();
    if (!input) return "";
    if (/^[A-Za-z0-9_-]{20,}$/.test(input)) return input;

    try {
      const url = new URL(input);
      const queryId = url.searchParams.get("id");
      if (queryId) return queryId;
      const pattern = type === "folder" ? /\/folders\/([A-Za-z0-9_-]+)/ : /\/d\/([A-Za-z0-9_-]+)/;
      return url.pathname.match(pattern)?.[1] || "";
    } catch (error) {
      return "";
    }
  }

  function detectLinkType(value) {
    const input = String(value || "");
    if (/drive\.google\.com\/drive\/folders\//i.test(input)) return "folder";
    if (/drive\.google\.com\/(?:file\/d\/|open\?)/i.test(input)) return "video";
    return "";
  }

  function derivePreviewUrl(value) {
    const id = extractDriveId(value, "video");
    return id ? `https://drive.google.com/file/d/${id}/preview` : "";
  }

  function normalizeDriveWork(brand, type, value) {
    const cleanBrand = String(brand || "").trim();
    if (!cleanBrand) throw new Error("اكتب اسم البراند أو الشركة");

    const id = extractDriveId(value, type);
    if (!id) {
      throw new Error(type === "folder" ? "رابط مجلد Google Drive غير صحيح" : "رابط فيديو Google Drive غير صحيح");
    }

    if (type === "folder") {
      return {
        brand: cleanBrand,
        type: "folder",
        url: `https://drive.google.com/drive/folders/${id}`,
      };
    }

    return {
      brand: cleanBrand,
      type: "video",
      preview: `https://drive.google.com/file/d/${id}/preview`,
      url: `https://drive.google.com/file/d/${id}/view`,
    };
  }

  function getSelectedRadio(inputs) {
    return inputs.find((input) => input.checked)?.value || "";
  }

  function selectRadio(inputs, value) {
    inputs.forEach((input) => {
      input.checked = input.value === value;
    });
  }

  function updateCounts() {
    elements.regularCount.textContent = works.regular.length;
    elements.ugcCount.textContent = works.ugc.length;
  }

  function createWorkRow(work, index, canSort) {
    const row = document.createElement("div");
    row.className = "profile-row";
    row.dataset.workIndex = String(index);
    row.classList.toggle("is-selected", !isNewWork && selectedIndex === index);

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "profile-row__open";
    openButton.setAttribute("aria-label", `تعديل ${work.brand}`);

    const icon = document.createElement("span");
    icon.className = `work-row-icon${work.type === "folder" ? " is-folder" : ""}`;
    icon.innerHTML = `<i data-lucide="${work.type === "folder" ? "folder-open" : "circle-play"}" aria-hidden="true"></i>`;

    const copy = document.createElement("span");
    copy.className = "profile-row-copy";
    const name = document.createElement("span");
    name.className = "profile-row-name";
    name.textContent = work.brand;
    const category = document.createElement("span");
    category.className = "profile-row-category";
    category.textContent = categoryLabels[activeCategory];
    copy.append(name, category);

    const state = document.createElement("span");
    state.className = "profile-state is-complete";
    state.textContent = work.type === "folder" ? "مجلد" : "فيديو";

    const dragHandle = document.createElement("button");
    dragHandle.type = "button";
    dragHandle.className = "profile-drag-handle";
    dragHandle.disabled = !canSort;
    dragHandle.title = canSort ? "اسحب لتغيير الترتيب" : "امسح البحث لتفعيل الترتيب";
    dragHandle.setAttribute("aria-label", `تغيير ترتيب ${work.brand}`);
    dragHandle.innerHTML = '<i data-lucide="grip-vertical" aria-hidden="true"></i>';
    dragHandle.addEventListener("keydown", (event) => {
      if (!canSort || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      const targetIndex = event.key === "ArrowUp" ? index - 1 : index + 1;
      if (!moveWork(index, targetIndex)) return;
      renderWorks();
      window.requestAnimationFrame(() => {
        elements.worksList
          .querySelector(`[data-work-index="${targetIndex}"] .profile-drag-handle`)
          ?.focus();
      });
    });

    openButton.append(icon, copy, state);
    openButton.addEventListener("click", () => selectWork(index));
    row.append(openButton, dragHandle);
    return row;
  }

  function moveWork(fromIndex, toIndex) {
    const list = works[activeCategory];
    if (
      !Number.isInteger(fromIndex)
      || !Number.isInteger(toIndex)
      || fromIndex < 0
      || fromIndex >= list.length
      || toIndex < 0
      || toIndex >= list.length
    ) return false;
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    if (!isNewWork && selectedIndex === fromIndex) selectedIndex = toIndex;
    else if (!isNewWork && selectedIndex !== null) {
      if (fromIndex < selectedIndex && toIndex >= selectedIndex) selectedIndex -= 1;
      if (fromIndex > selectedIndex && toIndex <= selectedIndex) selectedIndex += 1;
    }
    markDataDirty("تم تعديل ترتيب الأعمال");
    return true;
  }

  function initializeSorting(canSort) {
    if (worksSortable) {
      worksSortable.destroy();
      worksSortable = null;
    }
    if (!canSort || !window.Sortable) return;

    worksSortable = window.Sortable.create(elements.worksList, {
      animation: 170,
      direction: "vertical",
      handle: ".profile-drag-handle",
      forceFallback: true,
      fallbackTolerance: 3,
      delayOnTouchOnly: true,
      touchStartThreshold: 4,
      ghostClass: "sortable-ghost",
      chosenClass: "sortable-chosen",
      dragClass: "sortable-drag",
      onEnd: (event) => {
        if (event.oldIndex === event.newIndex) return;
        moveWork(event.oldIndex, event.newIndex);
        renderWorks();
      },
    });
  }

  function renderWorks() {
    const query = elements.workSearch.value.trim().toLocaleLowerCase("ar");
    const source = works[activeCategory];
    const filtered = source
      .map((work, index) => ({ work, index }))
      .filter(({ work }) => !query || work.brand.toLocaleLowerCase("ar").includes(query));
    const canSort = !query;

    elements.directoryTitle.textContent = categoryLabels[activeCategory];
    elements.worksCount.textContent = `${filtered.length} عمل`;
    elements.worksList.replaceChildren(...filtered.map(({ work, index }) => createWorkRow(work, index, canSort)));
    elements.emptyList.hidden = filtered.length > 0;
    updateCounts();
    initializeIcons();
    initializeSorting(canSort);
  }

  function showEmptyEditor() {
    elements.editorEmpty.hidden = false;
    elements.workForm.hidden = true;
    elements.previewFrame.src = "about:blank";
  }

  function showEditor() {
    elements.editorEmpty.hidden = true;
    elements.workForm.hidden = false;
  }

  function updateCategoryButtons() {
    elements.categoryButtons.forEach((button) => {
      const selected = button.dataset.category === activeCategory;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-selected", String(selected));
    });
  }

  function switchCategory(category) {
    if (category === activeCategory) return;
    if (!confirmDiscardForm()) return;
    activeCategory = category;
    selectedIndex = null;
    isNewWork = false;
    formDirty = false;
    elements.workSearch.value = "";
    updateCategoryButtons();
    showEmptyEditor();
    renderWorks();
    setSyncStatus(dataDirty ? "لديك تغييرات غير منشورة" : "البيانات محدثة", dataDirty ? "dirty" : "success");
  }

  function fillForm(work, category) {
    elements.workBrand.value = work?.brand || "";
    elements.workUrl.value = work?.url || "";
    selectRadio(elements.categoryInputs, category);
    selectRadio(elements.typeInputs, work?.type || "video");
    elements.formError.hidden = true;
    elements.formError.textContent = "";
    updatePreview();
    updateCompletionStatus();
  }

  function selectWork(index) {
    if (!confirmDiscardForm()) return;
    const work = works[activeCategory][index];
    if (!work) return;
    selectedIndex = index;
    isNewWork = false;
    formDirty = false;
    elements.editorMode.textContent = "تعديل العمل";
    elements.editorTitle.textContent = work.brand;
    elements.deleteWork.hidden = false;
    fillForm(work, activeCategory);
    showEditor();
    renderWorks();
    if (window.matchMedia("(max-width: 980px)").matches) {
      elements.editorPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function startNewWork() {
    if (!confirmDiscardForm()) return;
    selectedIndex = null;
    isNewWork = true;
    formDirty = false;
    elements.editorMode.textContent = "إضافة عمل";
    elements.editorTitle.textContent = "عمل جديد";
    elements.deleteWork.hidden = true;
    fillForm(null, activeCategory);
    showEditor();
    renderWorks();
    window.requestAnimationFrame(() => elements.workBrand.focus({ preventScroll: true }));
    if (window.matchMedia("(max-width: 980px)").matches) {
      elements.editorPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function updateCompletionStatus() {
    let complete = false;
    try {
      normalizeDriveWork(elements.workBrand.value, getSelectedRadio(elements.typeInputs), elements.workUrl.value);
      complete = true;
    } catch (error) {
      complete = false;
    }
    elements.completionStatus.textContent = complete ? "البيانات مكتملة" : "بيانات ناقصة";
    elements.completionStatus.classList.toggle("is-complete", complete);
  }

  function updatePreview() {
    const type = getSelectedRadio(elements.typeInputs);
    const id = extractDriveId(elements.workUrl.value, type);
    const hasTarget = Boolean(id);
    elements.previewFrame.hidden = type !== "video" || !hasTarget;
    elements.previewPlaceholder.hidden = type === "video" && hasTarget;
    elements.previewPlaceholder.classList.toggle("is-folder", type === "folder" && hasTarget);
    elements.previewPlaceholder.innerHTML = type === "folder" && hasTarget
      ? '<i data-lucide="folder-open" aria-hidden="true"></i><span>مجلد البراند</span>'
      : '<i data-lucide="circle-play" aria-hidden="true"></i><span>معاينة العمل</span>';

    if (type === "video" && hasTarget) {
      const preview = `https://drive.google.com/file/d/${id}/preview`;
      if (elements.previewFrame.src !== preview) elements.previewFrame.src = preview;
      elements.openWorkLink.href = `https://drive.google.com/file/d/${id}/view`;
    } else {
      elements.previewFrame.src = "about:blank";
      elements.openWorkLink.href = type === "folder" && hasTarget
        ? `https://drive.google.com/drive/folders/${id}`
        : "#";
    }
    elements.openWorkLink.hidden = !hasTarget;
    initializeIcons();
  }

  function markDataDirty(message) {
    dataDirty = true;
    formDirty = false;
    elements.publishChanges.disabled = false;
    setSyncStatus(message || "لديك تغييرات غير منشورة", "dirty");
  }

  function handleFormInput(event) {
    if (event.target === elements.workUrl) {
      const detectedType = detectLinkType(elements.workUrl.value);
      if (detectedType) selectRadio(elements.typeInputs, detectedType);
    }
    formDirty = true;
    elements.publishChanges.disabled = true;
    setSyncStatus("تعديل العمل غير محفوظ", "dirty");
    elements.formError.hidden = true;
    updateCompletionStatus();
    updatePreview();
  }

  function saveWork(event) {
    event.preventDefault();
    elements.formError.hidden = true;
    try {
      const category = getSelectedRadio(elements.categoryInputs);
      const type = getSelectedRadio(elements.typeInputs);
      const nextWork = normalizeDriveWork(elements.workBrand.value, type, elements.workUrl.value);
      const previousCategory = activeCategory;

      if (isNewWork) {
        works[category].push(nextWork);
        activeCategory = category;
        selectedIndex = works[category].length - 1;
      } else {
        const previous = works[previousCategory][selectedIndex];
        if (!previous) throw new Error("تعذر العثور على العمل المحدد");
        if (category === previousCategory) {
          works[category][selectedIndex] = nextWork;
        } else {
          works[previousCategory].splice(selectedIndex, 1);
          works[category].push(nextWork);
          activeCategory = category;
          selectedIndex = works[category].length - 1;
        }
      }

      isNewWork = false;
      formDirty = false;
      elements.editorMode.textContent = "تعديل العمل";
      elements.editorTitle.textContent = nextWork.brand;
      elements.deleteWork.hidden = false;
      updateCategoryButtons();
      fillForm(nextWork, activeCategory);
      renderWorks();
      markDataDirty("تم حفظ العمل كمسودة");
      showToast("تم حفظ العمل. اضغط نشر التغييرات لإظهاره في الموقع", "success");
    } catch (error) {
      elements.formError.textContent = error.message;
      elements.formError.hidden = false;
    }
  }

  function confirmDiscardForm() {
    return !formDirty || window.confirm("لديك تعديل غير محفوظ. هل تريد تجاهله؟");
  }

  function requestDelete() {
    const work = works[activeCategory][selectedIndex];
    if (!work) return;
    elements.deleteWorkName.textContent = work.brand;
    elements.deleteDialog.showModal();
  }

  function confirmDelete() {
    const work = works[activeCategory][selectedIndex];
    if (!work) return;
    works[activeCategory].splice(selectedIndex, 1);
    elements.deleteDialog.close();
    selectedIndex = null;
    isNewWork = false;
    formDirty = false;
    showEmptyEditor();
    renderWorks();
    markDataDirty(`تم حذف ${work.brand} كمسودة`);
    showToast("تم الحذف. اضغط نشر التغييرات لتطبيقه على الموقع", "success");
  }

  async function loadData() {
    if ((dataDirty || formDirty) && !window.confirm("سيتم تجاهل التغييرات غير المنشورة. هل تريد المتابعة؟")) return;
    setBusy(true);
    setSyncStatus("جاري تحميل البيانات");
    try {
      [baseDataSource, baseIndexSource] = await Promise.all([
        fetchGithubRaw("works-data.js"),
        fetchGithubRaw("index.html"),
      ]);
      window.portfolioWorks = undefined;
      await loadSourceIntoWindow(baseDataSource);
      works = normalizeWorks(clone(window.portfolioWorks));
      activeCategory = "regular";
      selectedIndex = null;
      isNewWork = false;
      dataDirty = false;
      formDirty = false;
      elements.workSearch.value = "";
      elements.publishChanges.disabled = true;
      updateCategoryButtons();
      showEmptyEditor();
      renderWorks();
      setSyncStatus("البيانات محدثة", "success");
    } catch (error) {
      setSyncStatus("تعذر تحميل البيانات", "error");
      showToast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  function updateConnectionButton() {
    const text = elements.githubConnect.querySelector("span");
    text.textContent = githubToken ? "GitHub متصل" : "اتصال GitHub";
    elements.githubConnect.classList.toggle("is-connected", Boolean(githubToken));
    elements.githubConnect.title = githubToken ? "الاتصال محفوظ ويمكنك النشر مباشرة" : "اتصال GitHub للنشر";
    elements.githubConnect.setAttribute("aria-label", githubToken ? "GitHub متصل" : "اتصال GitHub");
  }

  function openGithubDialog(shouldPublish = false) {
    publishAfterConnection = shouldPublish;
    elements.githubError.hidden = true;
    elements.githubError.textContent = "";
    elements.githubToken.value = githubToken;
    elements.disconnectGithub.hidden = !githubToken;
    elements.githubDialog.showModal();
    elements.githubToken.focus();
  }

  async function connectGithub(event) {
    event.preventDefault();
    const token = elements.githubToken.value.trim();
    if (!token) return;
    const previousToken = githubToken;
    githubToken = token;
    elements.confirmGithub.disabled = true;
    elements.githubError.hidden = true;
    try {
      await githubRequest(`/repos/${repository.owner}/${repository.name}`);
      storeGithubToken(githubToken, elements.rememberToken.checked);
      updateConnectionButton();
      elements.githubDialog.close();
      showToast("تم اتصال GitHub بنجاح", "success");
      if (publishAfterConnection) await publishChanges();
    } catch (error) {
      githubToken = previousToken;
      elements.githubError.textContent = error.message;
      elements.githubError.hidden = false;
    } finally {
      elements.confirmGithub.disabled = false;
      publishAfterConnection = false;
    }
  }

  function disconnectGithub() {
    githubToken = "";
    clearStoredGithubToken();
    elements.githubToken.value = "";
    elements.githubDialog.close();
    updateConnectionButton();
    showToast("تم فصل اتصال GitHub من هذا الجهاز", "success");
  }

  function createVersion() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }

  function updateWorksVersion(html, version) {
    return html.replace(/works-data\.js(?:\?v=[^"']*)?/g, `works-data.js?v=${version}`);
  }

  async function createBlob(content) {
    return githubRequest(`/repos/${repository.owner}/${repository.name}/git/blobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: encodeBase64Utf8(content), encoding: "base64" }),
    });
  }

  async function waitForPublicData(expectedSource, version) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        const [dataResponse, indexResponse] = await Promise.all([
          fetch(`works-data.js?admin=${version}-${attempt}`, { cache: "no-store" }),
          fetch(`index.html?admin=${version}-${attempt}`, { cache: "no-store" }),
        ]);
        const [dataSource, indexSource] = await Promise.all([dataResponse.text(), indexResponse.text()]);
        if (dataSource === expectedSource && indexSource.includes(`works-data.js?v=${version}`)) return true;
      } catch (error) {
        // GitHub Pages may briefly serve the previous deployment.
      }
      await new Promise((resolve) => window.setTimeout(resolve, 3000));
    }
    return false;
  }

  async function publishChanges() {
    if (formDirty) {
      showToast("احفظ تعديل العمل أولاً", "error");
      return;
    }
    if (!dataDirty) return;
    if (!githubToken) {
      openGithubDialog(true);
      return;
    }

    setBusy(true);
    setSyncStatus("جاري تجهيز النشر");
    try {
      const [remoteDataSource, remoteIndexSource] = await Promise.all([
        fetchGithubRaw("works-data.js"),
        fetchGithubRaw("index.html"),
      ]);
      if (remoteDataSource !== baseDataSource || remoteIndexSource !== baseIndexSource) {
        throw new Error("تغيرت بيانات الموقع منذ فتح اللوحة. اضغط تحديث البيانات ثم أعد تعديلك");
      }

      const nextDataSource = serializeWorks(works);
      const version = createVersion();
      const nextIndexSource = updateWorksVersion(baseIndexSource, version);
      const ref = await githubRequest(`/repos/${repository.owner}/${repository.name}/git/ref/heads/${repository.branch}`);
      const currentCommit = await githubRequest(`/repos/${repository.owner}/${repository.name}/git/commits/${ref.object.sha}`);

      setSyncStatus("جاري رفع التغييرات");
      const files = [
        { path: "works-data.js", content: nextDataSource },
        { path: "index.html", content: nextIndexSource },
      ];
      const blobs = await Promise.all(files.map(async (file) => ({ ...file, blob: await createBlob(file.content) })));
      const tree = await githubRequest(`/repos/${repository.owner}/${repository.name}/git/trees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_tree: currentCommit.tree.sha,
          tree: blobs.map((file) => ({ path: file.path, mode: "100644", type: "blob", sha: file.blob.sha })),
        }),
      });
      const commit = await githubRequest(`/repos/${repository.owner}/${repository.name}/git/commits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Update portfolio works from admin panel",
          tree: tree.sha,
          parents: [ref.object.sha],
        }),
      });
      await githubRequest(`/repos/${repository.owner}/${repository.name}/git/refs/heads/${repository.branch}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sha: commit.sha, force: false }),
      });

      baseDataSource = nextDataSource;
      baseIndexSource = nextIndexSource;
      dataDirty = false;
      elements.publishChanges.disabled = true;
      setSyncStatus("جاري نشر الموقع");
      const deployed = await waitForPublicData(nextDataSource, version);
      if (deployed) {
        setSyncStatus("تم النشر بنجاح", "success");
        showToast("تم نشر التغييرات على الموقع", "success");
      } else {
        setSyncStatus("تم الرفع والنشر قيد الاكتمال", "dirty");
        showToast("تم الرفع إلى GitHub، وقد يستغرق ظهور التحديث دقيقة", "success");
      }
    } catch (error) {
      setSyncStatus("تعذر نشر التغييرات", "error");
      showToast(error.message, "error");
      if (/رمز GitHub|صلاحية/.test(error.message)) {
        githubToken = "";
        clearStoredGithubToken();
        updateConnectionButton();
      }
    } finally {
      setBusy(false);
    }
  }

  elements.categoryButtons.forEach((button) => {
    button.addEventListener("click", () => switchCategory(button.dataset.category));
  });
  elements.workSearch.addEventListener("input", renderWorks);
  elements.addWork.addEventListener("click", startNewWork);
  elements.emptyAddWork.addEventListener("click", startNewWork);
  elements.workForm.addEventListener("submit", saveWork);
  elements.workForm.addEventListener("input", handleFormInput);
  elements.workForm.addEventListener("change", handleFormInput);
  elements.cancelEdit.addEventListener("click", () => {
    if (!confirmDiscardForm()) return;
    selectedIndex = null;
    isNewWork = false;
    formDirty = false;
    showEmptyEditor();
    renderWorks();
    setSyncStatus(dataDirty ? "لديك تغييرات غير منشورة" : "البيانات محدثة", dataDirty ? "dirty" : "success");
  });
  elements.deleteWork.addEventListener("click", requestDelete);
  elements.confirmDelete.addEventListener("click", confirmDelete);
  elements.cancelDelete.addEventListener("click", () => elements.deleteDialog.close());
  elements.reloadData.addEventListener("click", loadData);
  elements.publishChanges.addEventListener("click", publishChanges);
  elements.githubConnect.addEventListener("click", () => openGithubDialog(false));
  elements.githubForm.addEventListener("submit", connectGithub);
  elements.disconnectGithub.addEventListener("click", disconnectGithub);
  elements.closeGithubDialog.addEventListener("click", () => elements.githubDialog.close());
  elements.cancelGithub.addEventListener("click", () => elements.githubDialog.close());
  elements.toggleToken.addEventListener("click", () => {
    const showing = elements.githubToken.type === "text";
    elements.githubToken.type = showing ? "password" : "text";
    elements.toggleToken.setAttribute("aria-label", showing ? "إظهار الرمز" : "إخفاء الرمز");
    elements.toggleToken.innerHTML = `<i data-lucide="${showing ? "eye" : "eye-off"}" aria-hidden="true"></i>`;
    initializeIcons();
  });

  window.addEventListener("beforeunload", (event) => {
    if (!dataDirty && !formDirty) return;
    event.preventDefault();
    event.returnValue = "";
  });

  async function initializeAdmin() {
    initializeIcons();
    updateConnectionButton();
    await loadData();
  }

  initializeAdmin();
})();
