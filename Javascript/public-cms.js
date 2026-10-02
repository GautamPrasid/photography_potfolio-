(() => {
  const pageData = fetch("/api/public/site")
    .then((response) => {
      if (!response.ok) throw new Error(`Website content could not be loaded (${response.status}).`);
      return response.json();
    });
  window.siteDataPromise = pageData;

  function setText(content, key, selector) {
    const element = document.querySelector(selector);
    if (element && typeof content[key] === "string") element.textContent = content[key];
  }

  function makeSocialLink(link) {
    const anchor = document.createElement("a");
    anchor.href = link.url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.setAttribute("aria-label", link.displayName);
    anchor.title = link.displayName;
    const icon = document.createElement("i");
    icon.className = link.icon;
    icon.setAttribute("aria-hidden", "true");
    anchor.append(icon);
    return anchor;
  }

  function makePhoto(photo) {
    const image = document.createElement("img");
    image.src = photo.imageUrl;
    image.alt = photo.description || photo.title;
    image.loading = "lazy";
    image.dataset.photoTitle = photo.title;
    return image;
  }

  function setHomePhotos(photos) {
    const gallery = document.querySelector("[data-home-photos]");
    if (!gallery) return;
    gallery.replaceChildren();
    const columns = [document.createElement("div"), document.createElement("div"), document.createElement("div")];
    photos.forEach((photo, index) => columns[index % columns.length].append(makePhoto(photo)));
    columns.forEach((column) => gallery.append(column));
  }

  function setPhotoLocations(photoLocations) {
    document.querySelectorAll("[data-photo-location]").forEach((container) => {
      const location = container.dataset.photoLocation;
      const locationPhotos = photoLocations[location] || [];
      container.replaceChildren();
      container.hidden = locationPhotos.length === 0;
      if (!locationPhotos.length) return;

      const heading = document.createElement("h2");
      heading.className = "section__header";
      heading.textContent = location === "featured" ? "Featured photographs" : "Photographs";
      const grid = document.createElement("div");
      grid.className = "cms-photo-grid";
      locationPhotos.forEach((photo) => {
        const figure = document.createElement("figure");
        figure.className = "cms-photo-card";
        figure.append(makePhoto(photo));
        const caption = document.createElement("figcaption");
        caption.textContent = photo.title;
        figure.append(caption);
        grid.append(figure);
      });
      container.append(heading, grid);
    });
  }

  function setGalleryFilters(sections) {
    const filters = document.querySelector("[data-gallery-filters]");
    if (!filters) return;
    const all = document.createElement("button");
    all.className = "filter-btn active";
    all.dataset.filter = "all";
    all.textContent = "All";
    filters.replaceChildren(all);
    sections.filter((section) => !section.system && section.visible).forEach((section) => {
      const button = document.createElement("button");
      button.className = "filter-btn";
      button.dataset.filter = section.slug;
      button.textContent = section.title;
      filters.append(button);
    });
  }

  function render(data) {
    const { content, navigation, socialLinks, photos, sections } = data;
    const nav = document.querySelector(".nav__links");
    if (nav) {
      nav.replaceChildren();
      navigation.forEach((item) => {
        const li = document.createElement("li");
        const anchor = document.createElement("a");
        anchor.href = item.url;
        anchor.textContent = item.label;
        if (item.icon) {
          const icon = document.createElement("i");
          icon.className = item.icon;
          icon.setAttribute("aria-hidden", "true");
          anchor.prepend(icon);
        }
        const current = location.pathname.toLowerCase();
        if ((current === "/" && item.url === "home.html")
          || current.endsWith(item.url.toLowerCase())
          || (current === "/about" && item.url === "about.html")
          || (current === "/portfolio" && item.url === "photography.html")
          || (current === "/contact" && item.url === "hire.html")) {
          anchor.setAttribute("aria-current", "page");
        }
        li.append(anchor);
        nav.append(li);
      });
    }

    document.querySelectorAll("[data-social-location]").forEach((container) => {
      const locationName = container.dataset.socialLocation;
      container.replaceChildren(...socialLinks
        .filter((link) => link.locations.includes(locationName))
        .map(makeSocialLink));
      container.hidden = container.childElementCount === 0;
    });

    setText(content, "home.heroTitle", ".header__content h1");
    setText(content, "home.heroSubtitle", ".header__content h2");
    setText(content, "home.ctaText", ".header__btn .btn");
    setText(content, "home.introduction", "[data-content='home.introduction']");
    setText(content, "home.portfolioTitle", "[data-content='home.portfolioTitle']");
    setText(content, "home.portfolioDescription", "[data-content='home.portfolioDescription']");
    setText(content, "about.title", ".about-content h1");
    setText(content, "about.description", "[data-content='about.description']");
    setText(content, "about.biography", "[data-content='about.biography']");
    setText(content, "portfolio.title", ".portfolio-header h1");
    setText(content, "portfolio.description", ".portfolio-header p");
    setText(content, "contact.title", ".hire-me > h1");
    setText(content, "contact.description", ".hire-me > p");
    setText(content, "contact.closingTitle", ".end-section h2");
    setText(content, "contact.closingDescription", ".end-section p");
    setText(content, "footer.introduction", "[data-content='footer.introduction']");
    setText(content, "footer.officeTitle", "[data-content='footer.officeTitle']");
    setText(content, "footer.socialTitle", "[data-content='footer.socialTitle']");
    setText(content, "footer.copyright", ".footer__bar");
    setText(content, "contact.location", "[data-content='contact.location']");

    const email = document.getElementById("emailBtn");
    if (email && content["contact.email"]) email.href = `mailto:${content["contact.email"]}`;
    const phone = document.getElementById("callBtn");
    if (phone && content["contact.phone"]) phone.href = `tel:${content["contact.phone"].replace(/[^\d+]/g, "")}`;
    const homePortfolio = photos.homepage || [];
    setHomePhotos(homePortfolio);
    setPhotoLocations(photos);
    setGalleryFilters(sections);
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest(".nav__links a")) {
      document.querySelector(".nav__links")?.classList.remove("open");
      document.querySelector(".nav__menu__btn")?.setAttribute("aria-expanded", "false");
    }
  });

  pageData.then(render).catch((error) => {
    console.error("Photography CMS:", error);
    const main = document.querySelector("main");
    if (main) {
      const notice = document.createElement("p");
      notice.className = "cms-load-error";
      notice.setAttribute("role", "alert");
      notice.textContent = "Website content is temporarily unavailable. Please try again shortly.";
      main.prepend(notice);
    }
  });
})();
