// js/app.js — Core application logic and modular Single Page App controllers

(function (window) {
  // Destructure BizUtils helpers
  const {
    sortEmperorsChronologically,
    getEmperorsByDynasty,
    getDynastyName,
    getStatusBadgeClass,
    formatReignLength,
    findEmperorByName,
    escapeHTML,
    getEmperorSVG
  } = window.BizUtils;

  // Leaflet Map tile URLs constant
  const TILE_URLS = {
    dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
  };

  // View template cache memory
  const templateCache = new Map();

  // Async helper to load template views from /views folder
  async function loadView(viewName) {
    const container = document.getElementById("main-content");
    if (!container) return;

    try {
      // Validate path parameter to prevent path traversal/XSS injection
      if (!/^[a-zA-Z0-9_-]+$/.test(viewName)) {
        throw new Error("Nama tampilan tidak valid.");
      }

      let html = "";
      if (templateCache.has(viewName)) {
        html = templateCache.get(viewName);
      } else {
        const response = await fetch(`views/${viewName}.html`);
        if (!response.ok) {
          throw new Error(`Gagal memuat template: views/${viewName}.html`);
        }
        html = await response.text();
        templateCache.set(viewName, html);
      }
      container.innerHTML = html;
    } catch (error) {
      console.error(error);
      const safeView = escapeHTML(viewName);
      const safeError = escapeHTML(error.message);
      container.innerHTML = `
        <div class="alert alert-danger my-4">
          <h4 class="alert-heading"><i class="fas fa-exclamation-triangle me-2"></i>Error Memuat Halaman</h4>
          <p>Terjadi kesalahan saat memuat tampilan <strong>${safeView}</strong>.</p>
          <hr>
          <p class="mb-0 small text-muted">Detail: ${safeError}</p>
        </div>
      `;
    }
  }

  // App Controller Namespace
  const App = {
    // Encapsulated state for charts and library instances
    state: {
      statusChart: null,
      dynastyChart: null,
      datatableInstance: null,
      leafletMap: null,
      tileLayer: null,
      activeLayers: []
    },

    // Cleanup active libraries and maps to prevent memory leaks
    cleanup() {
      if (this.state.statusChart) {
        this.state.statusChart.destroy();
        this.state.statusChart = null;
      }
      if (this.state.dynastyChart) {
        this.state.dynastyChart.destroy();
        this.state.dynastyChart = null;
      }
      if (this.state.datatableInstance) {
        try {
          this.state.datatableInstance.destroy();
        } catch (e) {
          console.error("Gagal membersihkan DataTable:", e);
        }
        this.state.datatableInstance = null;
      }
      if (this.state.leafletMap) {
        try {
          this.state.leafletMap.remove();
        } catch (e) {
          console.error("Gagal membersihkan peta:", e);
        }
        this.state.leafletMap = null;
        this.state.tileLayer = null;
        this.state.activeLayers = [];
      }
    },

    // Initialization
    init() {
      // Setup maps in BizUtils
      if (window.BizUtils) {
        window.BizUtils.assignChronOrder();
        window.BizUtils.initDynastyMap();
        window.BizUtils.initEmperorMap();
      }

      this.theme.init();
      this.search.init();
      this.ui.initFloatingElements();
      this.router.init();
    },

    // --- Theme Control Module ---
    theme: {
      init() {
        const toggleBtn = document.getElementById("theme-toggle");
        const storedTheme = localStorage.getItem("theme") || "light";

        document.documentElement.setAttribute("data-theme", storedTheme);
        this.updateIcon(storedTheme);

        if (toggleBtn) {
          toggleBtn.addEventListener("click", () => {
            const currentTheme = document.documentElement.getAttribute("data-theme");
            const newTheme = currentTheme === "dark" ? "light" : "dark";

            document.documentElement.setAttribute("data-theme", newTheme);
            localStorage.setItem("theme", newTheme);
            this.updateIcon(newTheme);

            // Rerender active theme components depending on hash
            const hash = window.location.hash || "#/home";
            if (hash === "" || hash === "#/home") {
              App.ui.renderCharts();
            } else if (hash === "#/peta") {
              const activeBtn = document.querySelector(".map-control-btn.active");
              if (activeBtn) {
                const index = parseInt(activeBtn.getAttribute("data-index"), 10);
                App.ui.updateMapDisplay(index);
              }
            }
          });
        }
      },

      updateIcon(theme) {
        const icon = document.querySelector("#theme-toggle i");
        if (icon) {
          icon.className = theme === "dark" ? "fas fa-sun" : "fas fa-moon";
        }
      }
    },

    // --- Universal Search Module ---
    search: {
      init() {
        const searchInput = document.getElementById("nav-search-input");
        const resultsDropdown = document.getElementById("search-results");

        if (searchInput && resultsDropdown) {
          searchInput.addEventListener("input", (e) => {
            const query = e.target.value.trim();
            const queryLower = query.toLowerCase();
            if (queryLower.length < 2) {
              resultsDropdown.classList.remove("active");
              resultsDropdown.innerHTML = "";
              return;
            }

            const filtered = sortEmperorsChronologically(
              window.BYZANTINE_EMPERORS.filter(
                (emp) =>
                  emp.name.toLowerCase().includes(queryLower) ||
                  emp.originalName.toLowerCase().includes(queryLower) ||
                  getDynastyName(emp.dynasty).toLowerCase().includes(queryLower) ||
                  emp.achievements.toLowerCase().includes(queryLower) ||
                  emp.wars.toLowerCase().includes(queryLower)
              )
            );

            this.render(filtered, query);
          });

          document.addEventListener("click", (e) => {
            if (!searchInput.contains(e.target) && !resultsDropdown.contains(e.target)) {
              resultsDropdown.classList.remove("active");
            }
          });

          searchInput.addEventListener("focus", () => {
            if (searchInput.value.trim().length >= 2) {
              resultsDropdown.classList.add("active");
            }
          });
        }
      },

      highlight(text, query) {
        if (!query) return text;
        const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        return text.replace(regex, '<mark class="search-highlight">$1</mark>');
      },

      render(results, query) {
        const dropdown = document.getElementById("search-results");
        dropdown.innerHTML = "";

        if (results.length === 0) {
          dropdown.innerHTML = `<div class="search-result-item text-muted">Tidak ada hasil ditemukan</div>`;
          dropdown.classList.add("active");
          return;
        }

        results.slice(0, 7).forEach((emp) => {
          const item = document.createElement("div");
          item.className = "search-result-item";

          const coinPreview = window.getEmperorSVG(emp.name, emp.dynasty);
          const dynastyName = getDynastyName(emp.dynasty);

          const highlightedName = this.highlight(emp.name, query);
          const highlightedDynasty = this.highlight(dynastyName, query);
          const highlightedReign = this.highlight(emp.reign, query);

          item.innerHTML = `
            <div class="search-result-coin">${coinPreview}</div>
            <div class="search-result-info">
              <span class="search-result-name">${highlightedName}</span>
              <span class="search-result-dynasty">${highlightedDynasty} (${highlightedReign})</span>
            </div>
            <span class="search-result-order">#${emp.chronOrder}</span>
          `;

          item.addEventListener("click", () => {
            window.location.hash = `#/kaisar/${emp.id}`;
            document.getElementById("nav-search-input").value = "";
            dropdown.classList.remove("active");
          });

          dropdown.appendChild(item);
        });

        dropdown.classList.add("active");
      }
    },

    // --- Client-Side Router Module ---
    router: {
      init() {
        const handleRouting = async () => {
          const hash = window.location.hash || "#/home";
          const pathParts = hash.split("/");
          const view = pathParts[1] || "home";
          const param = pathParts[2] || null;

          // Auto-close search results dropdown
          const searchResults = document.getElementById("search-results");
          if (searchResults) {
            searchResults.classList.remove("active");
          }

          // Auto-close mobile navbar collapse menu
          const navbarNav = document.getElementById("navbarNav");
          if (navbarNav && navbarNav.classList.contains("show") && window.bootstrap) {
            const collapseInstance = bootstrap.Collapse.getInstance(navbarNav);
            if (collapseInstance) {
              collapseInstance.hide();
            } else {
              new bootstrap.Collapse(navbarNav).hide();
            }
          }

          // Cleanup active charts/maps/tables from memory before loading new view
          App.cleanup();

          // Load template asynchronously
          await loadView(view);
          window.scrollTo(0, 0);

          // Update active link styling
          document.querySelectorAll(".navbar-custom .nav-link").forEach((link) => {
            const href = link.getAttribute("href");
            const isActive = href === `#/${view}` || (view === "kaisar" && href === "#/database");
            link.classList.toggle("active", isActive);
          });

          // Run rendering logic
          const renderers = {
            home: () => App.ui.renderHome(),
            sejarah: () => {}, // Static content only
            dinasti: () => App.ui.renderDinasti(param),
            kaisar: () => App.ui.renderKaisar(param),
            database: () => App.ui.renderDatabase(),
            pohon: () => App.ui.renderPohon(),
            timeline: () => App.ui.renderTimeline(),
            peta: () => App.ui.renderPeta(),
            referensi: () => App.ui.renderReferensi()
          };

          if (renderers[view]) {
            renderers[view]();
          } else {
            App.ui.renderHome();
          }
        };

        window.addEventListener("hashchange", handleRouting);
        handleRouting();
      }
    },

    // --- UI Renderers Module ---
    ui: {
      renderFamilyNode(nameStr, label, isActive = false, activeEmp = null) {
        if (!nameStr) {
          return `<div class="family-tree-node"><span class="family-tree-label">${escapeHTML(label)}</span><span class="family-member-badge text-muted">-</span></div>`;
        }
        
        const trimmed = nameStr.trim();
        if (trimmed === "Tidak diketahui" || trimmed === "Tidak ada" || trimmed === "Tidak menikah" || trimmed === "-") {
          return `<div class="family-tree-node"><span class="family-tree-label">${escapeHTML(label)}</span><span class="family-member-badge text-muted">${escapeHTML(trimmed)}</span></div>`;
        }
        
        if (isActive) {
          return `<div class="family-tree-node active"><span class="family-tree-label">${escapeHTML(label)}</span><span class="family-tree-name"><i class="fas fa-crown text-gold me-1"></i>${escapeHTML(trimmed)}</span></div>`;
        }
        
        const emp = findEmperorByName(trimmed, activeEmp);
        if (emp) {
          return `
            <div class="family-tree-node link" onclick="window.location.hash='#/kaisar/${emp.id}'" title="Klik untuk profil ${escapeHTML(emp.name)}">
              <span class="family-tree-label">${escapeHTML(label)}</span>
              <span class="family-tree-name"><i class="fas fa-crown text-gold me-1"></i>${escapeHTML(trimmed)}</span>
            </div>
          `;
        } else {
          return `
            <div class="family-tree-node">
              <span class="family-tree-label">${escapeHTML(label)}</span>
              <span class="family-tree-name text-truncate" title="${escapeHTML(trimmed)}">${escapeHTML(trimmed)}</span>
            </div>
          `;
        }
      },

      renderFamilyRow(fieldValue, label, activeEmp = null) {
        if (!fieldValue || fieldValue === "Tidak diketahui" || fieldValue === "Tidak ada" || fieldValue === "Tidak menikah") {
          return `<div class="family-tree-node"><span class="family-tree-label">${escapeHTML(label)}</span><span class="family-member-badge text-muted">${escapeHTML(fieldValue || '-')}</span></div>`;
        }
        
        const names = fieldValue.split(/,|\b&\b|\bdan\b/);
        return names.map(name => {
          const trimmed = name.trim();
          if (!trimmed) return "";
          return this.renderFamilyNode(trimmed, label, false, activeEmp);
        }).filter(html => html !== "").join("");
      },

      initFloatingElements() {
        const backToTop = document.getElementById("back-to-top");

        window.addEventListener("scroll", () => {
          if (backToTop) {
            backToTop.style.display = window.scrollY > 300 ? "flex" : "none";
          }
        });

        if (backToTop) {
          backToTop.addEventListener("click", () => {
            window.scrollTo({ top: 0, behavior: "smooth" });
          });
        }
      },

      renderHome() {
        const statYears = document.getElementById("stat-years");
        const statDynasties = document.getElementById("stat-dynasties");
        const statEmperors = document.getElementById("stat-emperors");
        const statCapital = document.getElementById("stat-capital");

        if (statYears) statYears.textContent = "1.123 Tahun";
        if (statDynasties) statDynasties.textContent = window.BYZANTINE_DYNASTIES.length;
        if (statEmperors) statEmperors.textContent = window.BYZANTINE_EMPERORS.length;
        if (statCapital) statCapital.textContent = "Konstantinopel";

        this.renderCharts();
      },

      renderCharts() {
        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        const textColor = isDark ? "#E8D9EB" : "#2B1124";
        const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(74, 14, 78, 0.08)";

        // 1. Doughnut Chart: final status of emperors
        const statusCounts = {};
        window.BYZANTINE_EMPERORS.forEach((emp) => {
          const stat = emp.status || "Lainnya";
          statusCounts[stat] = (statusCounts[stat] || 0) + 1;
        });

        const canvasStatus = document.getElementById("chart-status");
        if (canvasStatus) {
          const ctxStatus = canvasStatus.getContext("2d");
          if (App.state.statusChart) App.state.statusChart.destroy();

          App.state.statusChart = new Chart(ctxStatus, {
            type: "doughnut",
            data: {
              labels: Object.keys(statusCounts),
              datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: Object.keys(statusCounts).map((stat) => {
                  const s = stat.toLowerCase();
                  if (s.includes("berhasil")) return "#4E7D5B"; // Muted Sage Green
                  if (s.includes("gugur") || s.includes("gagal")) return "#A63A50"; // Muted Ruby/Crimson
                  if (s.includes("digulingkan")) return "#D39E45"; // Warm Amber/Gold
                  if (s.includes("wafat alami")) return "#457B9D"; // Muted Ocean Blue
                  if (s.includes("dibunuh")) return "#8D2635"; // Deep Burgundy
                  if (s.includes("turun takhta") || s.includes("sakit")) return "#7B8A91"; // Muted Slate Gray
                  return "#705E78"; // Muted Lavender
                }),
                borderWidth: 2,
                borderColor: isDark ? "#1C0F1E" : "#FAF6F0"
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { labels: { color: textColor, font: { family: "Inter" } } },
                title: {
                  display: true,
                  text: "Status Akhir Kaisar Bizantium",
                  color: textColor,
                  font: { family: "Cinzel", size: 14, weight: "bold" }
                }
              }
            }
          });
        }

        // 2. Bar Chart: count per dynasty
        const dynastyCounts = {};
        window.BYZANTINE_DYNASTIES.forEach((d) => {
          dynastyCounts[d.name] = window.BYZANTINE_EMPERORS.filter((e) => e.dynasty === d.id).length;
        });
        dynastyCounts["Non-Dinasti"] = window.BYZANTINE_EMPERORS.filter((e) => e.dynasty === "non-dinasti").length;

        const canvasDynasty = document.getElementById("chart-dynasty");
        if (canvasDynasty) {
          const ctxDynasty = canvasDynasty.getContext("2d");
          if (App.state.dynastyChart) App.state.dynastyChart.destroy();

          App.state.dynastyChart = new Chart(ctxDynasty, {
            type: "bar",
            data: {
              labels: Object.keys(dynastyCounts).map((n) => n.replace("Dinasti ", "")),
              datasets: [{
                label: "Jumlah Kaisar",
                data: Object.values(dynastyCounts),
                backgroundColor: "rgba(197, 155, 39, 0.75)",
                borderColor: "#C59B27",
                borderWidth: 1.5,
                hoverBackgroundColor: "#D4AF37"
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                title: {
                  display: true,
                  text: "Jumlah Kaisar Per Dinasti",
                  color: textColor,
                  font: { family: "Cinzel", size: 14, weight: "bold" }
                }
              },
              scales: {
                x: {
                  ticks: { color: textColor, font: { family: "Inter", size: 9 } },
                  grid: { display: false }
                },
                y: {
                  ticks: { color: textColor, font: { family: "Inter" } },
                  grid: { color: gridColor }
                }
              }
            }
          });
        }
      },

      renderDinasti(dynastyId) {
        const listContainer = document.getElementById("dynasty-all-list");
        const detailContainer = document.getElementById("dynasty-detail-content");
        if (!listContainer || !detailContainer) return;

        if (!dynastyId) {
          listContainer.style.display = "block";
          detailContainer.style.display = "none";

          let html = `
            <h2 class="imperial-font text-purple mb-2 border-bottom pb-2">Dinasti Kekaisaran Bizantium</h2>
            <p class="text-secondary mb-4">15 dinasti utama yang memerintah Kekaisaran Romawi Timur dari abad ke-4 hingga kejatuhan Konstantinopel pada 1453 M.</p>
            <div class="row g-4">
          `;

          window.BYZANTINE_DYNASTIES.forEach((d) => {
            const count = window.BYZANTINE_EMPERORS.filter((e) => e.dynasty === d.id).length;
            html += `
              <div class="col-md-6 col-lg-4">
                <div class="card-imperial card-dynasty h-100" onclick="window.location.hash='#/dinasti/${d.id}'" style="cursor:pointer;">
                  <div class="card-imperial-header d-flex justify-content-between align-items-center">
                    <h3 class="h5 m-0 text-purple">${d.name}</h3>
                    <span class="badge bg-imperial-purple">${count} Kaisar</span>
                  </div>
                  <div class="card-imperial-body">
                    <p class="text-gold small mb-2">${d.period}</p>
                    <p class="text-muted small text-truncate-3">${d.description}</p>
                    <span class="text-purple fw-bold small">Selengkapnya <i class="fas fa-chevron-right ms-1"></i></span>
                  </div>
                </div>
              </div>
            `;
          });

          html += "</div>";
          listContainer.innerHTML = html;
          return;
        }

        listContainer.style.display = "none";
        detailContainer.style.display = "block";

        const dynasty = window.BYZANTINE_DYNASTIES.find((d) => d.id === dynastyId);
        if (!dynasty) {
          detailContainer.innerHTML = `<div class="alert alert-danger">Dinasti tidak ditemukan!</div>`;
          return;
        }

        const emperors = getEmperorsByDynasty(dynastyId);

        let empsGrid = '<div class="row g-4 mt-3">';
        emperors.forEach((emp, index) => {
          const coin = window.getEmperorSVG(emp.name, emp.dynasty);
          empsGrid += `
            <div class="col-sm-6 col-md-4 col-lg-3">
              <div class="card-imperial emperor-card text-center p-3 h-100" onclick="window.location.hash='#/kaisar/${emp.id}'" style="cursor:pointer;">
                <span class="emperor-seq-badge">${index + 1}</span>
                <div class="emperor-card-coin">${coin}</div>
                <h5 class="h6 text-truncate m-0">${emp.name}</h5>
                <p class="text-gold small m-0">${emp.reign}</p>
                <p class="text-muted small m-0">Lama: ${formatReignLength(emp.reignLength)}</p>
                <span class="badge-status ${getStatusBadgeClass(emp.status)} mt-2 d-inline-flex">${emp.status}</span>
              </div>
            </div>
          `;
        });
        empsGrid += "</div>";

        detailContainer.innerHTML = `
          <div class="mb-4">
            <a href="#/dinasti" class="btn btn-outline-purple mb-4"><i class="fas fa-arrow-left me-2"></i> Kembali ke Daftar Dinasti</a>
          </div>
          <div class="emperor-header-card p-4">
            <h2 class="text-purple">${dynasty.name}</h2>
            <h5 class="text-gold">${dynasty.period}</h5>
            <hr class="border-color">
            <p class="lead" style="font-family: var(--font-serif);">${dynasty.description}</p>
            <div class="row mt-4">
              <div class="col-md-6 mb-3">
                <h5 class="text-purple">Pendiri / Tokoh Utama</h5>
                <p class="text-muted">${dynasty.founder}</p>
              </div>
              <div class="col-md-6 mb-3">
                <h5 class="text-purple">Prestasi Utama</h5>
                <p class="text-muted">${dynasty.achievements}</p>
              </div>
              <div class="col-12 mt-2">
                <h5 class="text-purple">Keruntuhan / Akhir</h5>
                <p class="text-muted">${dynasty.decline}</p>
              </div>
            </div>
          </div>

          <h3 class="imperial-font text-purple border-bottom pb-2 mt-4">
            Daftar Kaisar Dinasti
            <span class="badge bg-imperial-purple ms-2 align-middle" style="font-size:0.65rem;">${emperors.length} kaisar</span>
          </h3>
          <p class="text-secondary small mb-0">Diurutkan secara kronologis sesuai urutan naik takhta.</p>
          ${empsGrid}
        `;
      },

      renderDatabase() {
        if (App.state.datatableInstance) {
          App.state.datatableInstance.destroy();
          App.state.datatableInstance = null;
        }

        const tableBody = document.querySelector("#emperor-table tbody");
        if (!tableBody) return;
        tableBody.innerHTML = "";

        const emperors = sortEmperorsChronologically(window.BYZANTINE_EMPERORS);

        emperors.forEach((emp) => {
          const tr = document.createElement("tr");
          const coin = window.getEmperorSVG(emp.name, emp.dynasty);
          const dynastyName = getDynastyName(emp.dynasty);

          tr.innerHTML = `
            <td class="text-center text-muted fw-bold" style="vertical-align: middle;" data-order="${emp.chronOrder}">${emp.chronOrder}</td>
            <td class="text-center" style="vertical-align: middle;">
              <div class="table-coin">${coin}</div>
            </td>
            <td style="vertical-align: middle; font-weight: 600;">
              <a href="#/kaisar/${emp.id}" class="text-purple">${emp.name}</a>
            </td>
            <td style="vertical-align: middle;">${emp.reign}</td>
            <td class="text-center" style="vertical-align: middle;" data-order="${emp.startYear}">${emp.startYear} M</td>
            <td style="vertical-align: middle;">
              ${emp.dynasty === "non-dinasti" ? dynastyName : `<a href="#/dinasti/${emp.dynasty}" class="text-secondary">${dynastyName}</a>`}
            </td>
            <td style="vertical-align: middle;" class="text-center" data-order="${emp.reignLength}">${formatReignLength(emp.reignLength)}</td>
            <td style="vertical-align: middle; font-size:0.85rem;">${emp.achievements}</td>
            <td style="vertical-align: middle; font-size:0.85rem;">${emp.wars}</td>
            <td style="vertical-align: middle;" class="text-center">
              <span class="badge-status ${getStatusBadgeClass(emp.status)}">${emp.status}</span>
            </td>
          `;
          tableBody.appendChild(tr);
        });

        App.state.datatableInstance = $("#emperor-table").DataTable({
          stateSave: true,
          pageLength: 25,
          lengthMenu: [10, 25, 50, 100],
          language: {
            search: "Cari Kaisar:",
            lengthMenu: "Tampilkan _MENU_ kaisar",
            info: "Menampilkan _START_ sampai _END_ dari _TOTAL_ kaisar",
            infoEmpty: "Menampilkan 0 sampai 0 dari 0 kaisar",
            infoFiltered: "(difilter dari total _MAX_ kaisar)",
            paginate: {
              first: "Pertama",
              last: "Terakhir",
              next: "Berikutnya",
              previous: "Sebelumnya"
            }
          },
          columnDefs: [
            { orderable: false, targets: [1, 7, 8] },
            { type: "num", targets: [0, 4, 6] }
          ],
          order: [[0, "asc"]]
        });
      },

      renderKaisar(emperorId) {
        const container = document.getElementById("emperor-detail-view");
        if (!container) return;

        if (!emperorId) {
          container.innerHTML = `<div class="alert alert-warning">Silakan pilih kaisar dari database.</div>`;
          return;
        }

        const emp = window.BYZANTINE_EMPERORS.find((e) => e.id === emperorId);
        if (!emp) {
          container.innerHTML = `<div class="alert alert-danger">Kaisar tidak ditemukan!</div>`;
          return;
        }

        const coin = window.getEmperorSVG(emp.name, emp.dynasty);
        const shortName = emp.name.replace(/\s*\(.*\)/, "").trim();
        const dynastyName = getDynastyName(emp.dynasty);
        const prevEmp = window.BYZANTINE_EMPERORS.find((e) => e.chronOrder === emp.chronOrder - 1);
        const nextEmp = window.BYZANTINE_EMPERORS.find((e) => e.chronOrder === emp.chronOrder + 1);

        // Generate dynamic visual family tree diagram
        const parentsNodes = this.renderFamilyRow(emp.familyTree.parents, "Orang Tua", emp);
        const empActiveNode = this.renderFamilyNode(shortName, "Kaisar Aktif", true, emp);
        
        let spouseNodes = "";
        if (emp.familyTree.spouse && emp.familyTree.spouse !== "Tidak menikah" && emp.familyTree.spouse !== "Tidak diketahui" && emp.familyTree.spouse !== "Tidak ada" && emp.familyTree.spouse !== "-") {
          const spouses = emp.familyTree.spouse.split(/,|\b&\b|\bdan\b/);
          const spouseBoxes = spouses.map(sp => {
            const trimmed = sp.trim();
            if (!trimmed) return "";
            return this.renderFamilyNode(trimmed, "Pasangan", false, emp);
          }).filter(html => html !== "").join("");
          spouseNodes = `<div class="family-tree-spouse-connector"></div><div class="family-tree-spouse-column">${spouseBoxes}</div>`;
        } else {
          const spouseBox = this.renderFamilyNode(emp.familyTree.spouse || "Tidak menikah", "Pasangan", false, emp);
          spouseNodes = `<div class="family-tree-spouse-connector"></div><div class="family-tree-spouse-column">${spouseBox}</div>`;
        }

        const childrenNodes = this.renderFamilyRow(emp.familyTree.children, "Anak-Anak", emp);

        const familyTreeHtml = `
          <div class="family-tree-diagram">
            <!-- Row 1: Parents -->
            <div class="family-tree-row">
              ${parentsNodes}
            </div>
            
            <!-- Vertical Connector -->
            <div class="family-tree-connector-v"></div>
            
            <!-- Row 2: Active Emperor & Spouse -->
            <div class="family-tree-row">
              ${empActiveNode}
              ${spouseNodes}
            </div>
            
            <!-- Vertical Connector -->
            <div class="family-tree-connector-v"></div>
            
            <!-- Row 3: Children -->
            <div class="family-tree-row flex-wrap">
              ${childrenNodes}
            </div>
          </div>
        `;

        container.innerHTML = `
          <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
            <a href="#/database" onclick="if(history.length > 1){ event.preventDefault(); history.back(); }" class="btn btn-outline-purple"><i class="fas fa-arrow-left me-2"></i> Kembali</a>
            <div class="emperor-nav-chron">
              ${prevEmp ? `<a href="#/kaisar/${prevEmp.id}" class="btn btn-sm btn-outline-purple"><i class="fas fa-chevron-left me-1"></i> ${prevEmp.name.split(" ")[0]}</a>` : ""}
              <span class="text-muted small mx-2">#${emp.chronOrder} / ${window.BYZANTINE_EMPERORS.length}</span>
              ${nextEmp ? `<a href="#/kaisar/${nextEmp.id}" class="btn btn-sm btn-outline-purple">${nextEmp.name.split(" ")[0]} <i class="fas fa-chevron-right ms-1"></i></a>` : ""}
            </div>
          </div>

          <div class="emperor-header-card p-4">
            <div class="row align-items-center">
              <div class="col-lg-3 text-center">
                <div class="emperor-profile-img-wrapper">${coin}</div>
                <span class="badge-status ${getStatusBadgeClass(emp.status)} d-inline-flex px-3 py-2 mt-2">Status: ${emp.status}</span>
              </div>
              <div class="col-lg-9">
                <h2 class="text-purple">${emp.name}</h2>
                <p class="text-secondary mb-2"><em>Nama Asli: ${emp.originalName}</em></p>
                <div class="row text-secondary mb-3">
                  <div class="col-sm-6">
                    <strong>Pemerintahan:</strong> ${emp.reign}
                  </div>
                  <div class="col-sm-6">
                    <strong>Lama Memerintah:</strong> ${formatReignLength(emp.reignLength)}
                  </div>
                  <div class="col-sm-6 mt-2">
                    <strong>Dinasti:</strong>
                    ${emp.dynasty === "non-dinasti" ? dynastyName : `<a href="#/dinasti/${emp.dynasty}" class="text-purple fw-bold">${dynastyName}</a>`}
                  </div>
                  <div class="col-sm-6 mt-2">
                    <strong>Urutan:</strong> Kaisar ke-${emp.chronOrder} dari ${window.BYZANTINE_EMPERORS.length}
                  </div>
                </div>
                <hr class="border-color">
                <div class="emperor-bio-section ps-3">${emp.biography}</div>
              </div>
            </div>
          </div>

          <div class="row mt-4">
            <div class="col-lg-8">
              <div class="card-imperial mb-4">
                <div class="card-imperial-header">
                  <h3 class="h5 m-0 text-purple">Kebijakan & Reformasi Kekaisaran</h3>
                </div>
                <div class="card-imperial-body">
                  <div class="mb-4">
                    <h4 class="h6 text-purple fw-bold mb-2">Kebijakan Ekonomi</h4>
                    <p class="emperor-card-text text-secondary mb-0">${emp.economy}</p>
                  </div>
                  <div class="mb-4">
                    <h4 class="h6 text-purple fw-bold mb-2">Reformasi Militer</h4>
                    <p class="emperor-card-text text-secondary mb-0">${emp.military}</p>
                  </div>
                  <div>
                    <h4 class="h6 text-purple fw-bold mb-2">Wilayah Kekuasaan</h4>
                    <p class="emperor-card-text text-secondary mb-0">${emp.territory}</p>
                  </div>
                </div>
              </div>

              <div class="card-imperial mb-4">
                <div class="card-imperial-header">
                  <h3 class="h5 m-0 text-purple">Pencapaian & Militer</h3>
                </div>
                <div class="card-imperial-body">
                  <div class="row">
                    <div class="col-md-6 mb-3">
                      <h4 class="h6 text-purple fw-bold mb-2">Prestasi Utama</h4>
                      <p class="emperor-card-text text-secondary mb-0">${emp.achievements}</p>
                    </div>
                    <div class="col-md-6 mb-3">
                      <h4 class="h6 text-purple fw-bold mb-2">Perang Penting</h4>
                      <p class="emperor-card-text text-secondary mb-0">${emp.wars}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="col-lg-4">
              <div class="family-relations-card mb-4">
                <div class="card-imperial-header">
                  <h3 class="h5 m-0 text-purple">Diagram Silsilah Keluarga</h3>
                </div>
                <div class="card-imperial-body">
                  ${familyTreeHtml}
                </div>
              </div>

              <div class="emperor-fact-card p-4">
                <h4 class="h5 text-purple fw-bold mb-3">Fakta Menarik</h4>
                <p class="m-0 text-secondary" style="font-family: var(--font-serif); font-size: 1.05rem; line-height: 1.75;">${emp.interestingFacts}</p>
              </div>
            </div>
          </div>

          <!-- Succession Roadmap (Full Width Banner) -->
          <div class="row">
            <div class="col-12">
              <div class="succession-roadmap-card">
                <h3 class="succession-roadmap-title">Garis Suksesi Kekuasaan</h3>
                <div class="roadmap-flow">
                  <div class="roadmap-step">
                    <span class="roadmap-label">Pendahulu</span>
                    <div class="roadmap-node-box">
                      ${this.parseFamilyMembers(emp.predecessor, emp)}
                    </div>
                  </div>
                  
                  <div class="roadmap-arrow"><i class="fas fa-long-arrow-alt-right"></i></div>
                  
                  <div class="roadmap-step">
                    <span class="roadmap-label text-gold">Kaisar Aktif</span>
                    <div class="roadmap-node-box active-emperor" title="Kaisar yang Sedang Dilihat">
                      <div class="roadmap-coin-mini">${coin}</div>
                      <span class="roadmap-emperor-name text-center" title="${emp.name}">${shortName}</span>
                    </div>
                  </div>
                  
                  <div class="roadmap-arrow"><i class="fas fa-long-arrow-alt-right"></i></div>
                  
                  <div class="roadmap-step">
                    <span class="roadmap-label">Penerus</span>
                    <div class="roadmap-node-box">
                      ${this.parseFamilyMembers(emp.successor, emp)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      },

      parseFamilyMembers(fieldValue, activeEmp = null) {
        if (!fieldValue || fieldValue === "Tidak diketahui" || fieldValue === "Tidak ada" || fieldValue === "Tidak menikah") {
          return `<span class="family-member-badge text-muted">${fieldValue || '-'}</span>`;
        }

        const names = fieldValue.split(/,|\b&\b|\bdan\b/);

        return names.map(name => {
          const trimmed = name.trim();
          if (!trimmed) return "";

          const emp = findEmperorByName(trimmed, activeEmp);
          if (emp) {
            return `<a href="#/kaisar/${emp.id}" class="family-member-badge member-link text-truncate" title="Klik untuk melihat profil ${emp.name}">
              <i class="fas fa-crown me-1 text-gold"></i>${trimmed}
            </a>`;
          } else {
            return `<span class="family-member-badge text-truncate" title="${trimmed}">${trimmed}</span>`;
          }
        }).filter(html => html !== "").join("");
      },

      renderPohon() {
        const container = document.getElementById("dynasty-tree-view");
        if (!container) return;

        const EPOCHS = [
          {
            name: "Era Formasi & Konsolidasi",
            years: "306–518 M",
            dynastyIds: ["konstantinian", "valentinian", "theodosian", "leonid"]
          },
          {
            name: "Restorasi & Transformasi",
            years: "518–820 M",
            dynastyIds: ["justinian", "heraclian", "isaurian", "nikephorian"]
          },
          {
            name: "Zaman Emas & Krisis",
            years: "820–1204 M",
            dynastyIds: ["amorion", "makedonia", "doukas", "komnenos", "angelos"]
          },
          {
            name: "Fragmentasi & Kejatuhan Akhir",
            years: "1204–1453 M",
            dynastyIds: ["laskarid", "palaiologos"]
          }
        ];

        const TRANSITIONS = {
          "konstantinian": { type: "peaceful", label: "Kaisar Julian gugur; Jovian terpilih" },
          "valentinian": { type: "conflict", label: "Bencana Adrianopel; Valens gugur" },
          "theodosian": { type: "peaceful", label: "Marcian wafat alami; Leo I terpilih" },
          "leonid": { type: "peaceful", label: "Anastasius I wafat; Justin I terpilih" },
          "justinian": { type: "conflict", label: "Maurice dikudeta & dibunuh Phocas" },
          "heraclian": { type: "conflict", label: "Krisis 20 Tahun; Justinian II dibunuh" },
          "isaurian": { type: "conflict", label: "Ratu Irene digulingkan Nikephoros I" },
          "nikephorian": { type: "conflict", label: "Nikephoros I gugur; Leo V dikudeta" },
          "amorion": { type: "conflict", label: "Michael III dibunuh Basil I" },
          "makedonia": { type: "peaceful", label: "Garis keturunan habis; krisis Doukas" },
          "doukas": { type: "conflict", label: "Krisis Manzikert; kudeta Alexios I" },
          "komnenos": { type: "conflict", label: "Andronikos I digulingkan secara brutal" },
          "angelos": { type: "conflict", label: "Perang Salib IV menjarah Konstantinopel" },
          "laskarid": { type: "conflict", label: "John IV Laskaris dibutakan Michael VIII" }
        };

        let html = '<div class="epoch-container">';

        EPOCHS.forEach((epoch) => {
          html += `
            <div class="epoch-column">
              <div class="epoch-header">
                <h3>${escapeHTML(epoch.name)}</h3>
                <span class="epoch-years">${escapeHTML(epoch.years)}</span>
              </div>
              <div class="epoch-tree">
          `;

          epoch.dynastyIds.forEach((dynId, dynIdx) => {
            const d = window.BYZANTINE_DYNASTIES.find((item) => item.id === dynId);
            if (!d) return;

            const count = window.BYZANTINE_EMPERORS.filter((e) => e.dynasty === d.id).length;
            const chronOrderText = window.BYZANTINE_DYNASTIES.indexOf(d) + 1;

            html += `
              <div class="tree-node" onclick="window.location.hash='#/dinasti/${d.id}'" style="cursor:pointer; margin-bottom: 0.25rem;">
                <span class="tree-node-order">${chronOrderText}</span>
                <h4>${escapeHTML(d.name.replace(/^Dinasti /, ""))}</h4>
                <p>${escapeHTML(d.period)}</p>
                <span class="tree-node-count">${count} kaisar</span>
              </div>
            `;

            const isLastInEpoch = dynIdx === epoch.dynastyIds.length - 1;
            if (!isLastInEpoch) {
              const trans = TRANSITIONS[dynId] || { type: "peaceful", label: "Suksesi" };
              const transIcon = trans.type === "conflict" ? '<i class="fas fa-hand-fist"></i>' : '<i class="fas fa-crown"></i>';
              html += `
                <div class="tree-transition-line ${trans.type}" title="${escapeHTML(trans.label)}">
                  <span class="transition-indicator ${trans.type}">${transIcon}</span>
                </div>
              `;
            }
          });

          html += `
              </div>
            </div>
          `;
        });

        html += '</div>';
        container.innerHTML = html;
      },

      renderTimeline() {
        const container = document.getElementById("timeline-events-list");
        if (!container) return;
        container.innerHTML = "";

        window.TIMELINE_EVENTS.forEach((evt) => {
          const item = document.createElement("div");
          item.className = "timeline-item";
          item.innerHTML = `
            <div class="timeline-content">
              <span class="timeline-year">${evt.year}</span>
              <h4 class="timeline-title text-purple">${evt.title}</h4>
              <p class="timeline-desc">${evt.description}</p>
            </div>
          `;
          container.appendChild(item);
        });
      },

      renderPeta() {
        // Clean up any existing Leaflet map container to avoid errors
        if (App.state.leafletMap) {
          try {
            App.state.leafletMap.remove();
          } catch (e) {
            console.error("Gagal membersihkan peta lama:", e);
          }
          App.state.leafletMap = null;
          App.state.tileLayer = null;
          App.state.activeLayers = [];
        }

        const mapContainer = document.getElementById("map-leaflet");
        if (!mapContainer) return;

        // Initialize Leaflet map
        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        const initialTileUrl = isDark 
          ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

        const map = L.map("map-leaflet", {
          center: [38.5, 15.0],
          zoom: 4.5,
          minZoom: 4,
          maxZoom: 7,
          maxBounds: [[20.0, -15.0], [52.0, 45.0]],
          maxBoundsViscosity: 1.0,
          zoomControl: false
        });

        L.control.zoom({ position: "topright" }).addTo(map);

        const tileLayer = L.tileLayer(initialTileUrl, {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        }).addTo(map);

        App.state.leafletMap = map;
        App.state.tileLayer = tileLayer;
        App.state.activeLayers = [];

        // Set click listeners for era buttons
        const selectBtns = document.querySelectorAll(".map-control-btn");
        selectBtns.forEach((btn) => {
          btn.onclick = () => {
            selectBtns.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            this.updateMapDisplay(parseInt(btn.getAttribute("data-index"), 10));
          };
        });

        // Default to active button index or index 1
        const activeBtn = document.querySelector(".map-control-btn.active");
        const defaultIndex = activeBtn ? parseInt(activeBtn.getAttribute("data-index"), 10) : 1;
        this.updateMapDisplay(defaultIndex);
      },

      updateMapDisplay(index) {
        const data = window.MAP_DATA[index];
        const descTitle = document.getElementById("map-selected-era");
        const descText = document.getElementById("map-selected-desc");
        const listHighlights = document.getElementById("map-selected-highlights");

        if (descTitle) descTitle.textContent = `${data.century} - ${data.eraName}`;
        if (descText) descText.textContent = data.description;
        if (listHighlights) {
          listHighlights.innerHTML = data.highlights.map((h) => `<span class="badge bg-imperial-purple me-2 mb-2 p-2">${h}</span>`).join("");
        }

        const map = App.state.leafletMap;
        if (!map) return;

        // Update tile layer based on current theme using centralized TILE_URLS
        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        if (App.state.tileLayer) {
          const tileUrl = isDark ? TILE_URLS.dark : TILE_URLS.light;
          App.state.tileLayer.setUrl(tileUrl);
        }

        // Clear previous active layers
        App.state.activeLayers.forEach((layer) => {
          map.removeLayer(layer);
        });
        App.state.activeLayers = [];

        // Determine which regions are active (data-driven)
        const activeRegionKeys = data.activeRegions || [];

        // Draw Polygons for active regions
        const pathColor = data.byzantiumPathColor || "rgba(138, 43, 226, 0.75)";
        const opacity = data.opacity !== undefined ? data.opacity : 0.5;

        activeRegionKeys.forEach((key) => {
          const coords = window.REGION_COORDS[key];
          if (coords) {
            const polygon = L.polygon(coords, {
              color: "#C59B27",
              weight: 2,
              fillColor: pathColor,
              fillOpacity: opacity,
              className: "map-polygon-byz"
            }).addTo(map);
            App.state.activeLayers.push(polygon);
          }
        });

        // Add markers for highlighted cities
        const customIcon = L.divIcon({
          className: "leaflet-marker-pulse",
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        });

        data.highlights.forEach((cityName) => {
          const coords = window.CITY_COORDS[cityName];
          if (coords) {
            const marker = L.marker(coords, { icon: customIcon })
              .bindTooltip(cityName, {
                permanent: true,
                direction: "top",
                offset: [0, -8],
                className: "leaflet-tooltip-custom"
              })
              .addTo(map);
            App.state.activeLayers.push(marker);
          }
        });
      },

      renderReferensi() {
        const container = document.getElementById("academic-refs-list");
        if (!container) return;
        container.innerHTML = "";

        window.ACADEMIC_REFERENCES.forEach((cat) => {
          const col = document.createElement("div");
          col.className = "col-md-6 col-lg-4 mb-4";

          const itemsHtml = cat.items.map((item) => `
            <div class="ref-item p-3 mb-3">
              <h4 class="h6 text-purple fw-bold mb-1">${item.title}</h4>
              <p class="text-gold small mb-2">Oleh: ${item.author} (${item.year})</p>
              <p class="text-muted small">${item.description}</p>
            </div>
          `).join("");

          col.innerHTML = `
            <div class="card-imperial h-100">
              <div class="card-imperial-header">
                <h3 class="h5 m-0 text-purple">${cat.category}</h3>
              </div>
              <div class="card-imperial-body">${itemsHtml}</div>
            </div>
          `;
          container.appendChild(col);
        });
      }
    }
  };

  // Export globally
  window.ByzApp = App;

  // Initialize on load
  document.addEventListener("DOMContentLoaded", () => {
    App.init();
  });
})(window);
