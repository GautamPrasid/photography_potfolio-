document.addEventListener("DOMContentLoaded", async () => {
  const menuBtn = document.querySelector(".nav__menu__btn");
  const navLinks = document.querySelector(".nav__links");
  const gallery = document.getElementById("gallery");
  const loadMoreBtn = document.getElementById("load-more");
  const filters = document.querySelector("[data-gallery-filters]");
  const modal = document.getElementById("photo-modal");
  const modalImg = document.getElementById("modal-image");
  const modalCaption = document.getElementById("modal-caption");
  const closeModal = document.querySelector(".close-modal");

  let photos = [];
  let filter = "all";
  let loadedCount = 0;
  const batchSize = 6;

  if (menuBtn && navLinks) {
    menuBtn.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", String(isOpen));
      menuBtn.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
      menuBtn.querySelector("i").className = isOpen ? "ri-close-line" : "ri-menu-3-line";
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".nav__links") && !event.target.closest(".nav__menu__btn")) {
        navLinks.classList.remove("open");
        menuBtn.setAttribute("aria-expanded", "false");
        menuBtn.querySelector("i").className = "ri-menu-3-line";
      }
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 768) {
        navLinks.classList.remove("open");
        menuBtn.setAttribute("aria-expanded", "false");
        menuBtn.querySelector("i").className = "ri-menu-3-line";
      }
    });
  }

  function visiblePhotos() {
    return filter === "all" ? photos : photos.filter((photo) => photo.sections.includes(filter));
  }

  function appendPhoto(photo) {
    const category = photo.category || photo.sections.find((section) => !["homepage", "portfolio", "gallery", "featured", "about", "contact"].includes(section)) || "";
    const item = document.createElement("div");
    item.className = `gallery-item${category ? ` ${category}` : ""}`;
    item.dataset.category = category;

    const image = document.createElement("img");
    image.src = photo.imageUrl;
    image.alt = photo.description || photo.title;
    image.loading = "lazy";

    const overlay = document.createElement("div");
    overlay.className = "photo-overlay";
    const description = document.createElement("p");
    description.textContent = photo.description || photo.title;
    const categoryLabel = document.createElement("span");
    categoryLabel.className = "photo-category";
    categoryLabel.textContent = category;
    overlay.append(description, categoryLabel);
    item.append(image, overlay);
    gallery.append(item);
  }

  function renderBatch(reset = false) {
    if (reset) {
      gallery.replaceChildren();
      loadedCount = 0;
    }
    const items = visiblePhotos();
    const end = Math.min(loadedCount + batchSize, items.length);
    items.slice(loadedCount, end).forEach(appendPhoto);
    loadedCount = end;
    loadMoreBtn.hidden = loadedCount >= items.length;
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "gallery-empty";
      empty.textContent = "No published photos in this section yet.";
      gallery.append(empty);
    }
  }

  try {
    const data = await (window.siteDataPromise || fetch("/api/public/site").then((response) => {
      if (!response.ok) throw new Error(`Portfolio could not be loaded (${response.status}).`);
      return response.json();
    }));
    photos = [...new Map([...(data.photos.portfolio || []), ...(data.photos.gallery || [])]
      .map((photo) => [photo.id, photo])).values()];
    filters.addEventListener("click", (event) => {
      const button = event.target.closest("[data-filter]");
      if (!button) return;
      filters.querySelectorAll(".filter-btn").forEach((filterButton) => filterButton.classList.remove("active"));
      button.classList.add("active");
      filter = button.dataset.filter;
      renderBatch(true);
    });
    gallery.addEventListener("click", (event) => {
      const image = event.target.closest("img");
      if (!image || !modal || !modalImg || !modalCaption) return;
      modalImg.src = image.src;
      modalImg.alt = image.alt;
      modalCaption.textContent = image.alt;
      modal.style.display = "block";
      document.body.style.overflow = "hidden";
    });
    loadMoreBtn.addEventListener("click", () => renderBatch());
    const hideModal = () => {
      modal.style.display = "none";
      modalImg.removeAttribute("src");
      document.body.style.overflow = "";
    };
    closeModal?.addEventListener("click", hideModal);
    modal?.addEventListener("click", (event) => { if (event.target === modal) hideModal(); });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && modal?.style.display === "block") hideModal(); });
    renderBatch(true);
  } catch (error) {
    console.error("Portfolio gallery:", error);
    const notice = document.createElement("p");
    notice.className = "gallery-empty";
    notice.setAttribute("role", "alert");
    notice.textContent = "The portfolio is temporarily unavailable.";
    gallery.replaceChildren(notice);
    loadMoreBtn.hidden = true;
  }
});
