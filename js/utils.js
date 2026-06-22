// js/utils.js — Shared helpers for emperor ordering, dynasty lookup, and UI

(function (window) {
  const DYNASTY_MAP = new Map();
  const EMPEROR_MAP = new Map();

  function initDynastyMap() {
    DYNASTY_MAP.clear();
    (window.BYZANTINE_DYNASTIES || []).forEach((d) => DYNASTY_MAP.set(d.id, d));
  }

  function initEmperorMap() {
    EMPEROR_MAP.clear();
    (window.BYZANTINE_EMPERORS || []).forEach((emp) => {
      const lowerName = emp.name.toLowerCase().trim();
      const cleanName = lowerName.replace(/\s*\(.*\)/g, "").replace(/\s+the\s+[\w-]+/g, "").trim();
      
      EMPEROR_MAP.set(lowerName, emp);
      EMPEROR_MAP.set(cleanName, emp);
      
      if (emp.originalName) {
        EMPEROR_MAP.set(emp.originalName.toLowerCase().trim(), emp);
      }
    });
  }

  function findEmperorByName(nameStr, activeEmp = null) {
    if (!nameStr) return null;
    const searchName = nameStr.trim().toLowerCase().replace(/\s+the\s+[\w-]+/g, "").trim();
    
    let match = null;
    // Constant time O(1) map lookup
    if (EMPEROR_MAP.has(searchName)) {
      match = EMPEROR_MAP.get(searchName);
    } else {
      // Fallback search for partial name matches
      for (const [key, emp] of EMPEROR_MAP.entries()) {
        if (key.includes(searchName) || searchName.includes(key)) {
          match = emp;
          break;
        }
      }
    }
    
    if (match && activeEmp) {
      const diff = Math.abs(match.startYear - activeEmp.startYear);
      if (diff > 80) return null; // Reject cross-century false matches
    }
    return match;
  }

  function assignChronOrder() {
    (window.BYZANTINE_EMPERORS || []).forEach((emp, index) => {
      emp.chronOrder = index + 1;
    });
  }

  function sortEmperorsChronologically(emperors) {
    return emperors.slice().sort((a, b) => a.chronOrder - b.chronOrder);
  }

  function getEmperorsByDynasty(dynastyId) {
    return sortEmperorsChronologically(
      window.BYZANTINE_EMPERORS.filter((e) => e.dynasty === dynastyId)
    );
  }

  function getDynastyName(dynastyId) {
    if (dynastyId === "non-dinasti") return "Non-Dinasti";
    const dynasty = DYNASTY_MAP.get(dynastyId);
    return dynasty ? dynasty.name : "Non-Dinasti";
  }

  function getStatusBadgeClass(status) {
    return `badge-status-${(status || "lainnya").toLowerCase().replace(/[\s\/]+/g, "-")}`;
  }

  function formatReignLength(years) {
    if (years < 1) return "< 1 Tahun";
    return `${years} Tahun`;
  }

  // HTML escaping helper to prevent XSS
  function escapeHTML(str) {
    if (!str) return "";
    return str.toString().replace(/[&<>'"]/g, (tag) => {
      const chars = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      };
      return chars[tag] || tag;
    });
  }

  // Helper to generate dynamic SVG avatar coin / medallion for emperors
  function getEmperorSVG(name, dynastyId) {
    // Hash function to get consistent colors based on name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorHue = Math.abs(hash % 360);

    // Custom coin details based on dynasty
    let bgGradientStart = "#4A0E4E"; // Default Purple
    let bgGradientEnd = "#1A001D";
    let coinBorder = "#D4AF37"; // Gold border
    let symbolColor = "#FFD700";

    if (dynastyId === "konstantinian") {
      bgGradientStart = "#6A1B29"; bgGradientEnd = "#300A10"; symbolColor = "#F3E5AB";
    } else if (dynastyId === "justinian") {
      bgGradientStart = "#2E5894"; bgGradientEnd = "#122A4E"; symbolColor = "#D4AF37";
    } else if (dynastyId === "heraclian") {
      bgGradientStart = "#53377A"; bgGradientEnd = "#22113A"; symbolColor = "#E6C229";
    } else if (dynastyId === "makedonia") {
      bgGradientStart = "#4A0E4E"; bgGradientEnd = "#230426"; symbolColor = "#FFDF00";
    } else if (dynastyId === "komnenos") {
      bgGradientStart = "#005C53"; bgGradientEnd = "#042940"; symbolColor = "#C5A059";
    } else if (dynastyId === "palaiologos") {
      bgGradientStart = "#800000"; bgGradientEnd = "#2B0000"; symbolColor = "#FDF5E6";
    }

    // Draw different emperor facial profiles / crowns based on name hash
    const crownType = hash % 3;
    let crownSVG = "";
    if (crownType === 0) {
      // Stephanos / Diadem Crown
      crownSVG = `<path d="M40,32 C45,26 55,26 60,32 L60,37 L40,37 Z" fill="${symbolColor}" />
                  <circle cx="50" cy="24" r="3" fill="${symbolColor}" />
                  <line x1="50" y1="27" x2="50" y2="32" stroke="${symbolColor}" stroke-width="2"/>`;
    } else if (crownType === 1) {
      // Mural / Radiate Crown
      crownSVG = `<path d="M38,32 L41,22 L46,28 L50,18 L54,28 L59,22 L62,32 L38,32 Z" fill="${symbolColor}" />
                  <circle cx="50" cy="16" r="2" fill="${symbolColor}" />`;
    } else {
      // Byzantine Dome Crown (Camelaucum)
      crownSVG = `<path d="M40,32 C40,20 60,20 60,32 Z" fill="${symbolColor}" />
                  <rect x="38" y="30" width="24" height="4" rx="2" fill="#E5C158" />
                  <circle cx="50" cy="18" r="3" fill="#D4AF37" />
                  <path d="M42,28 L40,36 M58,28 L60,36" stroke="${symbolColor}" stroke-width="1.5" />`;
    }

    // Draw face outline (stylized coin design)
    const faceSVG = `<circle cx="50" cy="50" r="16" fill="#E8C39E" stroke="#5E3F27" stroke-width="1.5"/>
                     <path d="M46,46 L47,46 M54,46 L55,46" stroke="#5E3F27" stroke-dasharray="1" stroke-width="2" />
                     <path d="M50,48 L50,53 L48,53" fill="none" stroke="#5E3F27" stroke-width="1.5" stroke-linecap="round"/>
                     <path d="M46,58 C48,61 52,61 54,58" fill="none" stroke="#5E3F27" stroke-width="1.5" stroke-linecap="round"/>
                     <path d="M34,50 C34,44 38,44 38,50" fill="none" stroke="#E8C39E" stroke="#5E3F27" stroke-width="1.5" />
                     <path d="M66,50 C66,44 62,44 62,50" fill="none" stroke="#E8C39E" stroke="#5E3F27" stroke-width="1.5" />`;

    // Draw Emperor beard or robes
    let robeSVG = `<path d="M30,75 C30,62 40,62 50,62 C60,62 70,62 70,75 L70,85 L30,85 Z" fill="${symbolColor}" />
                   <path d="M45,62 L50,72 L55,62" fill="none" stroke="#8A0000" stroke-width="2" />`;

    if (hash % 2 === 0) { // Has beard
      robeSVG = `<path d="M44,57 C44,67 56,67 56,57 L54,55 L46,55 Z" fill="#8C6239" />` + robeSVG;
    }

    // Cross symbol (crux gemmata) on the robe / crown or background
    const symbolSVG = `<path d="M80,25 L80,35 M75,30 L85,30" stroke="${coinBorder}" stroke-width="2" stroke-linecap="round" />`;

    // Construct SVG
    return `
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="emperor-coin-svg">
        <defs>
          <radialGradient id="grad-${hash}" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="${bgGradientStart}" />
            <stop offset="100%" stop-color="${bgGradientEnd}" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="46" fill="url(#grad-${hash})" stroke="${coinBorder}" stroke-width="3" />
        <circle cx="50" cy="50" r="41" fill="none" stroke="${coinBorder}" stroke-width="1" stroke-dasharray="3 2" />
        ${robeSVG}
        ${faceSVG}
        ${crownSVG}
        ${symbolSVG}
      </svg>
    `;
  }

  window.BizUtils = {
    initDynastyMap,
    initEmperorMap,
    findEmperorByName,
    assignChronOrder,
    sortEmperorsChronologically,
    getEmperorsByDynasty,
    getDynastyName,
    getStatusBadgeClass,
    formatReignLength,
    escapeHTML,
    getEmperorSVG
  };

  // Expose directly on window for direct access as well
  window.escapeHTML = escapeHTML;
  window.getEmperorSVG = getEmperorSVG;
})(window);
