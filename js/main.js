// ─────────────────────────────────────────────────────────────────────────────
//  Tbox Downloader – Frontend
//
//  ⚠️  Change API_BASE_URL to your deployed Render URL before going live:
//      const API_BASE_URL = 'https://your-app-name.onrender.com';
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE_URL = 'https://tbox-downloader.onrender.com';

document.addEventListener("DOMContentLoaded", async () => {
  feather.replace();

  // ── Ping backend ──────────────────────────────────────────────────────────
  try {
    const res = await fetch(`${API_BASE_URL}/get_config`);
    const cfg = await res.json();
    if (cfg.status !== 'success') console.warn('Backend not ready:', cfg.message);
  } catch (err) {
    console.warn('Backend unreachable:', err.message);
  }

  // ── Navbar scroll ─────────────────────────────────────────────────────────
  const navbar = document.querySelector(".navbar");
  window.addEventListener("scroll", () => {
    navbar.classList.toggle("scrolled", window.scrollY > 10);
  });

  // ── Mobile menu ───────────────────────────────────────────────────────────
  const mobileMenuBtn = document.getElementById("mobile-menu-btn");
  const mobileNav     = document.getElementById("mobile-nav");
  if (mobileMenuBtn && mobileNav) {
    mobileMenuBtn.addEventListener("click", () => {
      mobileNav.classList.toggle("active");
      const icon = mobileMenuBtn.querySelector("i");
      if (icon) {
        icon.setAttribute("data-feather",
          mobileNav.classList.contains("active") ? "x" : "menu");
        feather.replace();
      }
    });
  }

  // ── Scroll-to-top ─────────────────────────────────────────────────────────
  document.getElementById("scroll-top")?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // ── Footer year ───────────────────────────────────────────────────────────
  const yearEl = document.getElementById("current-year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ── FAQ accordion ─────────────────────────────────────────────────────────
  document.querySelectorAll(".faq-item").forEach(item => {
    item.querySelector(".faq-question")?.addEventListener("click", () => {
      const isActive = item.classList.contains("active");
      document.querySelectorAll(".faq-item").forEach(i => {
        i.classList.remove("active");
        const icon = i.querySelector(".faq-question i");
        if (icon) icon.setAttribute("data-feather", "chevron-down");
      });
      if (!isActive) {
        item.classList.add("active");
        const icon = item.querySelector(".faq-question i");
        if (icon) icon.setAttribute("data-feather", "chevron-up");
      }
      feather.replace();
    });
  });

  // ── Animate on scroll ─────────────────────────────────────────────────────
  const animateOnScroll = () => {
    document.querySelectorAll(".feature-card, .step-card, .faq-item, .card")
      .forEach(el => {
        if (el.getBoundingClientRect().top < window.innerHeight / 1.2)
          el.classList.add("animate-fade-in");
      });
  };
  window.addEventListener("scroll", animateOnScroll);
  animateOnScroll();

  // ── Contact form ──────────────────────────────────────────────────────────
  const contactForm     = document.getElementById("contact-form");
  const successMessage  = document.getElementById("success-message");
  if (contactForm) {
    contactForm.addEventListener("submit", async e => {
      e.preventDefault();
      const btn = contactForm.querySelector('button[type="submit"]');
      btn.textContent = "Sending…";
      btn.disabled = true;
      await new Promise(r => setTimeout(r, 1500));
      successMessage?.classList.remove("hidden");
      contactForm.reset();
      setTimeout(() => successMessage?.classList.add("hidden"), 5000);
      btn.innerHTML = 'Send Message <i data-feather="send"></i>';
      btn.disabled = false;
      feather.replace();
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  MAIN DOWNLOAD LOGIC
  // ─────────────────────────────────────────────────────────────────────────

  const urlForm            = document.getElementById("url-form");
  const videoDetailsSection = document.getElementById("video-details");

  // Stores the shared params returned by /generate_file
  window.teraboxParams = {};

  // ── Step 1: submit URL → call /generate_file ──────────────────────────────
  urlForm?.addEventListener("submit", async e => {
    e.preventDefault();

    const urlInput   = document.getElementById("video-url");
    const downloadBtn = document.getElementById("download-btn");
    const url         = urlInput.value.trim();
    if (!url) return;

    downloadBtn.innerHTML = '<div class="spinner"></div>';
    downloadBtn.disabled  = true;

    // Hide old results
    videoDetailsSection.classList.add("hidden");
    document.getElementById("stream-video").classList.add("inactive");
    document.getElementById("stream-video").innerHTML = "";

    try {
      const res  = await fetch(`${API_BASE_URL}/generate_file`, {
        method  : "POST",
        headers : { "Content-Type": "application/json" },
        body    : JSON.stringify({ url })
      });
      const data = await res.json();

      if (data.status === "success") {
        // Cache shared params for link generation
        window.teraboxParams = {
          uk        : data.uk,
          shareid   : data.shareid,
          timestamp : data.timestamp,
          sign      : data.sign,
          js_token  : data.js_token,
          cookie    : data.cookie
        };

        displayFileList(data.list);
        videoDetailsSection.classList.remove("hidden");
        videoDetailsSection.scrollIntoView({ behavior: "smooth" });
      } else {
        showError("Failed to fetch file details: " + (data.message || "Unknown error"));
      }
    } catch (err) {
      console.error("generate_file error:", err);
      showError("Could not reach the backend. Make sure your API is running.");
    } finally {
      downloadBtn.innerHTML = 'Download Now <i data-feather="download"></i>';
      downloadBtn.disabled  = false;
      feather.replace();
    }
  });

  // ── Render file list ──────────────────────────────────────────────────────
  function displayFileList(files) {
    const container = document.querySelector(".video-info");
    container.innerHTML = "";
    files.forEach(file => container.appendChild(createFileElement(file)));
  }

  function createFileElement(file) {
    const card = document.createElement("div");
    card.className = "file-item";

    // Thumbnail
    if (file.image) {
      const wrap  = document.createElement("div");
      wrap.className = "file-thumbnail";
      const img  = document.createElement("img");
      img.src    = file.image;
      img.alt    = file.name;
      img.className = "file-thumbnail-img";
      wrap.appendChild(img);
      card.appendChild(wrap);
    }

    // Name
    const title = document.createElement("h3");
    title.className = "video-title";
    title.textContent = file.name;
    card.appendChild(title);

    // Size
    if (file.size) {
      const meta = document.createElement("div");
      meta.className = "metadata-item";
      meta.innerHTML = `
        <p class="metadata-label">File Size</p>
        <p class="metadata-value">${(file.size / (1024 * 1024)).toFixed(2)} MB</p>`;
      card.appendChild(meta);
    }

    // Action buttons
    const actions = document.createElement("div");
    actions.className = "file-actions";

    const dlBtn = document.createElement("button");
    dlBtn.className = "download-video-btn";
    dlBtn.innerHTML = '<i data-feather="download"></i> Get Download Links';
    dlBtn.addEventListener("click", () => initDownload(file, card));
    actions.appendChild(dlBtn);

    if (file.type === "video") {
      const streamBtn = document.createElement("button");
      streamBtn.className = "download-video-btn stream-btn";
      streamBtn.innerHTML = '<i data-feather="play"></i> Stream Video';
      streamBtn.addEventListener("click", () => initStream(file, streamBtn));
      actions.appendChild(streamBtn);
    }

    card.appendChild(actions);

    // Container for the 3 download links (filled after clicking Get Download Links)
    const linksBox = document.createElement("div");
    linksBox.className = "download-links-box";
    card.appendChild(linksBox);

    // Recurse into folders
    if (file.is_dir && file.list?.length) {
      const sub = document.createElement("div");
      sub.className = "sub-files";
      file.list.forEach(child => sub.appendChild(createFileElement(child)));
      card.appendChild(sub);
    }

    feather.replace();
    return card;
  }

  // ── Step 2a: Get download links → show 3 buttons ─────────────────────────
  async function initDownload(file, card) {
    const dlBtn = card.querySelector(".download-video-btn");
    const orig  = dlBtn.innerHTML;
    dlBtn.innerHTML = '<div class="spinner"></div> Fetching links…';
    dlBtn.disabled  = true;

    try {
      const res  = await fetch(`${API_BASE_URL}/generate_link`, {
        method  : "POST",
        headers : { "Content-Type": "application/json" },
        body    : JSON.stringify({ ...window.teraboxParams, fs_id: file.fs_id })
      });
      const data = await res.json();

      if (data.status === "success") {
        const box  = card.querySelector(".download-links-box");
        box.innerHTML = "";

        const links = [
          { key: "url_1", label: "Download Link 1", sub: "Standard Speed", icon: "download" },
          { key: "url_2", label: "Download Link 2", sub: "Fast Speed",     icon: "zap"      },
          { key: "url_3", label: "Download Link 3", sub: "Fastest Speed",  icon: "trending-up" }
        ];

        let found = false;
        links.forEach(({ key, label, sub, icon }) => {
          const url = data.download_link?.[key];
          if (!url) return;
          found = true;

          const a = document.createElement("a");
          a.href      = url;
          a.target    = "_blank";
          a.rel       = "noopener noreferrer";
          a.className = "download-link-btn";
          a.innerHTML = `
            <span class="dl-icon"><i data-feather="${icon}"></i></span>
            <span class="dl-text">
              <span class="dl-label">${label}</span>
              <span class="dl-sub">${sub}</span>
            </span>`;
          box.appendChild(a);
        });

        if (!found) showError("No download links were returned. Try again.");
        feather.replace();
      } else {
        showError("Failed to generate links: " + (data.message || "Unknown error"));
      }
    } catch (err) {
      console.error("generate_link error:", err);
      showError("Could not reach the backend.");
    } finally {
      dlBtn.innerHTML = orig;
      dlBtn.disabled  = false;
      feather.replace();
    }
  }

  // ── Step 2b: Stream video ─────────────────────────────────────────────────
  async function initStream(file, btn) {
    const orig = btn.innerHTML;
    btn.innerHTML = '<div class="spinner"></div> Loading…';
    btn.disabled  = true;

    try {
      const res  = await fetch(`${API_BASE_URL}/generate_link`, {
        method  : "POST",
        headers : { "Content-Type": "application/json" },
        body    : JSON.stringify({ ...window.teraboxParams, fs_id: file.fs_id })
      });
      const data = await res.json();

      if (data.status === "success" && data.stream_link) {
        const box = document.getElementById("stream-video");
        box.innerHTML = "";

        const video       = document.createElement("video");
        video.controls    = true;
        video.playsInline = true;
        video.preload     = "metadata";
        video.style.cssText = "width:100%;height:auto;max-height:80vh;background:#000;display:block;border-radius:0.5rem;";

        video.addEventListener("error", () => {
          showError("Video failed to load. Try a download link instead.");
        });

        video.src = data.stream_link;
        box.appendChild(video);

        box.classList.remove("inactive");
        box.scrollIntoView({ behavior: "smooth", block: "center" });

        video.play().catch(() => {});   // autoplay may be blocked; user can press play
      } else {
        showError("Failed to get stream link: " + (data.message || "Unknown error"));
      }
    } catch (err) {
      console.error("stream error:", err);
      showError("Could not reach the backend.");
    } finally {
      btn.innerHTML = orig;
      btn.disabled  = false;
      feather.replace();
    }
  }

  // ── Error banner ──────────────────────────────────────────────────────────
  function showError(message) {
    // Remove any existing error first
    document.querySelectorAll(".error-message").forEach(el => el.remove());

    const div = document.createElement("div");
    div.className   = "error-message";
    div.textContent = message;
    document.querySelector(".hero-content")?.appendChild(div);
    setTimeout(() => div.remove(), 6000);
  }
});
