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

  window.BizUtils = {
    initDynastyMap,
    initEmperorMap,
    findEmperorByName,
    assignChronOrder,
    sortEmperorsChronologically,
    getEmperorsByDynasty,
    getDynastyName,
    getStatusBadgeClass,
    formatReignLength
  };
})(window);
