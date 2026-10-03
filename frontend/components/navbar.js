document.addEventListener("DOMContentLoaded", async () => {
    const navbarContainer = document.getElementById("navbar");
    if (!navbarContainer) {
        console.error("Navbar container not found.");
        return;
    }
    try {
        const response = await fetch("./components/navbar.html");
        if (!response.ok) {
            throw new Error(
                `Navbar could not be loaded: ${response.status}`
            );
        }
        const navbarHTML = await response.text();
        navbarContainer.innerHTML = navbarHTML;
        let currentPage = window.location.pathname.split("/").pop();

        if (!currentPage) {
            currentPage = "%20index.html";
        }

        const navLinks =
            navbarContainer.querySelectorAll(".navbar-links a");

        navLinks.forEach(link => {

            const page = link.dataset.page;

            if (page === currentPage) {
                link.classList.add("active");
            }

        });

    } catch (error) {
        console.error("Navbar loading error:", error);
    }

});