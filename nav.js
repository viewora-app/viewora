// ==================== NAV.JS - Bottom Navigation Active ====================

function highlightActiveNav() {
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    
    document.querySelectorAll('.bottom-nav a').forEach(link => {
        const href = link.getAttribute('href');
        
        // Remove all active classes
        link.classList.remove('active');
        
        // Check if current page matches
        if (href === currentPage || 
            (currentPage === "" && href === "index.html") ||
            (href.includes(currentPage))) {
            link.classList.add('active');
        }
    });
}

// Run when page loads
document.addEventListener('DOMContentLoaded', highlightActiveNav);

// Also run after navigation (for SPA feel)
window.addEventListener('popstate', highlightActiveNav);