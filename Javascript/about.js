document.addEventListener('DOMContentLoaded', function() {
    // Header scroll effect
    const header = document.getElementById('mainHeader');

    const menuBtn = document.getElementById('menu-btn');
    const navLinks = document.getElementById('nav-links');
    const menuBtnIcon = menuBtn?.querySelector('i');

    if (menuBtn && navLinks && menuBtnIcon) {
        menuBtn.addEventListener('click', function() {
            const isOpen = navLinks.classList.toggle('open');
            menuBtn.setAttribute('aria-expanded', String(isOpen));
            menuBtn.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
            menuBtnIcon.className = isOpen ? 'ri-close-line' : 'ri-menu-3-line';
        });

        navLinks.querySelectorAll('a').forEach(function(link) {
            link.addEventListener('click', function() {
                navLinks.classList.remove('open');
                menuBtn.setAttribute('aria-expanded', 'false');
                menuBtn.setAttribute('aria-label', 'Open navigation');
                menuBtnIcon.className = 'ri-menu-3-line';
            });
        });
    }
    
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // Modal functionality
    const modal = document.getElementById('hireModal');
    const hireBtn = document.getElementById('hireMeBtn');
    const closeModal = document.querySelector('.close-modal');
    const contactForm = document.getElementById('contactForm');

    hireBtn.addEventListener('click', function() {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    });

    closeModal.addEventListener('click', function() {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    });

    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });

    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        // Here you would typically send the form data to a server
        alert('Thank you for your message! I will get back to you soon.');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        contactForm.reset();
    });

    // Animate skill bars
    const skillBars = document.querySelectorAll('.skill-progress');
    
    function animateSkillBars() {
        skillBars.forEach(bar => {
            const width = bar.getAttribute('data-width');
            bar.style.width = width + '%';
        });
    }

    // Intersection Observer for skill bars animation
    const skillsSection = document.querySelector('.skills-container');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateSkillBars();
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    observer.observe(skillsSection);
});