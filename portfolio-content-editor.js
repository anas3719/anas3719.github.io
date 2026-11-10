(function () {
  "use strict";
  const panel = document.querySelector("#portfolio-content-panel"),
    fields = document.querySelector("#portfolio-content-fields"),
    error = document.querySelector("#content-error");
  let page,
    changed = false,
    pending = 0,
    notify = () => {};
  const uploads = new Map(),
    objectUrls = [];
  const groups = [
    [
      "الاسم والنبذة",
      [
        [".site-header .brand", "اسم الموقع"],
        [".hero-copy h1", "الاسم"],
        [".hero-copy .eyebrow", "المسمى"],
        [".hero-copy .lead", "النبذة"],
        [".hero-bio p", "نبذة إضافية"],
        [".hero-meta span", "بيانات الواجهة"],
        [".hero-actions a", "أزرار الواجهة"],
      ],
    ],
    [
      "العناوين والبيانات",
      [
        [".site-header nav a", "التنقل"],
        ["main .section-heading h2", "عنوان القسم"],
        ["main .section-heading .eyebrow", "عنوان فرعي"],
        [".intro-video-copy p", "وصف الفيديو التعريفي"],
        [".intro-video-copy a", "زر تنزيل الفيديو"],
        [".details-grid article span", "عنوان البيان"],
        [".details-grid article strong", "البيانات والمقاسات والمجالات"],
        ["#showMoreWorks", "زر الأعمال"],
      ],
    ],
    [
      "التواصل والتذييل",
      [
        ["#contact .eyebrow", "عنوان التواصل الفرعي"],
        ["#contact h2", "عنوان التواصل"],
        ["#contact > div > p:not(.eyebrow)", "نص التواصل"],
        [".contact-panel a span", "بيانات التواصل"],
        ["footer span", "التذييل"],
      ],
    ],
  ];
  function dirty() {
    changed = true;
    error.hidden = true;
    notify(changed);
  }
  function fail(message) {
    error.textContent = message;
    error.hidden = false;
    error.scrollIntoView({ block: "center" });
  }
  function section(title) {
    const el = document.createElement("fieldset");
    el.className = "content-section";
    const legend = document.createElement("legend");
    legend.textContent = title;
    el.append(legend);
    fields.append(el);
    return el;
  }
  function field(parent, title, value, set, multiline = false) {
    const label = document.createElement("label");
    label.className = "field";
    const name = document.createElement("span");
    name.textContent = title;
    const input = document.createElement(multiline ? "textarea" : "input");
    if (!multiline) input.type = "text";
    else input.rows = 3;
    input.value = value;
    input.dir = "auto";
    input.addEventListener("input", () => {
      set(input.value);
      dirty();
    });
    label.append(name, input);
    parent.append(label);
    return input;
  }
  function button(parent, title, icon, action) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "button button-secondary";
    el.title = title;
    el.setAttribute("aria-label", title);
    const mark = document.createElement("i");
    mark.dataset.lucide = icon;
    const text = document.createElement("span");
    text.textContent = title;
    el.append(mark, text);
    el.addEventListener("click", action);
    parent.append(el);
    return el;
  }
  function safeMedia(value) {
    try {
      return (
        (/^assets\/[A-Za-z0-9_./-]+$/.test(value) && !value.includes("..")) ||
        new URL(value).protocol === "https:"
      );
    } catch {
      return false;
    }
  }
  function source(value) {
    return uploads.get(value)?.preview || value;
  }
  function uploader(parent, video, accept) {
    const label = document.createElement("label");
    label.className = "field";
    const title = document.createElement("span");
    title.textContent = video ? "رفع فيديو من الجهاز" : "رفع صورة من الجهاز";
    const input = document.createElement("input");
    input.type = "file";
    input.accept = video
      ? "video/mp4,video/webm"
      : "image/jpeg,image/png,image/webp,image/avif";
    input.addEventListener("change", async () => {
      const file = input.files[0];
      if (!file) return;
      const extensions = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/avif": "avif",
        "video/mp4": "mp4",
        "video/webm": "webm",
      };
      if (
        !extensions[file.type] ||
        video !== file.type.startsWith("video/") ||
        file.size > (video ? 50 : 12) * 1024 * 1024
      ) {
        fail(
          video
            ? "اختر فيديو MP4 أو WebM حتى 50 ميجابايت"
            : "اختر صورة JPG أو PNG أو WebP أو AVIF حتى 12 ميجابايت",
        );
        input.value = "";
        return;
      }
      pending++;
      notify(changed);
      input.disabled = true;
      try {
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const preview = URL.createObjectURL(file);
        objectUrls.push(preview);
        if (!video) {
          const image = new Image();
          image.src = preview;
          await image.decode();
        }
        const path = `assets/uploads/${video ? "video" : "photo"}-${crypto.randomUUID()}.${extensions[file.type]}`;
        uploads.set(path, {
          path,
          content: data.slice(data.indexOf(",") + 1),
          binary: true,
          preview,
        });
        accept(path);
        dirty();
        render();
      } catch {
        fail("تعذر قراءة الملف؛ اختر ملفًا آخر");
      } finally {
        pending--;
        input.disabled = false;
        notify(changed);
      }
    });
    label.append(title, input);
    parent.append(label);
    return input;
  }
  function media(parent, node, set, video = false) {
    const control = document.createElement("div");
    control.className = "content-media-control";
    parent.append(control);
    const image = document.createElement(video ? "video" : "img");
    image.className = "content-media-preview";
    image.src = source(node.getAttribute("src"));
    if (video) {
      image.controls = true;
      image.preload = "metadata";
    } else image.alt = node.alt;
    control.append(image);
    field(
      control,
      video ? "رابط ملف الفيديو" : "رابط الصورة",
      node.getAttribute("src") || "",
      (value) => {
        set(value);
        image.src = safeMedia(value) ? source(value) : "";
      },
    );
    uploader(control, video, set);
  }
  function gallery(parent) {
    const container = page.querySelector(".gallery");
    [...container.children].forEach((shot, index) => {
      const row = document.createElement("article");
      row.className = "content-photo-row";
      const title = document.createElement("h3");
      title.textContent = `الصورة ${index + 1}`;
      row.append(title);
      const image = shot.querySelector("img"),
        target = shot.querySelector("button");
      media(row, image, (value) => {
        image.src = value;
        target.dataset.imageSrc = value;
        target.dataset.downloadSrc = value;
        target.dataset.downloadName = value.split("/").pop().split("?")[0];
      });
      field(
        row,
        "النص البديل للصورة",
        image.alt,
        (value) => (image.alt = value),
      );
      const actions = document.createElement("div");
      actions.className = "content-photo-actions";
      button(actions, "قبل", "arrow-up", () => {
        if (shot.previousElementSibling) {
          container.insertBefore(shot, shot.previousElementSibling);
          dirty();
          render();
        }
      }).disabled = index === 0;
      button(actions, "بعد", "arrow-down", () => {
        if (shot.nextElementSibling) {
          container.insertBefore(shot.nextElementSibling, shot);
          dirty();
          render();
        }
      }).disabled = index === container.children.length - 1;
      button(actions, "حذف الصورة", "trash-2", () => {
        shot.remove();
        dirty();
        render();
      });
      button(actions, "تعيين كرئيسية", "image", () => {
        const hero = page.querySelector(".hero-media img");
        hero.src = image.getAttribute("src");
        hero.alt = image.alt;
        dirty();
        render();
      });
      row.append(actions);
      parent.append(row);
    });
    const addPhoto = uploader(parent, false, (value) => {
      const shot = page.createElement("figure");
      shot.className = "shot";
      const target = page.createElement("button");
      target.type = "button";
      target.className = "shot-button";
      target.setAttribute("aria-label", "تكبير الصورة");
      const image = page.createElement("img");
      image.alt = "صورة المودل";
      image.loading = "lazy";
      image.src = value;
      target.dataset.imageSrc = image.getAttribute("src");
      target.dataset.downloadSrc = image.getAttribute("src");
      target.dataset.downloadName = value.split("/").pop();
      target.append(image);
      shot.append(target);
      container.append(shot);
      dirty();
      render();
    });
    addPhoto.closest("label").hidden = true;
    button(parent, "إضافة صورة", "plus", () => addPhoto.click());
  }
  function render() {
    fields.replaceChildren();
    const main = section("الصورة الرئيسية"),
      hero = page.querySelector(".hero-media img");
    media(main, hero, (value) => (hero.src = value));
    field(
      main,
      "النص البديل للصورة الرئيسية",
      hero.alt,
      (value) => (hero.alt = value),
    );
    for (const [title, selectors] of groups) {
      const parent = section(title);
      for (const [selector, label] of selectors)
        [...page.querySelectorAll(selector)].forEach((node, index, list) =>
          field(
            parent,
            `${label}${list.length > 1 ? ` ${index + 1}` : ""}`,
            node.textContent.trim(),
            (value) => (node.textContent = value),
            node.tagName === "P" || node.tagName === "STRONG",
          ),
        );
    }
    const contact = section("روابط التواصل");
    [...page.querySelectorAll(".contact-panel a")].forEach((node, index) =>
      field(
        contact,
        ["رابط البريد الإلكتروني", "رابط إنستغرام", "رابط واتساب"][index] ||
          "رابط التواصل",
        node.getAttribute("href"),
        (value) => node.setAttribute("href", value),
      ),
    );
    const video = section("الفيديو التعريفي");
    media(
      video,
      page.querySelector(".intro-video-frame video"),
      (value) => {
        page.querySelector(".intro-video-frame video").src = value;
        const download = page.querySelector(".intro-video-copy a");
        download.href = value;
        download.download = value.split("/").pop().split("?")[0];
      },
      true,
    );
    gallery(section("صور المعرض"));
    const meta = section("بيانات الصفحة");
    field(meta, "عنوان الصفحة", page.title, (value) => (page.title = value));
    const description = page.querySelector('meta[name="description"]');
    field(
      meta,
      "وصف الصفحة",
      description.content,
      (value) => (description.content = value),
      true,
    );
    window.lucide?.createIcons();
  }
  window.portfolioContentEditor = {
    load(html, onChange) {
      objectUrls.splice(0).forEach((url) => URL.revokeObjectURL(url));
      page = new DOMParser().parseFromString(html, "text/html");
      uploads.clear();
      changed = false;
      notify = onChange;
      render();
    },
    apply(original) {
      if (pending) throw new Error("انتظر اكتمال قراءة الملفات قبل النشر");
      if (!changed) return original;
      for (const node of page.querySelectorAll(
        ".hero-media img,.gallery img,.intro-video-frame video",
      ))
        if (!safeMedia(node.getAttribute("src")))
          throw new Error(
            "رابط الصورة أو الفيديو غير صالح؛ استخدم ملفًا مرفوعًا أو رابط HTTPS",
          );
      for (const node of page.querySelectorAll(".contact-panel a"))
        if (!/^(https:\/\/|mailto:|tel:)/i.test(node.getAttribute("href")))
          throw new Error("رابط التواصل غير صالح");
      return "<!doctype html>\n" + page.documentElement.outerHTML + "\n";
    },
    files() {
      const html = page.documentElement.outerHTML;
      return [...uploads.values()]
        .filter((file) => !file.published && html.includes(file.path))
        .map(({ preview, published, ...file }) => file);
    },
    saved() {
      changed = false;
      const html = page.documentElement.outerHTML;
      uploads.forEach((file) => {
        if (html.includes(file.path)) file.published = true;
      });
    },
    isPending() {
      return pending > 0;
    },
  };
  document.querySelectorAll("[data-admin-view]").forEach((button) =>
    button.addEventListener("click", () => {
      const content = button.dataset.adminView === "content";
      panel.hidden = !content;
      document.querySelector(".admin-main").hidden = content;
      document
        .querySelectorAll("[data-admin-view]")
        .forEach((tab) =>
          tab.setAttribute("aria-pressed", String(tab === button)),
        );
    }),
  );
})();
