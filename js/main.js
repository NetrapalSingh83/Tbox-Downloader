// Initialize Feather Icons and API configuration
const API_BASE_URL = 'https://tbox-downloader.onrender.com';
let currentMode = 3;

document.addEventListener("DOMContentLoaded", async () => {
  feather.replace();
  
  // Initialize app and get config
  try {
    const configResponse = await fetch(`${API_BASE_URL}/get_config`);
    const config = await configResponse.json();
    if (config.status === 'success') {
      currentMode = config.mode;
      updateStatusIndicator(currentMode);
    }
  } catch (error) {
    console.error('Failed to initialize app:', error);
  }

  // Status indicator update
  function updateStatusIndicator(mode) {
    const indicator = document.createElement('div');
    indicator.id = 'status-mode';
    indicator.style.position = 'fixed';
    indicator.style.top = '20px';
    indicator.style.right = '20px';
    indicator.style.width = '10px';
    indicator.style.height = '10px';
    indicator.style.borderRadius = '50%';
    indicator.style.backgroundColor = mode === 2 ? '#77ff7e' : '#ff7777';
    document.body.appendChild(indicator);
  }

  // Set current year in footer
  document.getElementById("current-year").textContent = new Date().getFullYear()

  // Navbar scroll effect
  const navbar = document.querySelector(".navbar")
  window.addEventListener("scroll", () => {
    if (window.scrollY > 10) {
      navbar.classList.add("scrolled")
    } else {
      navbar.classList.remove("scrolled")
    }
  })

  // Mobile menu toggle
  const mobileMenuBtn = document.getElementById("mobile-menu-btn")
  const mobileNav = document.getElementById("mobile-nav")
  
  if (mobileMenuBtn && mobileNav) {
    const mobileMenuIcon = mobileMenuBtn.querySelector("i")

    mobileMenuBtn.addEventListener("click", () => {
      mobileNav.classList.toggle("active")

      if (mobileMenuIcon) {
        if (mobileNav.classList.contains("active")) {
          mobileMenuIcon.setAttribute("data-feather", "x")
        } else {
          mobileMenuIcon.setAttribute("data-feather", "menu")
        }
        feather.replace()
      }
    })
  }

  // Scroll to top button
  const scrollTopBtn = document.getElementById("scroll-top")
  scrollTopBtn.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    })
  })

  // FAQ accordion
  const faqItems = document.querySelectorAll(".faq-item")
  faqItems.forEach((item) => {
    const question = item.querySelector(".faq-question")
    const icon = question.querySelector("i")

    question.addEventListener("click", () => {
      // Close all other items
      faqItems.forEach((otherItem) => {
        if (otherItem !== item && otherItem.classList.contains("active")) {
          otherItem.classList.remove("active")
          const otherIcon = otherItem.querySelector(".faq-question i")
          if (otherIcon) { // Add null check
            otherIcon.setAttribute("data-feather", "chevron-down")
          }
        }
      })

      // Toggle current item
      item.classList.toggle("active")

      if (icon) { // Add null check
        if (item.classList.contains("active")) {
          icon.setAttribute("data-feather", "chevron-up")
        } else {
          icon.setAttribute("data-feather", "chevron-down")
        }
      }

      feather.replace()
    })
  })

  // URL form submission with actual API integration
  const urlForm = document.getElementById("url-form");
  const videoDetailsSection = document.getElementById("video-details");

  urlForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const urlInput = document.getElementById("video-url");
    const downloadBtn = document.getElementById("download-btn");
    const url = urlInput.value.trim();

    if (!url) return;

    downloadBtn.innerHTML = '<div class="spinner"></div>';
    downloadBtn.disabled = true;

    try {
      // Call generate_file endpoint
      const fileResponse = await fetch(`${API_BASE_URL}/generate_file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: url,
          mode: currentMode
        })
      });

      const fileData = await fileResponse.json();
      
      if (fileData.status === 'success') {
        // Store parameters for download
        window.teraboxParams = {
          uk: fileData.uk,
          shareid: fileData.shareid,
          timestamp: fileData.timestamp,
          sign: fileData.sign,
          js_token: fileData.js_token,
          cookie: fileData.cookie
        };

        // Display file information
        displayFileList(fileData.list);
        videoDetailsSection.classList.remove("hidden");
        videoDetailsSection.scrollIntoView({ behavior: "smooth" });
      } else {
        showError('Failed to fetch file details: ' + fileData.message);
      }
    } catch (error) {
      console.error("Error fetching video data:", error);
      showError("Failed to fetch video information. Please check the URL and try again.");
    } finally {
      downloadBtn.innerHTML = 'Download Now <i data-feather="download"></i>';
      downloadBtn.disabled = false;
      feather.replace();
    }
  });

  function displayFileList(files) {
    const videoInfo = document.querySelector('.video-info');
    videoInfo.innerHTML = ''; // Clear existing content

    files.forEach(file => {
      const fileElement = createFileElement(file);
      videoInfo.appendChild(fileElement);
    });
  }

  function createFileElement(file) {
    const fileDiv = document.createElement('div');
    fileDiv.className = 'file-item';
    
    // Add thumbnail if available
    if (file.image) {
        const thumbnailDiv = document.createElement('div');
        thumbnailDiv.className = 'file-thumbnail';
        const thumbnail = document.createElement('img');
        thumbnail.src = file.image;
        thumbnail.alt = file.name;
        thumbnail.className = 'file-thumbnail-img';
        thumbnailDiv.appendChild(thumbnail);
        fileDiv.appendChild(thumbnailDiv);
    }
    
    const fileName = document.createElement('h3');
    fileName.className = 'video-title';
    fileName.textContent = file.name;
    
    const fileSize = document.createElement('div');
    fileSize.className = 'metadata-item';
    fileSize.innerHTML = `
      <p class="metadata-label">File Size</p>
      <p class="metadata-value">${(file.size / (1024 * 1024)).toFixed(2)} MB</p>
    `;
    
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'download-video-btn';
    downloadBtn.innerHTML = `<i data-feather="download"></i> Download ${file.type === 'video' ? 'Video' : 'File'}`;
    
    downloadBtn.addEventListener('click', () => initDownload(file));
    
    fileDiv.appendChild(fileName);
    fileDiv.appendChild(fileSize);
    fileDiv.appendChild(downloadBtn);
    
    if (file.type === 'video') {
        const streamBtn = document.createElement('button');
        streamBtn.className = 'download-video-btn stream-btn';
        streamBtn.innerHTML = `<i data-feather="play"></i> Stream Video`;
        streamBtn.addEventListener('click', () => initStream(file));
        fileDiv.appendChild(streamBtn);
    }
    
    feather.replace();
    return fileDiv;
  }

  async function initDownload(file) {
    // Get the clicked button and store its original content
    const downloadBtn = event.target.closest('.download-video-btn');
    const originalContent = downloadBtn.innerHTML;
    
    // Show processing state
    downloadBtn.innerHTML = '<div class="spinner"></div> Processing...';
    downloadBtn.disabled = true;

    try {
      const params = {
        ...window.teraboxParams,
        fs_id: file.fs_id,
        mode: currentMode
      };

      const response = await fetch(`${API_BASE_URL}/generate_link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });

      const data = await response.json();
      
      if (data.status === 'success' && data.download_link.url_2) {
        // Only use url_2 which is the working URL
        const link = document.createElement('a');
        link.href = data.download_link.url_2;
        link.target = '_blank';
        link.click();
      } else {
        showError('Failed to generate download link');
      }
    } catch (error) {
      console.error('Error generating download link:', error);
      showError('Failed to generate download link');
    } finally {
      // Restore the original button content
      downloadBtn.innerHTML = originalContent;
      downloadBtn.disabled = false;
      feather.replace();
    }
  }

  async function initStream(file) {
    // Get the clicked button and store its original content
    const streamBtn = event.target.closest('.stream-btn');
    const originalContent = streamBtn.innerHTML;
    
    // Show processing state
    streamBtn.innerHTML = '<div class="spinner"></div> Processing...';
    streamBtn.disabled = true;

    try {
      const params = {
        ...window.teraboxParams,
        fs_id: file.fs_id,
        mode: currentMode
      };

      const response = await fetch(`${API_BASE_URL}/generate_link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });

      const data = await response.json();
      
      if (data.status === 'success' && data.download_link.url_2) {
        const streamBox = document.getElementById('stream-video');
        streamBox.className = 'stream-video-section';
        
        // Create video element
        const videoElement = document.createElement('video');
        videoElement.controls = true;
        videoElement.autoplay = false;
        videoElement.muted = false;
        videoElement.preload = 'auto';
        videoElement.playsInline = true;
        videoElement.style.width = '100%';
        videoElement.style.height = 'auto';
        videoElement.style.maxHeight = '80vh';
        videoElement.style.backgroundColor = '#000';
        
        // Try without crossOrigin first
        videoElement.removeAttribute('crossorigin');
        
        // Add event listeners for debugging
        videoElement.addEventListener('loadedmetadata', () => {
          console.log('Video metadata loaded');
        });
        
        videoElement.addEventListener('playing', () => {
          console.log('Video started playing');
        });
        
        videoElement.addEventListener('error', (e) => {
          console.error('Video error:', e);
          // If there's an error, try with crossOrigin
          if (!videoElement.hasAttribute('crossorigin')) {
            videoElement.setAttribute('crossorigin', 'anonymous');
            videoElement.load();
          } else {
            showError('Failed to load video. Please try again.');
          }
        });
        
        // Clear previous content and set up new video
        streamBox.innerHTML = '';
        streamBox.appendChild(videoElement);
        
        // Set source after adding to DOM
        videoElement.src = data.download_link.url_2;
        
        // Remove inactive class and scroll to player
        streamBox.classList.remove('inactive');
        streamBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Attempt to play
        try {
          await videoElement.play();
        } catch (playError) {
          console.error('Play error:', playError);
          // User may need to interact first
          videoElement.addEventListener('canplay', () => {
            videoElement.play().catch(console.error);
          });
        }
      } else {
        showError('Failed to generate stream link');
      }
    } catch (error) {
      console.error('Error generating stream link:', error);
      showError('Failed to generate stream link');
    } finally {
      // Restore the original button content
      streamBtn.innerHTML = originalContent;
      streamBtn.disabled = false;
      feather.replace();
    }
  }

  function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.querySelector('.hero-content').appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
  }

  // Contact form submission
  const contactForm = document.getElementById("contact-form")
  const successMessage = document.getElementById("success-message")

  contactForm.addEventListener("submit", async (e) => {
    e.preventDefault()

    const submitBtn = contactForm.querySelector('button[type="submit"]')
    submitBtn.innerHTML = "Sending..."
    submitBtn.disabled = true

    // Get form data
    const formData = {
      name: document.getElementById("name").value,
      email: document.getElementById("email").value,
      message: document.getElementById("message").value,
    }

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Show success message
      successMessage.classList.remove("hidden")
      contactForm.reset()

      // Hide success message after 5 seconds
      setTimeout(() => {
        successMessage.classList.add("hidden")
      }, 5000)
    } catch (error) {
      console.error("Error sending message:", error)
      alert("Failed to send message. Please try again.")
    } finally {
      submitBtn.innerHTML = 'Send Message <i data-feather="send"></i>'
      submitBtn.disabled = false
      feather.replace()
    }
  })

  // Add animation classes on scroll
  const animateOnScroll = () => {
    const elements = document.querySelectorAll(".feature-card, .step-card, .faq-item, .card")

    elements.forEach((element) => {
      const elementPosition = element.getBoundingClientRect().top
      const screenPosition = window.innerHeight / 1.2

      if (elementPosition < screenPosition) {
        element.classList.add("animate-fade-in")
      }
    })
  }

  window.addEventListener("scroll", animateOnScroll)
  animateOnScroll() // Run once on load
})
